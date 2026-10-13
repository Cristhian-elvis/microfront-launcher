import { ConflictError, ValidationError } from '../../app/errors/app-error.js';
import { currentGitBranch, getProjects, updateMicrofrontendBranchCache } from '../../lib/core.js';
import { addLog } from '../../lib/runtime-events.js';
import { ensureChangeBranchScript } from '../../services/change-branch-provisioning-service.js';
import { runProcessStep } from '../../services/process-runner-service.js';
import { selectMicrofrontends } from '../../services/microfrontend-selection-service.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

let branchOperation = null;

export function isBranchOperationRunning() {
  return Boolean(branchOperation);
}

function assertNoConcurrentOperations() {
  if (
    isBranchOperationRunning()
    || RuntimeStateService.getRuntime().microfrontendBuild.status === 'running'
  ) {
    throw new ConflictError({
      message: 'Ya hay una operación de microfrontend en curso.',
    });
  }
}

/**
 * Cambia la rama de uno o varios microfrontends con una única invocación del
 * script `change-branch-project` de la shell (provisionado automáticamente
 * si no existe). El script acepta varios nombres de microfront como
 * argumentos posicionales y los procesa secuencialmente, por lo que todo el
 * lote se resuelve en un solo proceso.
 *
 * El progreso detallado de la operación (por microfrontend) queda en los
 * logs de la aplicación, capturados desde stdout/stderr del proceso.
 * @param {object} project Proyecto (shell) sobre el que operar.
 * @param {Array<{ id: string, name: string, path: string }>} microfrontends Microfronts a cambiar de rama.
 * @param {string} branch Rama destino.
 */
async function switchMicrofrontendsBranch(project, microfrontends, branch) {
  if (!ensureChangeBranchScript(project)) {
    throw new ValidationError({
      message: `La shell ${project.name} no tiene un package.json válido.`,
    });
  }

  await runProcessStep({
    key: `branch:${project.id}`,
    label: `${project.name} · change-branch-project`,
    file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: [
      'run', 'change-branch-project', '--',
      ...microfrontends.map((item) => item.name),
      `--branch=${branch}`,
    ],
    cwd: project.path,
  });

  await Promise.all(
    microfrontends.map(async (microfrontend) => {
      const newBranch = await currentGitBranch(microfrontend.path);
      updateMicrofrontendBranchCache(project.id, microfrontend.id, newBranch);
    }),
  );
  addLog(
    'Microfronts',
    'success',
    `${microfrontends.map((item) => item.name).join(', ')} sincronizado(s) en la rama ${branch}.`,
  );
}

export async function startMicrofrontendBranchSwitch(
  projectId,
  microfrontendId,
  branch,
) {
  assertNoConcurrentOperations();

  const project = (await getProjects()).find((item) => item.id === projectId);
  const microfrontend = project?.microfrontends?.find(
    (item) => item.id === microfrontendId,
  );
  if (!microfrontend) {
    throw new ValidationError({
      message: 'No se encontró el microfrontend solicitado.',
    });
  }

  RuntimeStateService.updateMicrofrontendBranch({
    status: 'running',
    projectId,
    microfrontendId,
    branch,
    phase: 'switch',
    message: 'Cambiando de rama.',
    error: null,
    startedAt: new Date().toISOString(),
  });

  branchOperation = switchMicrofrontendsBranch(project, [microfrontend], branch)
    .then(() => {
      RuntimeStateService.updateMicrofrontendBranch({
        status: 'success',
        branch,
        phase: 'done',
        message: `Rama ${branch} aplicada correctamente.`,
        error: null,
      });
    })
    .catch((error) => {
      addLog(
        'Microfronts',
        'error',
        error instanceof Error ? error.message : String(error),
      );
      RuntimeStateService.updateMicrofrontendBranch({
        status: 'error',
        phase: 'error',
        message: 'No se pudo cambiar la rama.',
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      branchOperation = null;
      RuntimeStateService.emitState();
    });
}

export async function startMicrofrontendBranchBatch(
  projectId,
  microfrontendIds,
  branch,
) {
  assertNoConcurrentOperations();

  const { project, microfrontends } = await selectMicrofrontends(
    projectId,
    microfrontendIds,
  );
  const startedAt = new Date().toISOString();

  for (const microfrontend of microfrontends) {
    RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
      status: 'running', branch, phase: 'switch', message: 'Cambiando de rama', error: null, startedAt,
    });
  }

  branchOperation = switchMicrofrontendsBranch(project, microfrontends, branch)
    .then(() => {
      for (const microfrontend of microfrontends) {
        RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
          status: 'success', branch, phase: 'done', message: 'Completado', error: null, startedAt,
        });
      }
      RuntimeStateService.updateMicrofrontendBranch({
        status: 'success',
        projectId,
        microfrontendId: microfrontends.at(-1)?.id ?? null,
        branch,
        phase: 'done',
        message: `Rama ${branch} aplicada a ${microfrontends.length} microfront(s).`,
        error: null,
        startedAt,
        batchIds: microfrontendIds,
        completedIds: microfrontends.map((item) => item.id),
      });
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      for (const microfrontend of microfrontends) {
        RuntimeStateService.updateMicrofrontendOperation('branch', projectId, microfrontend.id, {
          status: 'error', branch, phase: 'error', message: 'No se pudo cambiar la rama', error: message, startedAt,
        });
      }
      RuntimeStateService.updateMicrofrontendBranch({
        status: 'error',
        branch,
        error: message,
        message: 'El cambio de rama por lote no se completó.',
        startedAt,
        batchIds: microfrontendIds,
      });
      addLog('Microfronts', 'error', message);
    })
    .finally(() => {
      branchOperation = null;
    });
}
