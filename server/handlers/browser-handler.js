export function createBrowserHandler({ state, reopenChrome, openEmptyBrowser, readConfig, writeJson, configPath, emitState, readBody, json }) {
  return async function handleBrowserRequest(request, response, url) {
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/chrome/')) return false;
    if (url.pathname === '/api/chrome/open') {
      const { mode, remember } = await readBody(request);
      if (!['tab', 'window'].includes(mode)) { json(response, 400, { error: 'Indica si deseas abrir una pestaña o una ventana.' }); return true; }
      await reopenChrome({ newWindow: mode === 'window' });
      if (remember === undefined) {
        json(response, 200, { ok: true, message: 'Navegador abierto.' });
        return true;
      }
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
