import { Router } from 'express';

export function createComponentsRouter({
  startComponents,
  state,
  stopComponents,
  stopEnvironment,
}) {
  const router = Router();

  router.post('/components/start', async (request, response) => {
    const result = await startComponents();
    response.json({ ...result, message: `Components disponible en ${result.url}` });
  });
  router.post('/components/stop', async (request, response) => {
    if (state.shell.status !== 'stopped') {
      await stopEnvironment('Entorno detenido');
      response.json({ ok: true, message: 'Shell y Components detenidos.' });
      return;
    }
    await stopComponents();
    response.json({ ok: true, message: 'Servidor de Components detenido.' });
  });

  return router;
}
