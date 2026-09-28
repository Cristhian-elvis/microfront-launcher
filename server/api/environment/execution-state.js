import { state } from "../../state.js";
import { addLog } from "../../lib/runtime.js";

/**
 * Actualizaciones de estado asociadas al ciclo de vida de un entorno.
 * `emitState` se mantiene como dependencia porque index.js compone la vista
 * completa del estado que reciben los clientes SSE.
 */
export function createEnvironmentExecutionState({ emitState }) {
  function updateSession(patch) {
    state.session = { ...state.session, ...patch };
    emitState();
  }

  function beginExecution(project, steps, kind = "start") {
    state.execution = {
      status: "running",
      kind,
      projectId: project.id,
      projectName: project.name,
      steps: steps.map((step) => ({
        ...step,
        status: "pending",
        message: null,
        startedAt: null,
        endedAt: null,
      })),
      error: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    emitState();
  }

  function updateExecution(patch) {
    state.execution = { ...state.execution, ...patch };
    emitState();
  }

  function updateExecutionStep(id, patch) {
    state.execution = {
      ...state.execution,
      steps: state.execution.steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    };
    emitState();
  }

  function recordStartValidationError(project, error) {
    const now = new Date().toISOString();
    state.execution = {
      status: "error",
      kind: "start",
      projectId: project.id,
      projectName: project.name,
      steps: [{
        id: "validation",
        label: "Validar inicio",
        command: "Validar shell y MOVA Components",
        status: "error",
        message: error.message,
        startedAt: now,
        endedAt: now,
      }],
      error: error.message,
      startedAt: now,
      endedAt: now,
    };
    emitState();
  }

  async function runTrackedStage({ id, message, task }) {
    const startedAt = new Date().toISOString();
    const index = state.execution.steps.findIndex((step) => step.id === id);
    const step = state.execution.steps[index];
    const label = step?.label || id;
    const action = step?.command || message;
    addLog(action, "stage", step?.detail || message);
    updateSession({ stage: id, message: action });
    updateExecutionStep(id, { status: "running", startedAt, message: null });
    try {
      const result = await task();
      updateExecutionStep(id, { status: "success", endedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      updateExecutionStep(id, {
        status: "error",
        message: error.message,
        endedAt: new Date().toISOString(),
      });
      addLog(label, "error", error.message);
      throw error;
    }
  }

  function clearExecutionForRestart() {
    state.execution = {
      status: "idle",
      kind: null,
      projectId: null,
      projectName: null,
      steps: [],
      error: null,
      startedAt: null,
      endedAt: null,
    };
    emitState();
  }

  return {
    updateSession,
    beginExecution,
    updateExecution,
    updateExecutionStep,
    recordStartValidationError,
    runTrackedStage,
    clearExecutionForRestart,
  };
}
