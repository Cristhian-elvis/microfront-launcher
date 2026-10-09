import { getIndexedProject } from '../../lib/core.js';
import {
  openMicrofrontendFolder as openMicrofrontendFolderOperation,
  stopMicrofrontendWatch as stopMicrofrontendWatchOperation,
} from '../../operations/microfrontend-ops.js';
import { launcherService } from '../../services/launcher-service.js';

function findMicrofrontend(projectId, microfrontendId) {
  const project = getIndexedProject(projectId);
  const microfrontend = project?.microfrontends?.find(
    (item) => item.id === microfrontendId,
  );

  if (!microfrontend) {
    throw new Error('No se encontró el microfrontend solicitado.');
  }

  return { project, microfrontend };
}

async function openMicrofrontend(request, response) {
  await launcherService.openMicrofrontend(
    request.body?.projectId,
    request.body?.microfrontendId,
  );

  response.json({ ok: true, message: 'Microfrontend abierto en VS Code.' });
}

async function openMicrofrontendFolder(request, response) {
  await openMicrofrontendFolderOperation(
    request.body?.projectId,
    request.body?.microfrontendId,
  );

  response.json({ ok: true, message: 'Carpeta del microfrontend abierta.' });
}

async function buildMicrofrontend(request, response) {
  const { projectId, microfrontendId } = request.body ?? {};
  const { project, microfrontend } = findMicrofrontend(projectId, microfrontendId);

  launcherService.buildMicrofrontend(project, microfrontend);

  response.status(202).json({
    ok: true,
    message: `Compilación iniciada para ${microfrontend.name}.`,
  });
}

function buildMicrofrontendBatch(request, response) {
  const { projectId, microfrontendIds } = request.body ?? {};

  launcherService.startBuildBatch(projectId, microfrontendIds);

  response.status(202).json({ ok: true, message: 'Compilación por lote iniciada.' });
}

function switchMicrofrontendBranch(request, response) {
  const { projectId, microfrontendId, branch } = request.body ?? {};

  launcherService.startBranchSwitch(
    projectId,
    microfrontendId,
    String(branch || ''),
  );

  response.status(202).json({
    ok: true,
    message: `Cambio a ${branch} iniciado.`,
  });
}

function switchMicrofrontendBranchBatch(request, response) {
  const { projectId, microfrontendIds, branch } = request.body ?? {};

  launcherService.startBranchBatch(
    projectId,
    microfrontendIds,
    String(branch || ''),
  );

  response.status(202).json({
    ok: true,
    message: `Cambio a ${branch} iniciado.`,
  });
}

async function startMicrofrontendWatch(request, response) {
  const { projectId, microfrontendId } = request.body ?? {};
  const { project, microfrontend } = findMicrofrontend(projectId, microfrontendId);

  launcherService.startWatch(project, microfrontend);

  response.status(202).json({
    ok: true,
    message: 'Watch iniciado para el microfrontend.',
  });
}

function stopMicrofrontendWatch(request, response) {
  const { projectId, microfrontendId } = request.body ?? {};
  const stopped = stopMicrofrontendWatchOperation(projectId, microfrontendId);

  response.json({
    ok: true,
    message: stopped ? 'Watch detenido.' : 'El watch no estaba activo.',
  });
}

export const microfrontendsController = {
  buildMicrofrontend,
  buildMicrofrontendBatch,
  openMicrofrontend,
  openMicrofrontendFolder,
  startMicrofrontendWatch,
  stopMicrofrontendWatch,
  switchMicrofrontendBranch,
  switchMicrofrontendBranchBatch,
};
