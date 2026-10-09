import { addLog } from '../../lib/runtime.js';
import { getProjects, gitBranchInfo, updateMicrofrontendGitCache } from '../../lib/core.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';
import { ConflictError, ValidationError } from '../../app/errors/app-error.js';

export function createMicrofrontendBranchUseCases({
  state,
  runGit,
  isBranchOperationRunning,
  setBranchOperation,
  clearBranchOperation,
  selectMicrofrontends,
} = {}) {
  if (!state) throw new ValidationError({ message: 'State es requerido' });
  if (!runGit) throw new ValidationError({ message: 'runGit es requerido' });

  function assertNoConcurrentOperations() {
    if (isBranchOperationRunning?.() || RuntimeStateService.getRuntime().microfrontendBuild.status === 'running') {
      throw new ConflictError({ message: 'Ya hay una operación de microfrontend en curso.' });
    }
  }

  async function switchMicrofrontendBranch(projectId, microfrontendId, branch, progress = null, report = null) {
    const project = (await getProjects()).find((item) => item.id === projectId);
    const microfrontend = project?.microfrontends?.find((item) => item.id === microfrontendId);

    if (!microfrontend) throw new ValidationError({ message: 'No se encontró el microfrontend solicitado.' });

    const branchName = String(branch).replace(/^origin\//, '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branchName)) {
      throw new ValidationError({ message: 'La rama indicada no es válida.' });
    }

    const progressMessage = (message, step) => {
      const batch = progress?.total > 1 ? ` · microfront ${progress.position}/${progress.total}` : '';
      return `${message} (paso ${step}/4${batch})`;
    };

    const updatePhase = (phase, message) => {
      RuntimeStateService.updateMicrofrontendBranch({ phase, message });
      report?.({ phase, message });
    };

    updatePhase('validating', progressMessage('Comprobando cambios locales', 1));
    const changes = await runGit(['status', '--porcelain'], microfrontend.path);
    if (changes) {
      throw new ConflictError({
        message: `${microfrontend.name} tiene cambios locales. Confírmalos o guárdalos antes de cambiar de rama.`,
      });
    }

    addLog('Microfronts', 'stage', `Actualizando referencias de ${microfrontend.name}.`);
    updatePhase('fetch', progressMessage('Actualizando referencias remotas', 2));
    await runGit(['fetch', '--all', '--prune'], microfrontend.path);

    const localBranches = await runGit(['branch', '--format=%(refname:short)'], microfrontend.path);
    const hasLocalBranch = localBranches.split(/\r?\n/).includes(branchName);

    const remoteBranches = await runGit(['branch', '--remotes', '--format=%(refname:short)'], microfrontend.path);
    const hasRemoteBranch = remoteBranches.split(/\r?\n/).includes(`origin/${branchName}`);

    if (!hasLocalBranch && !hasRemoteBranch) {
      throw new ValidationError({
        message: `La rama ${branch} no existe en el repositorio de ${microfrontend.name}.`,
      });
    }

    updatePhase('switch', progressMessage(`Cambiando a ${branchName}`, 3));
    await runGit(
      hasLocalBranch ? ['switch', branchName] : ['switch', '--track', `origin/${branchName}`],
      microfrontend.path,
    );

    if (hasRemoteBranch) {
      updatePhase('pull', progressMessage(`Sincronizando ${branchName}`, 4));
      await runGit(['pull', '--ff-only', 'origin', branchName], microfrontend.path);
    }

    const newGitInfo = await gitBranchInfo(microfrontend.path);
    updateMicrofrontendGitCache(projectId, microfrontendId, newGitInfo);

    addLog('Microfronts', 'success', `${microfrontend.name} sincronizado en la rama ${branch}.`);
  }

  function startMicrofrontendBranchSwitch(projectId, microfrontendId, branch) {
    assertNoConcurrentOperations();

    const id = `${Date.now()}-${Math.random()}`;
    setBranchOperation?.({ id });

    RuntimeStateService.updateMicrofrontendBranch({
      status: 'running',
      projectId,
      microfrontendId,
      branch,
      phase: 'validating',
      message: 'Preparando cambio de rama.',
      error: null,
      startedAt: new Date().toISOString(),
    });

    switchMicrofrontendBranch(projectId, microfrontendId, branch, { position: 1, total: 1 })
      .then(() =>
        RuntimeStateService.updateMicrofrontendBranch({
          status: 'success',
          branch,
          phase: 'done',
          message: `Rama ${branch} aplicada correctamente.`,
          error: null,
        }),
      )
      .catch((error) => {
        addLog('Microfronts', 'error', error.message);
        RuntimeStateService.updateMicrofrontendBranch({
          status: 'error',
          phase: 'error',
          message: 'No se pudo cambiar la rama.',
          error: error.message,
        });
      })
      .finally(() => {
        const current = isBranchOperationRunning?.();
        // best-effort clear if matches
        if (current && typeof current === 'object' && current.id === id) {
          clearBranchOperation?.();
        } else {
          clearBranchOperation?.();
        }
        RuntimeStateService.emitState();
      });
  }

  async function startMicrofrontendBranchBatch(projectId, microfrontendIds, branch) {
    assertNoConcurrentOperations();
    if (!selectMicrofrontends) {
      throw new ValidationError({ message: 'selectMicrofrontends es requerido para branch-batch.' });
    }

    const { microfrontends } = await Promise.resolve(selectMicrofrontends(projectId, microfrontendIds));

    const startedAt = new Date().toISOString();
    const run = async () => {
      const results = await Promise.all(
        microfrontends.map(async (microfrontend) => {
          const report = (patch) =>
            RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
              status: 'running',
              branch,
              startedAt,
              ...patch,
            });

          report({ phase: 'validating', message: 'Preparando cambio', error: null });

          try {
            await switchMicrofrontendBranch(projectId, microfrontend.id, branch, null, report);
            RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
              status: 'success',
              branch,
              phase: 'done',
              message: 'Completado',
              error: null,
              startedAt,
            });
            return true;
          } catch (error) {
            RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
              status: 'error',
              branch,
              phase: 'error',
              message: 'No se pudo cambiar la rama',
              error: error.message,
              startedAt,
            });
            return false;
          }
        }),
      );

      const completedIds = microfrontends
        .filter((_, index) => results[index])
        .map((item) => item.id);

      RuntimeStateService.updateMicrofrontendBranch({
        status: results.every(Boolean) ? 'success' : 'error',
        projectId,
        microfrontendId: microfrontends.at(-1).id,
        branch,
        phase: 'done',
        message: `Rama ${branch} aplicada a ${completedIds.length}/${microfrontends.length} microfronts.`,
        error: null,
        startedAt,
        batchIds: microfrontendIds,
        completedIds,
      });
    };

    setBranchOperation?.(run());

    Promise.resolve(isBranchOperationRunning?.())
      .catch(() => null)
      .finally(() => {
        // if branchOperation is promise, clear when resolves
        Promise.resolve(isBranchOperationRunning?.())
          .catch(() => null)
          .finally(() => clearBranchOperation?.());
      });

    // Start the batch in background
    const promise = Promise.resolve()
      .then(run)
      .catch((error) => {
        RuntimeStateService.updateMicrofrontendBranch({
          status: 'error',
          branch,
          error: error.message,
          message: 'El cambio de rama por lote no se completó.',
          startedAt,
          batchIds: microfrontendIds,
        });
        addLog('Microfronts', 'error', error.message);
      })
      .finally(() => clearBranchOperation?.());

    setBranchOperation?.(promise);
  }

  return {
    switchMicrofrontendBranch,
    startMicrofrontendBranchSwitch,
    startMicrofrontendBranchBatch,
  };
}
