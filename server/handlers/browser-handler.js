export function createBrowserHandler({ state, getProjects, openOrRequestBrowser, reopenChrome, openEmptyBrowser, readConfig, writeJson, configPath, emitState, readBody, json }) {
  return async function handleBrowserRequest(request, response, url) {
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/chrome/')) return false;
    if (url.pathname === '/api/chrome/open') {
      const { mode, remember } = await readBody(request);
      if (remember === undefined) {
        if (state.shell.status !== 'running' || !state.shell.projectId) throw new Error('No hay una shell activa para abrir en el navegador.');
        await openOrRequestBrowser(getProjects().find((item) => item.id === state.shell.projectId));
        json(response, 200, { ok: true, message: state.browserPrompt ? 'Elige cómo abrir el navegador.' : 'Navegador abierto.' });
        return true;
      }
      if (!['tab', 'window'].includes(mode)) { json(response, 400, { error: 'Indica si deseas abrir una pestaña o una ventana.' }); return true; }
      await reopenChrome({ newWindow: mode === 'window' });
      if (remember) { const config = readConfig(); writeJson(configPath, { ...config, chrome: { ...config.chrome, openMode: mode } }); }
      state.browserPrompt = null; emitState();
      json(response, 200, { ok: true, message: 'Navegador abierto.' });
      return true;
    }
    if (url.pathname === '/api/chrome/open-empty') { await openEmptyBrowser(); json(response, 200, { ok: true }); return true; }
    if (url.pathname === '/api/chrome/dismiss') { state.browserPrompt = null; emitState(); json(response, 200, { ok: true }); return true; }
    return false;
  };
}
