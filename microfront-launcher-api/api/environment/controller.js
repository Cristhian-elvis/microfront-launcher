import { EnvironmentLifecycleService } from './lifecycle.js';
import {
  prepareShellServerInBackground,
  startInBackground,
} from './service.js';

function startEnvironment(request, response) {
  const { projectId, microfrontendId, rebuildShell } = request.body;

  startInBackground(projectId, { microfrontendId, rebuildShell });
  response.status(202).json({ ok: true });
}

function prepareShell(request, response) {
  const {
    projectId, libs, remotes, link, syncGit, forceBuild, skipBuild, skipCheck, localMode, buildLocal,
  } = request.body;

  prepareShellServerInBackground(projectId, {
    libs, remotes, link, syncGit, forceBuild, skipBuild, skipCheck, localMode, buildLocal,
  });

  response.status(202).json({
    ok: true,
    message: 'Preparación del servidor iniciada.',
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
  prepareShell,
  startEnvironment,
  stopEnvironment,
};
