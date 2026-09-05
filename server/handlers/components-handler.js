export function createComponentsHandler({ state, startComponents, stopComponents, stopEnvironment, json }) {
  return async function handleComponentsRequest(request, response, url) {
    if (request.method === 'POST' && url.pathname === '/api/components/start') {
      const result = await startComponents();
      json(response, 200, { ...result, message: `Components disponible en ${result.url}` });
      return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/components/stop') {
      if (state.shell.status !== 'stopped') {
        await stopEnvironment('Entorno detenido');
        json(response, 200, { ok: true, message: 'Shell y Components detenidos.' });
      } else {
        await stopComponents();
        json(response, 200, { ok: true, message: 'Servidor de Components detenido.' });
      }
      return true;
    }
    return false;
  };
}
