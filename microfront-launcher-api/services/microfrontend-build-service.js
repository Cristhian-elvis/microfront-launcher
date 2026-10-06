import { addLog, spawnManaged } from '../lib/runtime.js';
import { state } from '../state.js';
import { RuntimeStateService } from './runtime-state-service.js';
import { selectMicrofrontends } from './microfrontend-selection-service.js';

export function createMicrofrontendBuildService({
  isBranchOperationRunning,
}) {
  function buildMicrofrontend(project, microfrontend) {
    if (isBranchOperationRunning() || state.microfrontendBuild.status === 'running') {
      throw new Error('Ya hay una operación de microfrontend en curso.');
    }
    if (!microfrontend?.buildAvailable) {
      throw new Error(
        `El microfrontend ${microfrontend?.name || ''} no define npm run build.`,
      );
    }

    const record = spawnManaged({
      key: `microfrontend-build:${project.id}:${microfrontend.id}`,
      label: `Build · ${microfrontend.name}`,
      file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'build'],
      cwd: microfrontend.path,
      longRunning: false,
    });
    RuntimeStateService.updateMicrofrontendBuild({
      status: 'running',
      projectId: project.id,
      microfrontendId: microfrontend.id,
      phase: 'build',
      message: 'Compilando.',
      error: null,
      startedAt: new Date().toISOString(),
    });
    record.done.then(({ code }) => {
      if (state.microfrontendBuild.microfrontendId !== microfrontend.id) return;
      if (code === 0) {
        RuntimeStateService.updateMicrofrontendBuild({
          status: 'success',
          message: `${microfrontend.name} compilado correctamente.`,
          error: null,
        });
        return;
      }
      RuntimeStateService.updateMicrofrontendBuild({
        status: 'error',
        message: 'La compilación no se completó.',
        error: `${microfrontend.name} terminó con código ${code ?? '-'}.`,
      });
    });
    return record;
  }

  async function startBatch(projectId, microfrontendIds) {
    if (isBranchOperationRunning() || state.microfrontendBuild.status === 'running') {
      throw new Error('Ya hay una operación de microfrontend en curso.');
    }
    const { project, microfrontends } = await selectMicrofrontends(
      projectId,
      microfrontendIds,
    );
    if (microfrontends.some((item) => !item.buildAvailable)) {
      throw new Error('La selección contiene microfronts sin el script npm run build.');
    }
    const startedAt = new Date().toISOString();
    void Promise.all(microfrontends.map(async (microfrontend) => {
      RuntimeStateService.updateMicrofrontendOperation('build', projectId, microfrontend.id, {
        status: 'running', phase: 'build', message: 'Compilando', error: null, startedAt,
      });
      const record = spawnManaged({
        key: `microfrontend-build:${project.id}:${microfrontend.id}`,
        label: `Build · ${microfrontend.name}`,
        file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['run', 'build'], cwd: microfrontend.path, longRunning: false,
      });
      const { code } = await record.done;
      const succeeded = code === 0;
      RuntimeStateService.updateMicrofrontendOperation('build', projectId, microfrontend.id, {
        status: succeeded ? 'success' : 'error', phase: succeeded ? 'done' : 'error',
        message: succeeded ? 'Completado' : 'No se completó la compilación',
        error: succeeded ? null : `Terminó con código ${code ?? '-'}.`, startedAt,
      });
      return succeeded;
    })).then((results) => {
      const completedIds = microfrontends.filter((_, index) => results[index]).map((item) => item.id);
      RuntimeStateService.updateMicrofrontendBuild({
        status: results.every(Boolean) ? 'success' : 'error', projectId,
        microfrontendId: microfrontends.at(-1).id, phase: 'done',
        message: `${completedIds.length}/${microfrontends.length} microfronts compilados.`,
        error: null, startedAt, batchIds: microfrontendIds, completedIds,
      });
    }).catch((error) => {
      RuntimeStateService.updateMicrofrontendBuild({
        status: 'error', error: error.message,
        message: 'La compilación por lote no se completó.', startedAt, batchIds: microfrontendIds,
      });
      addLog('Microfronts', 'error', error.message);
    });
  }

  return { buildMicrofrontend, startBatch };
}
