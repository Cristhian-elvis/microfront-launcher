import { json, Router } from 'express';
import { configPath, readConfig, writeJson } from '../../lib/core.js';

function validMode(mode, response) {
  if (['tab', 'window'].includes(mode)) return true;
  response.status(400).json({
    error: 'Indica si deseas abrir una pestaña o una ventana.',
  });
  return false;
}

function validBrowserMode(browser, response) {
  if (browser === undefined || ['chrome', 'chrome-insecure', 'edge', 'edge-insecure'].includes(browser)) {
    return true;
  }
  response.status(400).json({ error: 'El navegador seleccionado no es válido.' });
  return false;
}

export function createBrowserRouter({ openEmptyBrowser, reopenChrome }) {
  const router = Router();

  router.post('/chrome/open', json(), async (request, response) => {
    const { mode, remember, browser } = request.body ?? {};
    if (!validMode(mode, response) || !validBrowserMode(browser, response)) return;
    await reopenChrome({ newWindow: mode === 'window', browserMode: browser });
    if (remember) {
      const config = readConfig();
      writeJson(configPath, {
        ...config,
        browser: { ...config.browser, openMode: mode },
      });
    }
    response.json({ ok: true, message: 'Navegador abierto.' });
  });
  router.post('/chrome/open-professional', json(), async (request, response) => {
    const { mode } = request.body ?? {};
    if (!validMode(mode, response)) return;
    await openEmptyBrowser({
      newWindow: mode === 'window',
      url: 'https://gestiona.val.comunidad.madrid/hsta_webapp_profesional/inicio',
    });
    response.json({ ok: true, message: 'Navegador abierto.' });
  });
  router.post('/chrome/open-empty', async (request, response) => {
    await openEmptyBrowser();
    response.json({ ok: true });
  });

  return router;
}
