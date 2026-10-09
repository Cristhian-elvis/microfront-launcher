import {
  configPath,
  getIndexedProject,
  readConfig,
  writeJson,
} from '../../lib/core.js';
import { state } from '../../state.js';
import { openBrowser as openBrowserService } from '../../services/browser-service.js';

function validMode(mode, response) {
  if (['tab', 'window'].includes(mode)) return true;

  response.status(400).json({
    error: 'Indica si deseas abrir una pestaña o una ventana.',
  });
  return false;
}

function validBrowserMode(browser, response) {
  if (
    browser === undefined
    || ['chrome', 'chrome-insecure', 'edge', 'edge-insecure'].includes(browser)
  ) {
    return true;
  }

  response.status(400).json({ error: 'El navegador seleccionado no es válido.' });
  return false;
}

async function openBrowser(request, response) {
  const { mode, remember, browser } = request.body ?? {};

  if (!validMode(mode, response) || !validBrowserMode(browser, response)) {
    return;
  }

  const project = state.shell.status === 'running' && state.shell.projectId
    ? getIndexedProject(state.shell.projectId)
    : null;

  if (state.shell.projectId && !project) {
    throw new Error('No se encontró la configuración de la shell activa.');
  }

  await openBrowserService(project, {
    newWindow: mode === 'window',
    browserMode: browser,
  });

  if (remember) {
    const config = readConfig();
    writeJson(configPath, {
      ...config,
      browser: { ...config.browser, openMode: mode },
    });
  }

  response.json({ ok: true, message: 'Navegador abierto.' });
}

async function openProfessionalBrowser(request, response) {
  const { mode } = request.body ?? {};

  if (!validMode(mode, response)) return;

  await openBrowserService(null, {
    newWindow: mode === 'window',
    url: 'https://gestiona.val.comunidad.madrid/hsta_webapp_profesional/inicio',
  });

  response.json({ ok: true, message: 'Navegador abierto.' });
}

async function openEmptyBrowser(request, response) {
  await openBrowserService(null);
  response.json({ ok: true });
}

export const browserController = {
  openBrowser,
  openEmptyBrowser,
  openProfessionalBrowser,
};
