import { addLog } from '../../lib/runtime.js';
import { state } from '../../state.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

/** Estado ligero y trazabilidad de las etapas del entorno. */
export class EnvironmentSessionStateService {
  static updateSession(patch) {
    state.session = { ...state.session, ...patch };
    RuntimeStateService.emitState();
  }

  static async runTrackedStage({ stage, message, task }) {
    addLog('Entorno', 'stage', message);
    EnvironmentSessionStateService.updateSession({ stage, message });
    try {
      return await task();
    } catch (error) {
      addLog('Entorno', 'error', error.message);
      throw error;
    }
  }
}
