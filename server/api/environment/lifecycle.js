import {
  addLog,
  childProcesses,
  stopProcess,
  stopStaticServer,
  stopAllStaticServers,
} from "../../lib/runtime.js";
import { state } from "../../state.js";

/** Operaciones de limpieza, parada y reinicio del entorno. */
export function createEnvironmentLifecycle({
  emitState,
  updateSession,
  updateExecution,
  updateExecutionStep,
  clearExecutionForRestart,
  getEnvironmentOperation,
  clearEnvironmentOperation,
}) {
  function resetRuntimeState() {
    state.components = { status: "stopped", url: null, version: null, tag: null, external: false };
    state.shell = { status: "stopped", url: null, projectId: null, name: null, appName: null, external: false };
    state.microfrontend = { status: "stopped", projectId: null, id: null, name: null, version: null };
  }

  async function stopEnvironmentProcesses() {
    const records = [...childProcesses.entries()].filter(([key]) => !key.startsWith("build:"));
    for (const [key] of records) stopProcess(key);
    await Promise.race([
      Promise.all(records.map(([, record]) => record.done)),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  }

  async function cleanupStartedResources() {
    if (state.shell.status !== "stopped")
      addLog("Shell", "info", "Deteniendo servidor HTTP de la shell.");
    await stopEnvironmentProcesses();
    await stopAllStaticServers();
    resetRuntimeState();
    emitState();
  }

  async function stopEnvironmentInternals({
    reason = "Entorno detenido",
    emitStopExecution = true,
    emitFinalSession = true,
    abortOperation = true,
  } = {}) {
    const operationToStop = getEnvironmentOperation();
    if (abortOperation) operationToStop?.controller.abort();
    const projectName = state.shell.name || "Shell";

    if (emitStopExecution) {
      const stopSteps = state.shell.status !== "stopped"
        ? [{ id: "stopShell", label: projectName, command: "Detener shell", detail: "Cerrar servidor HTTP interno" }]
        : [];
      state.execution = {
        status: "running", kind: "stop", projectId: state.shell.projectId, projectName,
        steps: stopSteps.map((step) => ({ ...step, status: "pending", startedAt: null, endedAt: null })),
        error: null, startedAt: new Date().toISOString(), endedAt: null,
      };
      updateSession({ status: "stopping", stage: "stopping", message: reason });
    }

    const stopStep = async (id, message, task) => {
      if (!emitStopExecution) return task();
      const index = state.execution.steps.findIndex((step) => step.id === id);
      const action = state.execution.steps[index]?.command || message;
      updateExecutionStep(id, { status: "running", startedAt: new Date().toISOString() });
      addLog(action, "stage", message);
      await task();
      updateExecutionStep(id, { status: "success", endedAt: new Date().toISOString() });
    };

    try {
      if (state.shell.status !== "stopped") {
        await stopStep("stopShell", "Deteniendo servidor HTTP de la shell.", async () => {
          await stopStaticServer("shell");
          state.shell = { status: "stopped", url: null, projectId: null, name: null, appName: null, external: false };
          if (emitStopExecution) emitState();
        });
      }
      if (state.components.status !== "stopped") {
        await stopStaticServer("components");
        state.components = { status: "stopped", url: null, version: null, tag: null, external: false };
        addLog("MOVA Components", "success", "Components detenido junto con la shell.");
        if (emitStopExecution) emitState();
      }
      await stopEnvironmentProcesses();
      state.microfrontend = { status: "stopped", projectId: null, id: null, name: null, version: null };
      if (emitStopExecution)
        updateExecution({ status: "success", endedAt: new Date().toISOString() });
    } catch (error) {
      if (emitStopExecution)
        updateExecution({ status: "error", error: error.message, endedAt: new Date().toISOString() });
      throw error;
    }

    if (abortOperation && getEnvironmentOperation() === operationToStop)
      clearEnvironmentOperation();
    if (emitFinalSession)
      updateSession({ status: "idle", stage: "idle", plan: null, message: reason, projectId: null, projectName: null, startedAt: null });
  }

  async function stopForRestart(reason = "Reiniciando entorno") {
    await stopEnvironmentInternals({ reason, emitStopExecution: false, emitFinalSession: false, abortOperation: false });
    clearExecutionForRestart();
    emitState();
  }

  return { resetRuntimeState, cleanupStartedResources, stopEnvironmentInternals, stopForRestart };
}
