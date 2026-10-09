import {
  startComponentsInBackground,
  stopComponents,
} from '../../application/components/components-use-cases.js';
import { EnvironmentLifecycleService } from '../../api/environment/lifecycle.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';

export function createComponentsController() {
  function start(request, response, next) {
    try {
      startComponentsInBackground();
      response.status(202).json({
        ok: true,
        message: 'Inicio de MOVA Components solicitado.',
      });
    } catch (error) {
      next(error);
    }
  }

  async function stop(request, response, next) {
    try {
      const state = RuntimeStateService.getState();
      if (state.shell.status !== 'stopped') {
        await EnvironmentLifecycleService.stopEnvironmentInternals({
          reason: 'Entorno detenido',
          emitFinalSession: true,
        });
        response.json({ ok: true, message: 'Shell y Components detenidos.' });
        return;
      }
      await stopComponents();
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
