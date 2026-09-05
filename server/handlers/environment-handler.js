export function createEnvironmentHandler({ runEnvironment, rebuildShellServer, cancelAndStopAll, addLog, readBody, json }) {
  return async function handleEnvironmentRequest(request, response, url) {
    if (request.method !== 'POST') return false;
    if (url.pathname === '/api/environment/start') {
      const { projectId, microfrontendId, rebuildShell } = await readBody(request);
      runEnvironment(projectId, { microfrontendId, rebuildShell: Boolean(rebuildShell) }).catch((error) => addLog('Entorno', 'error', error.message));
      json(response, 202, { ok: true });
      return true;
    }
    if (url.pathname === '/api/shell/rebuild') {
      const { projectId } = await readBody(request);
      rebuildShellServer(projectId).catch(() => {});
      json(response, 202, { ok: true, message: 'Reconstrucción del servidor iniciada.' });
      return true;
    }
    if (url.pathname === '/api/environment/cancel' || url.pathname === '/api/environment/stop') {
      await cancelAndStopAll(url.pathname.endsWith('cancel') ? 'Inicio cancelado' : 'Entorno detenido');
      json(response, 200, { ok: true });
      return true;
    }
    return false;
  };
}
