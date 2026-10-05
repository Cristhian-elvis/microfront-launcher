import { json, Router } from 'express';

export function createEnvironmentRouter({ environmentModel }) {
  const router = Router();

  router.post('/environment/start', json(), (request, response) => {
    const { projectId, microfrontendId, rebuildShell } = request.body;
    environmentModel.start({ projectId, microfrontendId, rebuildShell });
    response.status(202).json({ ok: true });
  });

  router.post('/shell/rebuild', json(), (request, response) => {
    environmentModel.rebuildShell({ projectId: request.body.projectId });
    response.status(202).json({
      ok: true,
      message: 'Reconstrucción del servidor iniciada.',
    });
  });

  router.post('/environment/cancel', json(), async (request, response) => {
    await environmentModel.stop('Inicio cancelado');
    response.json({ ok: true });
  });

  router.post('/environment/stop', json(), async (request, response) => {
    await environmentModel.stop('Entorno detenido');
    response.json({ ok: true });
  });

  return router;
}
