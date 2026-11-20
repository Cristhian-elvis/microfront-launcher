import {
  startMicrofrontendBranchBatch,
  startMicrofrontendBranchSwitch,
} from '../../application/microfrontends/branch-use-cases.js';
import { getIndexedProject } from '../../lib/core.js';
import {
  stopMicrofrontendWatch as stopMicrofrontendWatchOperation,
} from '../../operations/microfrontend-ops.js';
import {
  checkMicrofrontends as checkMicrofrontendsOperation,
} from '../../services/microfrontend-build-service.js';
import { MicrofrontendRuntimeService } from '../../services/microfrontend-runtime-service.js';

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

function checkMicrofrontends(request, response) {
  const { projectId, microfrontendIds, syncGit, forceBuild, skipBuild, skipCheck, localMode } =
    request.body ?? {};

  checkMicrofrontendsOperation(projectId, microfrontendIds, {
    syncGit,
    forceBuild,
    skipBuild,
    skipCheck,
    localMode,
  });

  response.status(202).json({ ok: true, message: 'Chequeo de microfronts iniciado.' });
}

function switchMicrofrontendBranch(request, response) {
  const { projectId, microfrontendId, branch } = request.body ?? {};

  startMicrofrontendBranchSwitch(
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

  startMicrofrontendBranchBatch(
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

  MicrofrontendRuntimeService.startMicrofrontend(project, microfrontend);

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
  checkMicrofrontends,
  startMicrofrontendWatch,
  stopMicrofrontendWatch,
  switchMicrofrontendBranch,
  switchMicrofrontendBranchBatch,
};
