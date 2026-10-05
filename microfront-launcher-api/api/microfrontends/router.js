import { json, Router } from 'express';
import { getProjects } from '../../lib/core.js';
import {
  openMicrofrontendFolder,
  stopMicrofrontendWatch,
} from '../../operations/microfrontend-ops.js';

async function findMicrofrontend(projectId, microfrontendId) {
  const project = (await getProjects()).find((item) => item.id === projectId);
  const microfrontend = project?.microfrontends?.find(
    (item) => item.id === microfrontendId,
  );
  if (!microfrontend) throw new Error('No se encontró el microfrontend solicitado.');
  return { project, microfrontend };
}

export function createMicrofrontendsRouter({
  buildMicrofrontend,
  openMicrofrontend,
  startBranchBatch,
  startBranchSwitch,
  startBuildBatch,
  startWatch,
}) {
  const router = Router();

  router.post('/microfrontends/open', json(), async (request, response) => {
    await openMicrofrontend(request.body?.projectId, request.body?.microfrontendId);
    response.json({ ok: true, message: 'Microfrontend abierto en VS Code.' });
  });
  router.post('/microfrontends/open-folder', json(), async (request, response) => {
    await openMicrofrontendFolder(request.body?.projectId, request.body?.microfrontendId);
    response.json({ ok: true, message: 'Carpeta del microfrontend abierta.' });
  });
  router.post('/microfrontends/build', json(), async (request, response) => {
    const { projectId, microfrontendId } = request.body ?? {};
    const { project, microfrontend } = await findMicrofrontend(projectId, microfrontendId);
    buildMicrofrontend(project, microfrontend);
    response.status(202).json({
      ok: true,
      message: `Compilación iniciada para ${microfrontend.name}.`,
    });
  });
  router.post('/microfrontends/build-batch', json(), (request, response) => {
    const { projectId, microfrontendIds } = request.body ?? {};
    startBuildBatch(projectId, microfrontendIds);
    response.status(202).json({ ok: true, message: 'Compilación por lote iniciada.' });
  });
  router.post('/microfrontends/branch', json(), (request, response) => {
    const { projectId, microfrontendId, branch } = request.body ?? {};
    startBranchSwitch(projectId, microfrontendId, String(branch || ''));
    response.status(202).json({ ok: true, message: `Cambio a ${branch} iniciado.` });
  });
  router.post('/microfrontends/branch-batch', json(), (request, response) => {
    const { projectId, microfrontendIds, branch } = request.body ?? {};
    startBranchBatch(projectId, microfrontendIds, String(branch || ''));
    response.status(202).json({ ok: true, message: `Cambio a ${branch} iniciado.` });
  });
  router.post('/microfrontends/watch', json(), async (request, response) => {
    const { projectId, microfrontendId } = request.body ?? {};
    const { project, microfrontend } = await findMicrofrontend(projectId, microfrontendId);
    startWatch(project, microfrontend);
    response.status(202).json({ ok: true, message: 'Watch iniciado para el microfrontend.' });
  });
  router.post('/microfrontends/watch/stop', json(), (request, response) => {
    const { projectId, microfrontendId } = request.body ?? {};
    const stopped = stopMicrofrontendWatch(projectId, microfrontendId);
    response.json({
      ok: true,
      message: stopped ? 'Watch detenido.' : 'El watch no estaba activo.',
    });
  });

  return router;
}
