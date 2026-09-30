import { state } from "../../state.js";
import { addLog } from "../../lib/runtime.js";

/** Estado ligero y trazabilidad de las etapas del entorno. */
export function createEnvironmentSessionState({ emitState }) {
  function updateSession(patch) {
    state.session = { ...state.session, ...patch };
    emitState();
  }

  async function runTrackedStage({ stage, message, task }) {
    addLog("Entorno", "stage", message);
    updateSession({ stage, message });
    try {
      return await task();
    } catch (error) {
      addLog("Entorno", "error", error.message);
      throw error;
    }
  }

  return { updateSession, runTrackedStage };
}
