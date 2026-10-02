import { spawnManaged } from '../lib/runtime.js';
import { state } from '../state.js';
import { assertNotCancelled } from './process-runner-service.js';
import { RuntimeStateService } from './runtime-state-service.js';

/** Gestiona los procesos watch de microfrontends locales. */
export class MicrofrontendRuntimeService {
  static startMicrofrontend(project, microfrontend, signal) {
    assertNotCancelled(signal);
    if (!microfrontend?.watchAvailable)
      throw new Error(
        `El microfrontend ${microfrontend?.name || ''} no define npm run watch.`,
      );
    const key = `microfrontend:${project.id}:${microfrontend.id}`;
    state.microfrontend = {
      status: 'starting',
      projectId: project.id,
      id: microfrontend.id,
      name: microfrontend.name,
      version: microfrontend.version,
    };
    RuntimeStateService.emitState();
    const record = spawnManaged({
      key,
      label: microfrontend.name,
      file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'watch'],
      cwd: microfrontend.path,
    });
    record.done.then(() => {
      if (state.microfrontend.id !== microfrontend.id) return;
      state.microfrontend = {
        status: 'stopped',
        projectId: null,
        id: null,
        name: null,
        version: null,
      };
      RuntimeStateService.emitState();
    });
    state.microfrontend = { ...state.microfrontend, status: 'running' };
    RuntimeStateService.emitState();
  }
}
