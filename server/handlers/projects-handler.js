export function createProjectsHandler({
  getState, getProjects, readConfig, saveProject, hideProject, needsInitialSetup,
  completeInitialSetup, writeJson, configPath, selectLocalDirectory, openScaffolding,
  openProjectWebapp,
  readBody, json,
}) {
  return async function handleProjectsRequest(request, response, url) {
    const { method, pathname } = request.method === 'OPTIONS' ? request : { method: request.method, pathname: url.pathname };
    if (method === 'GET' && pathname === '/api/config') { json(response, 200, readConfig()); return true; }
    if (method === 'GET' && pathname === '/api/setup') { json(response, 200, { required: needsInitialSetup() }); return true; }
    if (method === 'GET' && pathname === '/api/projects') { json(response, 200, getProjects({ force: url.searchParams.get('refresh') === '1' })); return true; }
    if (method === 'PUT' && pathname === '/api/config') {
      const body = await readBody(request);
      const current = readConfig();
      const next = { ...current, ...body, mova: { ...current.mova, ...(body.mova || {}) }, projects: current.projects, hiddenProjects: current.hiddenProjects };
      delete next.mova.componentPort;
      writeJson(configPath, next);
      completeInitialSetup();
      json(response, 200, { ok: true });
      return true;
    }
    if (method === 'POST' && pathname === '/api/projects') { json(response, 200, saveProject(await readBody(request))); return true; }
    if (method === 'POST' && pathname === '/api/projects/scaffolding') {
      const { projectId } = await readBody(request);
      openScaffolding(projectId);
      json(response, 200, { ok: true, message: 'Completa la configuración en la terminal y luego pulsa Actualizar.' });
      return true;
    }
    if (method === 'POST' && pathname === '/api/projects/open-webapp') {
      const { projectId } = await readBody(request);
      await openProjectWebapp(projectId);
      json(response, 200, { ok: true, message: 'Webapp asociada abierta en VS Code.' });
      return true;
    }
    if (method === 'POST' && pathname === '/api/dialogs/select-directory') {
      const { target } = await readBody(request);
      const description = target === 'mova' ? 'Selecciona el repositorio MOVA UI Components' : 'Selecciona la carpeta raíz de tus shells';
      json(response, 200, { path: await selectLocalDirectory(description) });
      return true;
    }
    if (method === 'DELETE' && pathname.startsWith('/api/projects/')) {
      hideProject(decodeURIComponent(pathname.split('/').pop()));
      json(response, 200, { ok: true });
      return true;
    }
    return false;
  };
}
