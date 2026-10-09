import { EnvironmentLifecycleService } from './lifecycle.js';
import {
  rebuildShellInBackground,
  startInBackground,
} from './service.js';

function startEnvironment(request, response) {
  const { projectId, microfrontendId, rebuildShell } = request.body;

  startInBackground(projectId, { microfrontendId, rebuildShell });
  response.status(202).json({ ok: true });
}

function rebuildShell(request, response) {
  rebuildShellInBackground(request.body.projectId);

  response.status(202).json({
    ok: true,
    message: 'Reconstrucción del servidor iniciada.',
  });
}

async function cancelEnvironment(request, response) {
  await EnvironmentLifecycleService.stopEnvironmentInternals({
    reason: 'Inicio cancelado',
    emitFinalSession: true,
  });
  response.json({ ok: true });
}

async function stopEnvironment(request, response) {
  await EnvironmentLifecycleService.stopEnvironmentInternals({
    reason: 'Entorno detenido',
    emitFinalSession: true,
  });
  response.json({ ok: true });
}

export const environmentController = {
  cancelEnvironment,
  rebuildShell,
  startEnvironment,
  stopEnvironment,
};
