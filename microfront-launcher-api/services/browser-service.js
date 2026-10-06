import fs from 'node:fs';
import { spawn } from 'node:child_process';

function browserSettings(config, mode = config.browser.selected) {
  const isEdge = mode.startsWith('edge');
  const insecure = mode.endsWith('-insecure');
  return {
    name: isEdge ? 'Edge' : 'Chrome',
    path: isEdge ? config.browser.edge.path : config.browser.chrome.path,
    userDataDir: isEdge
      ? config.browser.edge.userDataDir
      : config.browser.chrome.userDataDir,
    insecure,
  };
}

export function createBrowserService({ addLog, readConfig }) {
  async function open(project, { newWindow = true, url = null, browserMode = null } = {}) {
    const config = readConfig();
    const browser = browserSettings(config, browserMode ?? undefined);
    if (!fs.existsSync(browser.path)) {
      throw new Error(`No se encontró ${browser.name}: ${browser.path}`);
    }

    const browserUrl = url
      ? new URL(url)
      : project
        ? new URL(project.url)
        : new URL('chrome://newtab/');
    if (!url && project) {
      browserUrl.hostname = config.browser.openHost;
      browserUrl.port = String(config.shellDefaults.serverPort || 8080);
    }

    const args = [
      ...(browser.insecure
        ? [`--user-data-dir=${browser.userDataDir}`, '--disable-web-security']
        : []),
      ...(newWindow ? ['--new-window'] : []),
      browserUrl.toString(),
    ];
    await new Promise((resolve, reject) => {
      const child = spawn(browser.path, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
    addLog(browser.name, 'system', `Ejecutando: "${browser.path}" ${args.join(' ')}`);
  }

  return { open };
}
