import { execFile } from 'node:child_process';
import { json, Router } from 'express';
import {
  completeInitialSetup,
  configPath,
  getProjects,
  invalidateScanCache,
  readConfig,
  refreshProjects,
  syncProject,
  writeJson,
} from '../../lib/core.js';

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(String(stderr || error.message).trim()));
        resolve(String(stdout || '').trim());
      });
  });
}

function saveConfig(body, response, { removeLegacyFields = false } = {}) {
  const current = readConfig();
  const next = {
    ...current,
    ...body,
    mova: { ...current.mova, ...(body.mova || {}) },
    browser: { ...current.browser, ...(body.browser || {}) },
  };
  delete next.chrome;
  delete next.projects;
  delete next.hiddenProjects;

  if (!String(next.rootPath || '').trim()
    || !String(next.mova.sourcePath || '').trim()
    || !String(next.mova.cdnHost || '').trim()
    || !String(next.mova.stencilComponentsFolderName || '').trim()) {
    response.status(400).json({
      error: 'La raíz de shells, el repositorio MOVA, el CDN y la carpeta Stencil son obligatorios.',
    });
    return false;
  }

  if (removeLegacyFields) {
    delete next.mova.componentPort;
    delete next.preferences;
  }
  writeJson(configPath, next);
  invalidateScanCache();
  completeInitialSetup();
  response.json({ ok: true });
  return true;
}

export function createProjectsRouter({
  getProjectGitInfo,
  openProjectWebapp,
  openScaffolding,
  selectLocalDirectory,
}) {
  const router = Router();

  router.post('/setup', json(), (request, response) => {
    saveConfig(request.body ?? {}, response);
  });
  router.put('/config', json(), (request, response) => {
    saveConfig(request.body ?? {}, response, { removeLegacyFields: true });
  });
  router.get('/projects', async (request, response) => {
    response.json(await getProjects({ force: request.query.refresh === '1' }));
  });
  router.post('/projects/refresh', async (request, response) => {
    response.json(await refreshProjects());
  });
  router.get('/projects/:projectId/git-info', async (request, response) => {
    response.json(await getProjectGitInfo(request.params.projectId));
  });
  router.get('/projects/:projectId/refresh', async (request, response) => {
    const project = await syncProject(request.params.projectId);
    await Promise.all((project.microfrontends || []).map(async (microfront) => {
      try {
        const localCommit = await runGit(['rev-parse', 'HEAD'], microfront.path);
        const remoteCommit = await runGit(
          ['rev-parse', `origin/${microfront.branch}`],
          microfront.path,
        );
        microfront.outOfSync = localCommit !== remoteCommit;
      } catch {
        microfront.outOfSync = false;
      }
    }));
    response.json(project);
  });
  router.get('/projects/:projectId', async (request, response) => {
    const projects = await getProjects({ force: false });
    const project = projects.find((item) => item.id === request.params.projectId);
    if (!project) {
      response.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    response.json(project);
  });
  router.post('/projects/scaffolding', json(), (request, response) => {
    openScaffolding(request.body?.projectId);
    response.json({
      ok: true,
      message: 'Completa la configuración en la terminal y luego pulsa Actualizar.',
    });
  });
  router.post('/projects/open-webapp', json(), async (request, response) => {
    await openProjectWebapp(request.body?.projectId);
    response.json({ ok: true, message: 'Webapp asociada abierta en VS Code.' });
  });
  router.post('/dialogs/select-directory', json(), async (request, response) => {
    const description = request.body?.target === 'mova'
      ? 'Selecciona el repositorio MOVA UI Components'
      : 'Selecciona la carpeta raíz de tus shells';
    response.json({ path: await selectLocalDirectory(description) });
  });

  return router;
}
