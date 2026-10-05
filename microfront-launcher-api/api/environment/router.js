/**
 * Router exclusivo del recurso environment.
 * Devuelve false cuando la ruta no pertenece a este dominio para que el router
 * principal pueda continuar con los demás módulos.
 */
export function createEnvironmentRouter(handler) {
  const routes = new Map([
    ["/api/environment/start", handler.start],
    ["/api/shell/rebuild", handler.rebuildShell],
    ["/api/environment/cancel", handler.cancel],
    ["/api/environment/stop", handler.stop],
  ]);

  return async function routeEnvironment(request, response, url) {
    const route = routes.get(url.pathname);
    if (!route) return false;
    await route(request, response);
    return true;
  };
}
