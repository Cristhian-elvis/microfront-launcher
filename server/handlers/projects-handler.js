import { execFile } from 'node:child_process';

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(String(stderr || error.message).trim()));
        resolve(String(stdout || '').trim());
      },
    );
  });
}

export function createProjectsHandler({
  getState, getProjects, readConfig, saveProject, hideProject, needsInitialSetup,
  completeInitialSetup, writeJson, configPath, selectLocalDirectory, openScaffolding,
  openProjectWebapp, gitBranchInfo,
  readBody, json,
}) {
  return async function handleProjectsRequest(request, response, url) {
    const { method, pathname } = request.method === 'OPTIONS' ? request : { method: request.method, pathname: url.pathname };
    if (method === 'GET' && pathname === '/api/config') { json(response, 200, readConfig()); return true; }
    if (method === 'GET' && pathname === '/api/setup') { json(response, 200, { required: needsInitialSetup() }); return true; }
    if (method === 'GET' && pathname === '/api/projects') { json(response, 200, getProjects({ force: url.searchParams.get('refresh') === '1' })); return true; }
    if (method === 'GET' && pathname.startsWith('/api/projects/') && !pathname.endsWith('/refresh')) {
      const projectId = decodeURIComponent(pathname.split('/')[3]);
      const projects = await getProjects({ force: false });
      const project = projects.find((item) => item.id === projectId);
      if (!project) { json(response, 404, { error: 'Proyecto no encontrado' }); return true; }
      json(response, 200, project);
      return true;
    }
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/refresh')) {
      const projectId = decodeURIComponent(pathname.split('/')[3]);
      const projects = await getProjects({ force: true });
      const project = projects.find((item) => item.id === projectId);
      if (!project) { json(response, 404, { error: 'Proyecto no encontrado' }); return true; }
      // Actualizar ramas de todos los microfronts en paralelo y detectar cambios pendientes
      if (project.microfrontends?.length) {
        await Promise.all(project.microfrontends.map(async (microfront) => {
          const gitInfo = await gitBranchInfo(microfront.path);
          microfront.branch = gitInfo.branch;
          microfront.branches = gitInfo.branches;
          
          // Detectar si hay cambios pendientes por descargar
          try {
            await runGit(['fetch', '--all', '--prune'], microfront.path);
            const localCommit = await runGit(['rev-parse', 'HEAD'], microfront.path);
            const remoteCommit = await runGit(['rev-parse', `origin/${gitInfo.branch}`], microfront.path);
            microfront.outOfSync = localCommit !== remoteCommit;
          } catch (error) {
            microfront.outOfSync = false;
          }
        }));
      }
      json(response, 200, project);
      return true;
    }
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
