import chokidar from 'chokidar';
import path from 'path';

function getGitPathsToWatch(projectPath) {
  const gitDir = path.join(projectPath, '.git');
  return [
    path.join(gitDir, 'HEAD'),
    path.join(gitDir, 'refs', 'heads'),
    path.join(gitDir, 'refs', 'remotes'),
    path.join(gitDir, 'packed-refs')
  ];
}

export function createGitWatcher({ getProjects, gitBranchInfo, emit, addLog }) {
  let watcher = null;
  const debounceTimers = new Map();
  const DEBOUNCE_DELAY = 500;
  
  // OPTIMIZACIÓN: Diccionario para búsqueda O(1) de microfrontends
  const mfPathDictionary = new Map();

  async function handleGitChange(filePath) {
    // Extraemos la ruta raíz del microfrontend a partir de la ruta del archivo Git modificado
    // Ej: "C:/proyecto/.git/HEAD" -> "C:/proyecto"
    const gitDirMatch = filePath.match(/(.*?)[\\/]\.git[\\/]/);
    if (!gitDirMatch) return;
    
    // Buscamos directamente en el diccionario en lugar de hacer bucles
    const mfRootPath = path.normalize(gitDirMatch[1]);
    const changedMicrofrontend = mfPathDictionary.get(mfRootPath);

    if (!changedMicrofrontend) return;

    const { project, microfrontend } = changedMicrofrontend;
    const key = `${project.id}:${microfrontend.id}`;

    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
    }

    const timer = setTimeout(async () => {
      try {
        const git = await gitBranchInfo(microfrontend.path);
        
        // Emitimos el evento directamente
        emit('microfrontend-branch-changed', {
          projectId: project.id,
          microfrontendId: microfrontend.id,
          microfrontendName: microfrontend.name,
          branch: git.branch,
          branches: git.branches,
          changedAt: new Date().toISOString()
        });

        addLog('Git Watcher', 'success', `Rama actualizada: ${microfrontend.name} → ${git.branch}`);
      } catch (error) {
        addLog('Git Watcher', 'error', `Error al obtener rama de ${microfrontend.name}: ${error.message}`);
      } finally {
        debounceTimers.delete(key);
      }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(key, timer);
  }

  async function start() {
    if (watcher) return;

    try {
      const projects = await getProjects();
      const pathsToWatch = [];
      
      // Llenamos el diccionario y el array de rutas al mismo tiempo
      mfPathDictionary.clear();
      for (const project of projects) {
        for (const mf of project.microfrontends || []) {
          mfPathDictionary.set(path.normalize(mf.path), { project, microfrontend: mf });
          pathsToWatch.push(...getGitPathsToWatch(mf.path));
        }
      }

      if (pathsToWatch.length === 0) return;

      watcher = chokidar.watch(pathsToWatch, {
        persistent: true,
        ignoreInitial: true,
        depth: 2,
        disableGlobbing: true
      });

      watcher.on('all', (event, filePath) => {
        // CORRECCIÓN CRÍTICA: Solo ignoramos addDir. Permitimos 'add' para detectar nuevas ramas
        if (event === 'addDir') return;
        handleGitChange(filePath);
      });

      watcher.on('error', (error) => {
        addLog('Git Watcher', 'error', `Error en watcher: ${error.message}`);
      });
      
    } catch (error) {
      addLog('Git Watcher', 'error', `Fallo al iniciar watcher: ${error.message}`);
      throw error;
    }
  }

  function stop() {
    if (!watcher) return;
    for (const timer of debounceTimers.values()) clearTimeout(timer);
    debounceTimers.clear();
    mfPathDictionary.clear();
    watcher.close();
    watcher = null;
  }

  return { start, stop, isActive: () => watcher !== null };
}
