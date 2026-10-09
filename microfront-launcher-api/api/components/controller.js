import { launcherService } from '../../services/launcher-service.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

export function createComponentsController() {
  async function start(request, response, next) {
    try {
      const result = await launcherService.startComponents();
      response.json({ ...result, message: `Components disponible en ${result.url}` });
    } catch (error) {
      next(error);
    }
  }

  async function stop(request, response, next) {
    try {
      const state = RuntimeStateService.getState();
      if (state.shell.status !== 'stopped') {
        await launcherService.stopEnvironment('Entorno detenido');
        response.json({ ok: true, message: 'Shell y Components detenidos.' });
        return;
      }
      await launcherService.stopComponents();
      response.json({ ok: true, message: 'Servidor de Components detenido.' });
    } catch (error) {
      next(error);
    }
  }

  return {
    start,
    stop,
  };
}
