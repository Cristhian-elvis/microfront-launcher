import {
  completeInitialSetup,
  configPath,
  getProjectDetails,
  getProjectMicrofrontends as getProjectMicrofrontendsOperation,
  getProjects,
  invalidateScanCache,
  readConfig,
  refreshProjects,
  writeJson,
} from '../../lib/core.js';
import { selectLocalDirectory } from '../../services/local-directory-picker-service.js';
import { openScaffolding as openScaffoldingOperation } from '../../services/project-scaffolding-service.js';
import { openInFileExplorer, openInTerminal, openInVsCode } from '../../services/vscode-service.js';

function saveConfig(body, response, { removeLegacyFields = false } = {}) {
  const current = readConfig();
  const mova = {
    ...current.mova,
    ...(body.mova || {}),
    config: {
      ...current.mova?.config,
      ...(body.mova?.config || {}),
    },
  };
  const next = {
    ...current,
    ...body,
    environment: { ...current.environment, ...(body.environment || {}) },
    mova,
    browser: { ...current.browser, ...(body.browser || {}) },
  };

  delete next.projects;
  delete next.hiddenProjects;

  const movaConfig = next.mova.config || {};
  const requiresLocalMovaConfiguration = next.mova.include === true;
  const hasRequiredMovaConfiguration = !requiresLocalMovaConfiguration || (
    String(movaConfig.sourcePath || '').trim()
    && String(movaConfig.stencil || '').trim()
  );

  if (!String(next.environment.rootPath || '').trim() || !hasRequiredMovaConfiguration) {
    response.status(400).json({
      error: 'El directorio de shells es obligatorio. Cuando MOVA local está incluido, también son obligatorios su repositorio y Stencil.',
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

async function getProject(request, response) {
  const project = await getProjectDetails(request.params.projectId);

  if (!project) {
    response.status(404).json({ error: 'Proyecto no encontrado' });
    return;
  }

  response.json(project);
}

async function getProjectMicrofrontends(request, response) {
  const microfrontends = await getProjectMicrofrontendsOperation(request.params.projectId);

  if (!microfrontends) {
    response.status(404).json({ error: 'Proyecto no encontrado' });
    return;
  }

  response.json(microfrontends);
}

function openScaffolding(request, response) {
  void openScaffoldingOperation(request.body?.projectId);
  response.json({
    ok: true,
    message: 'Completa la configuración en la terminal y luego pulsa Actualizar.',
  });
}

async function openProjectTarget(request, response) {
  const target = request.body?.target;
  const action = request.body?.action;
  if (action === 'vscode') {
    await openInVsCode(request.params.projectId, target?.type, target?.id);
    response.json({ ok: true, message: 'Destino abierto en VS Code.' });
    return;
  }

  if (action === 'folder') {
    await openInFileExplorer(request.params.projectId, target?.type, target?.id);
    response.json({ ok: true, message: 'Carpeta abierta.' });
    return;
  }

  if (action === 'terminal') {
    await openInTerminal(request.params.projectId, target?.type, target?.id);
    response.json({ ok: true, message: 'Terminal abierta.' });
    return;
  }

  response.status(400).json({ error: 'La acción solicitada no es válida.' });
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
  getProjectMicrofrontends,
  listProjects,
  openProjectTarget,
  openScaffolding,
  refreshProjectList,
  selectDirectory,
  setup,
  updateConfig,
};
