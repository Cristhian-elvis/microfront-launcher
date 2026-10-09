import { environmentModel } from '../../services/launcher-service.js';

function startEnvironment(request, response) {
  const { projectId, microfrontendId, rebuildShell } = request.body;

  environmentModel.start({ projectId, microfrontendId, rebuildShell });
  response.status(202).json({ ok: true });
}

function rebuildShell(request, response) {
  environmentModel.rebuildShell({ projectId: request.body.projectId });

  response.status(202).json({
    ok: true,
    message: 'Reconstrucción del servidor iniciada.',
  });
}

async function cancelEnvironment(request, response) {
  await environmentModel.stop('Inicio cancelado');
  response.json({ ok: true });
}

async function stopEnvironment(request, response) {
  await environmentModel.stop('Entorno detenido');
  response.json({ ok: true });
}

export const environmentController = {
  cancelEnvironment,
  rebuildShell,
  startEnvironment,
  stopEnvironment,
};
