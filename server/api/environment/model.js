/**
 * Operaciones de aplicación para el entorno.
 *
 * Mantiene el detalle de cómo se inicia, reconstruye o detiene el entorno fuera
 * de la capa HTTP. Las operaciones concretas se inyectan desde la composición
 * de la aplicación en `server/index.js`.
 */
export function createEnvironmentModel({
  environmentService,
  cancelAndStopAll,
  addLog,
}) {
  return {
    start({ projectId, microfrontendId, rebuildShell }) {
      environmentService.runEnvironment(projectId, {
        microfrontendId,
        rebuildShell: Boolean(rebuildShell),
      }).catch((error) => addLog("Entorno", "error", error.message));
    },

    rebuildShell({ projectId }) {
      environmentService.rebuildShellServer(projectId).catch(() => {});
    },

    stop(reason) {
      return cancelAndStopAll(reason);
    },
  };
}
