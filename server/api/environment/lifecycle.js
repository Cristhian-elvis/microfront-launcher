import { addLog, childProcesses, stopProcess, stopStaticServer, stopAllStaticServers } from "../../lib/runtime.js";
import { state } from "../../state.js";

/** Operaciones de limpieza y parada del entorno. */
export function createEnvironmentLifecycle({ emitState, updateSession, getEnvironmentOperation, clearEnvironmentOperation }) {
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
    if (state.shell.status !== "stopped") addLog("Shell", "info", "Deteniendo servidor HTTP de la shell.");
    await stopEnvironmentProcesses();
    await stopAllStaticServers();
    resetRuntimeState();
    emitState();
  }

  async function stopEnvironmentInternals({ reason = "Entorno detenido", emitFinalSession = true, abortOperation = true } = {}) {
    const operationToStop = getEnvironmentOperation();
    if (abortOperation) operationToStop?.controller.abort();
    if (emitFinalSession) updateSession({ status: "stopping", stage: "stopping", message: reason });

    try {
      if (state.shell.status !== "stopped") {
        addLog("Detener shell", "stage", "Deteniendo servidor HTTP de la shell.");
        await stopStaticServer("shell");
        state.shell = { status: "stopped", url: null, projectId: null, name: null, appName: null, external: false };
        emitState();
      }
      if (state.components.status !== "stopped") {
        await stopStaticServer("components");
        state.components = { status: "stopped", url: null, version: null, tag: null, external: false };
        addLog("MOVA Components", "success", "Components detenido junto con la shell.");
        emitState();
      }
      await stopEnvironmentProcesses();
      state.microfrontend = { status: "stopped", projectId: null, id: null, name: null, version: null };
      emitState();
    } finally {
      if (abortOperation && getEnvironmentOperation() === operationToStop) clearEnvironmentOperation();
      if (emitFinalSession) updateSession({ status: "idle", stage: "idle", plan: null, message: reason, projectId: null, projectName: null, startedAt: null });
    }
  }

  return { resetRuntimeState, cleanupStartedResources, stopEnvironmentInternals };
}
