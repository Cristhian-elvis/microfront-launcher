import { execFile } from 'node:child_process';

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
import { selectLocalDirectory } from '../../services/local-directory-picker-service.js';
import { getProjectGitInfo as getProjectGitInfoOperation } from '../../services/project-git-service.js';
import { openScaffolding as openScaffoldingOperation } from '../../services/project-scaffolding-service.js';
import { openProjectWebappInVsCode } from '../../services/vscode-service.js';

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message).trim()));
          return;
        }
        resolve(String(stdout || '').trim());
      },
    );
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

  if (
    !String(next.rootPath || '').trim()
    || !String(next.mova.sourcePath || '').trim()
    || !String(next.mova.cdnHost || '').trim()
    || !String(next.mova.stencilComponentsFolderName || '').trim()
  ) {
    response.status(400).json({
      error: 'La raíz de shells, el repositorio MOVA, el CDN y la carpeta Stencil son obligatorios.',
    });
    return;
  }

  if (removeLegacyFields) {
    delete next.mova.componentPort;
    delete next.preferences;
  }

  writeJson(configPath, next);
  invalidateScanCache();
  completeInitialSetup();
  response.json({ ok: true });
}

async function setup(request, response) {
  saveConfig(request.body ?? {}, response);
}

async function updateConfig(request, response) {
  saveConfig(request.body ?? {}, response, { removeLegacyFields: true });
}

async function listProjects(request, response) {
  response.json(await getProjects({ force: request.query.refresh === '1' }));
}

async function refreshProjectList(request, response) {
  response.json(await refreshProjects());
}

async function getProjectGitInfo(request, response) {
  response.json(
    await getProjectGitInfoOperation(request.params.projectId),
  );
}

async function refreshProject(request, response) {
  const project = await syncProject(request.params.projectId);

  await Promise.all(
    (project.microfrontends || []).map(async (microfront) => {
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
    }),
  );

  response.json(project);
}

async function getProject(request, response) {
  const projects = await getProjects({ force: false });
  const project = projects.find((item) => item.id === request.params.projectId);

  if (!project) {
    response.status(404).json({ error: 'Proyecto no encontrado' });
    return;
  }

  response.json(project);
}

function openScaffolding(request, response) {
  void openScaffoldingOperation(request.body?.projectId);
  response.json({
    ok: true,
    message: 'Completa la configuración en la terminal y luego pulsa Actualizar.',
  });
}

async function openProjectWebapp(request, response) {
  await openProjectWebappInVsCode(request.body?.projectId);
  response.json({ ok: true, message: 'Webapp asociada abierta en VS Code.' });
}

async function selectDirectory(request, response) {
  const description = request.body?.target === 'mova'
    ? 'Selecciona el repositorio MOVA UI Components'
    : 'Selecciona la carpeta raíz de tus shells';

  response.json({
    path: await selectLocalDirectory(description),
  });
}

export const projectsController = {
  getProject,
  getProjectGitInfo,
  listProjects,
  openProjectWebapp,
  openScaffolding,
  refreshProject,
  refreshProjectList,
  selectDirectory,
  setup,
  updateConfig,
};
