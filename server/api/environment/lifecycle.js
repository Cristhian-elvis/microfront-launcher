import {
  addLog,
  childProcesses,
  stopAllStaticServers,
  stopProcess,
  stopStaticServer,
} from '../../lib/runtime.js';
import { state } from '../../state.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';
import { EnvironmentOperationService } from './operation.js';
import { EnvironmentSessionStateService } from './session-state.js';

/** Operaciones de limpieza y parada del entorno. */
export class EnvironmentLifecycleService {
  static resetRuntimeState() {
    state.components = { status: 'stopped', url: null, version: null, tag: null, external: false };
    state.shell = { status: 'stopped', url: null, projectId: null, name: null, appName: null, external: false };
    state.microfrontend = { status: 'stopped', projectId: null, id: null, name: null, version: null };
  }

  static async stopEnvironmentProcesses() {
    const records = [...childProcesses.entries()].filter(([key]) => !key.startsWith('build:'));
    for (const [key] of records) stopProcess(key);
    await Promise.race([
      Promise.all(records.map(([, record]) => record.done)),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  }

  static async cleanupStartedResources() {
    if (state.shell.status !== 'stopped') addLog('Shell', 'info', 'Deteniendo servidor HTTP de la shell.');
    await EnvironmentLifecycleService.stopEnvironmentProcesses();
    await stopAllStaticServers();
    EnvironmentLifecycleService.resetRuntimeState();
    RuntimeStateService.emitState();
  }

  static async stopEnvironmentInternals({ reason = 'Entorno detenido', emitFinalSession = true, abortOperation = true } = {}) {
    const operationToStop = EnvironmentOperationService.get();
    if (abortOperation) operationToStop?.controller.abort();
    if (emitFinalSession)
      EnvironmentSessionStateService.updateSession({ status: 'stopping', stage: 'stopping', message: reason });

    try {
      if (state.shell.status !== 'stopped') {
        addLog('Detener shell', 'stage', 'Deteniendo servidor HTTP de la shell.');
        await stopStaticServer('shell');
        state.shell = { status: 'stopped', url: null, projectId: null, name: null, appName: null, external: false };
        RuntimeStateService.emitState();
      }
      if (state.components.status !== 'stopped') {
        await stopStaticServer('components');
        state.components = { status: 'stopped', url: null, version: null, tag: null, external: false };
        addLog('MOVA Components', 'success', 'Components detenido junto con la shell.');
        RuntimeStateService.emitState();
      }
      await EnvironmentLifecycleService.stopEnvironmentProcesses();
      state.microfrontend = { status: 'stopped', projectId: null, id: null, name: null, version: null };
      RuntimeStateService.emitState();
    } finally {
      if (abortOperation && EnvironmentOperationService.get() === operationToStop)
        EnvironmentOperationService.clear();
      if (emitFinalSession)
        EnvironmentSessionStateService.updateSession({ status: 'idle', stage: 'idle', plan: null, message: reason, projectId: null, projectName: null, startedAt: null });
    }
  }
}
