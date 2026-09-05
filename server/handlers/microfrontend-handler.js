export function createMicrofrontendHandler({
  getProjects, openMicrofrontend, openMicrofrontendFolder, buildMicrofrontend,
  startBuildBatch, startBranchSwitch, startBranchBatch, startWatch, stopWatch,
  readBody, json,
}) {
  return async function handleMicrofrontendRequest(request, response, url) {
    if (!url.pathname.startsWith('/api/microfrontends/')) return false;
    const body = await readBody(request);
    const { projectId, microfrontendId, microfrontendIds, branch } = body;
    if (request.method !== 'POST') return false;
    if (url.pathname === '/api/microfrontends/open') {
      await openMicrofrontend(projectId, microfrontendId);
      json(response, 200, { ok: true, message: 'Microfrontend abierto en VS Code.' });
    } else if (url.pathname === '/api/microfrontends/open-folder') {
      await openMicrofrontendFolder(projectId, microfrontendId);
      json(response, 200, { ok: true, message: 'Carpeta del microfrontend abierta.' });
    } else if (url.pathname === '/api/microfrontends/build') {
      const project = getProjects().find((item) => item.id === projectId);
      const microfrontend = project?.microfrontends?.find((item) => item.id === microfrontendId);
      if (!microfrontend) throw new Error('No se encontró el microfrontend solicitado.');
      buildMicrofrontend(project, microfrontend);
      json(response, 202, { ok: true, message: `Compilación iniciada para ${microfrontend.name}.` });
    } else if (url.pathname === '/api/microfrontends/build-batch') {
      startBuildBatch(projectId, microfrontendIds);
      json(response, 202, { ok: true, message: 'Compilación por lote iniciada.' });
    } else if (url.pathname === '/api/microfrontends/branch') {
      startBranchSwitch(projectId, microfrontendId, String(branch || ''));
      json(response, 202, { ok: true, message: `Cambio a ${branch} iniciado.` });
    } else if (url.pathname === '/api/microfrontends/branch-batch') {
      startBranchBatch(projectId, microfrontendIds, String(branch || ''));
      json(response, 202, { ok: true, message: `Cambio a ${branch} iniciado.` });
    } else if (url.pathname === '/api/microfrontends/watch') {
      const project = getProjects().find((item) => item.id === projectId);
      const microfrontend = project?.microfrontends?.find((item) => item.id === microfrontendId);
      if (!microfrontend) throw new Error('No se encontró el microfrontend solicitado.');
      startWatch(project, microfrontend);
      json(response, 202, { ok: true, message: 'Watch iniciado para el microfrontend.' });
    } else if (url.pathname === '/api/microfrontends/watch/stop') {
      const stopped = stopWatch(projectId, microfrontendId);
      json(response, 200, { ok: true, message: stopped ? 'Watch detenido.' : 'El watch no estaba activo.' });
    } else return false;
    return true;
  };
}
