import {
  addLog
} from "./../../lib/runtime.js";

export function createEnvironmentModel({
  environmentService,
  cancelAndStopAll,
}) {
  return {
    start({ projectId, microfrontendId, rebuildShell }) {
      environmentService.runEnvironment(projectId, {
        microfrontendId,
        rebuildShell: Boolean(rebuildShell),
      }).catch((error) => addLog("Entorno", "error", error.message));
    },

    rebuildShell({ projectId }) {
      environmentService
        .rebuildShellServer(projectId)
        .catch((error) => addLog("Reconstruir servidor", "error", error.message));
    },

    stop(reason) {
      return cancelAndStopAll(reason);
    },
  };
}
