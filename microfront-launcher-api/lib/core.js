// Reemplaza tus imports actuales por estos:
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(libDir, '..', '..');
export const configPath = path.join(appRoot, 'data', 'config.json');
function hasCompletedInitialSetup() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const movaIncluded = config.mova?.include === true;
    const movaConfig = config.mova?.config || {};

    return Boolean(
      String(config.environment?.rootPath || '').trim()
      && (!movaIncluded || (
        String(movaConfig.sourcePath || '').trim()
        && String(movaConfig.stencil || '').trim()
      )),
    );
  } catch {
    return false;
  }
}

let initialSetupRequired = !hasCompletedInitialSetup();
export const storageRoot = path.join(appRoot, 'storage');
export const preferencesPath = path.join(storageRoot, 'preferences.json');
export const movaStorageRoot = path.join(storageRoot, 'mova-components');
export const versionsRoot = path.join(movaStorageRoot, 'versions');
export const workRoot = path.join(movaStorageRoot, 'work');

export function ensureRuntimeDirectories() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(storageRoot, { recursive: true });
}

export const defaultConfig = {
  environment: {
    rootPath: '',
    serverPort: 8080,
    openHost: 'localhost',
    openMode: 'ask',
  },
  mova: {
    include: true,
    config: {
      automaticUpdate: true,
      sourcePath: '',
      stencil: '',
    },
  },
  browser: {
    selected: 'chrome-insecure',
    chrome: {
      path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      userDataDir: 'C:\\chrome-dev-data',
    },
    edge: {
      path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      userDataDir: 'C:\\msedge-dev-data',
    },
  }
};

export const defaultPreferences = {
  favoriteShellIds: [],
  favoriteMicrofrontIds: [],
};

export async function checkLauncherUpdates() {
  const gitOptions = { encoding: 'utf8', windowsHide: true };

  try {
    await execFileAsync('git', ['-C', appRoot, 'fetch', '--prune'], gitOptions);
    const { stdout: upstream } = await execFileAsync(
      'git',
      ['-C', appRoot, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      gitOptions,
    );
    const remoteBranch = upstream.trim();
    const { stdout: count } = await execFileAsync(
      'git',
      ['-C', appRoot, 'rev-list', '--count', `HEAD..${remoteBranch}`],
      gitOptions,
    );
    const behind = Number(count.trim()) || 0;

    return { behind, hasUpdates: behind > 0 };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudieron comprobar las actualizaciones del launcher: ${detail}`);
  }
}

export function needsInitialSetup() {
  return initialSetupRequired;
}

export function completeInitialSetup() {
  initialSetupRequired = false;
}

export function readJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return structuredClone(fallback); }
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temporary, filePath);
  fs.unlinkSync(temporary);
}

export function readConfig() {
  const saved = readJson(configPath, defaultConfig);

  return {
    ...defaultConfig,
    ...saved,
    environment: {
      ...defaultConfig.environment,
      ...saved.environment,
    },
    mova: {
      ...defaultConfig.mova,
      ...saved.mova,
      config: {
        ...defaultConfig.mova.config,
        ...saved.mova?.config,
      },
    },
    browser: {
      ...defaultConfig.browser,
      ...saved.browser,
      chrome: {
        ...defaultConfig.browser.chrome,
        ...saved.browser?.chrome,
      },
      edge: {
        ...defaultConfig.browser.edge,
        ...saved.browser?.edge,
      },
    },
  };
}

export function readPreferences() {
  const saved = readJson(preferencesPath, defaultPreferences);
  delete saved.storybookMode;
  delete saved.preferredTag;
  delete saved.componentsVersion;
  const preferences = { ...defaultPreferences, ...saved };
  delete preferences.avatarLetters;
  return {
    ...preferences,
    favoriteShellIds: Array.isArray(preferences.favoriteShellIds)
      ? preferences.favoriteShellIds
      : [],
    favoriteMicrofrontIds: Array.isArray(preferences.favoriteMicrofrontIds)
      ? preferences.favoriteMicrofrontIds
      : [],
  };
}

export function writePreferences(next) {
  const current = readPreferences();
  const value = {
    ...current,
    ...next,
  };
  delete value.preferredTag;
  delete value.componentsVersion;
  delete value.avatarLetters;
  writeJson(preferencesPath, value);
  return value;
}

export function projectId(projectPath) {
  return crypto.createHash('sha1').update(projectPath.toLowerCase()).digest('hex').slice(0, 12);
}

let scanCache = { rootPath: '', projects: null };
let projectIndex = new Map();

export async function gitBranchInfo(projectPath) {
  try {
    const gitOptions = { encoding: 'utf8', windowsHide: true };
    // Lanzamos ambos comandos de Git al mismo tiempo para máxima velocidad
    const [branchReq, refsReq] = await Promise.all([
      execFileAsync('git', ['-C', projectPath, 'branch', '--show-current'], gitOptions),
      execFileAsync('git', ['-C', projectPath, 'for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'], gitOptions),
    ]);

    const branch = branchReq.stdout.trim() || 'HEAD';
    const branches = [...new Set(refsReq.stdout.split(/\r?\n/)
      .filter((ref) => ref && ref !== 'HEAD' && ref !== 'origin'))].sort();
    return { branch, branches };
  } catch {
    return { branch: 'No disponible', branches: [] };
  }
}

/** Obtiene el estado local de Git sin acceder a red ni modificar el repositorio. */
async function gitWorkingTreeStatus(projectPath) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', projectPath, 'status', '--porcelain=v1', '--branch'],
      { encoding: 'utf8', windowsHide: true },
    );
    const [branchLine = '', ...changes] = stdout.split(/\r?\n/);
    const branch = branchLine.replace(/^##\s*/, '').split('...')[0].trim() || 'HEAD';

    return { branch, hasLocalChanges: changes.some(Boolean) };
  } catch {
    return { branch: 'No disponible', hasLocalChanges: false };
  }
}

/**
 * Obtiene únicamente la rama actual del repositorio, sin listar las ramas
 * locales/remotas disponibles. Útil cuando solo interesa el `HEAD` actual
 * (p. ej. tras un `checkout`).
 */
export async function currentGitBranch(projectPath) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', projectPath, 'symbolic-ref', '--short', '-q', 'HEAD'],
      { encoding: 'utf8', windowsHide: true },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function exactGitTag(repositoryPath) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repositoryPath, 'describe', '--tags', '--exact-match'],
      { encoding: 'utf8', windowsHide: true },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function shortGitCommit(repositoryPath) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repositoryPath, 'rev-parse', '--short', 'HEAD'],
      { encoding: 'utf8', windowsHide: true },
    );
    return stdout.trim() || 'No disponible';
  } catch {
    return 'No disponible';
  }
}

async function activeGitReference(repositoryPath) {
  const [branch, tag] = await Promise.all([
    currentGitBranch(repositoryPath),
    exactGitTag(repositoryPath),
  ]);
  if (branch) return { type: 'branch', name: branch };
  if (tag) return { type: 'tag', name: tag };

  return { type: 'detached', name: await shortGitCommit(repositoryPath) };
}

function isWebappDirectory(directory) {
  return /^[a-z0-9]{4}_webapp_.+$/i.test(path.basename(directory));
}

function isShellDirectory(directory) {
  return path.basename(directory).toLowerCase() === 'mova3_shell';
}

// MOVA considera enlazada una aplicación cuando su configuración está expuesta
// dentro de la shell. Descubrimos ese nombre sin validar el contenido: los
// scripts oficiales (prepare-server, build:local y local-server) siguen siendo
// los responsables de aceptar o rechazar la configuración al ejecutarse.
function linkedWebappInfo(shellPath) {
  const configRoot = path.join(shellPath, 'config');
  let entries = [];
  try {
    entries = fs.readdirSync(configRoot, { withFileTypes: true });
  } catch {
    return { appConfig: null, configFolder: null, webappPath: null };
  }

  const entry = entries.find(
    (candidate) => candidate.isDirectory() && isWebappDirectory(candidate.name),
  );
  if (!entry) return { appConfig: null, configFolder: null, webappPath: null };

  const configFolder = entry.name;
  const appConfigPath = path.join(configRoot, configFolder, 'app-config.json');
  const workspacePath = path.dirname(shellPath);
  const candidateWebappPath = path.join(workspacePath, configFolder);
  return {
    appConfig: fs.existsSync(appConfigPath) ? readJson(appConfigPath, null) : null,
    configFolder,
    webappPath: fs.existsSync(candidateWebappPath)
      ? candidateWebappPath
      : null,
  };
}

async function shellProfile(
  shellPath,
  pkg,
  defaults,
  { syncGit = false, includeMicrofrontends = false } = {},
) {
  const { appConfig, configFolder, webappPath } = linkedWebappInfo(shellPath);
  const workspacePath = path.dirname(shellPath);

  const appName = appConfig?.app || configFolder || null;
  const serverPath = path.join(workspacePath, 'server');
  const microfrontends = includeMicrofrontends
    ? (await Promise.all(
      Object.entries(appConfig?.remotes || {}).map(async ([name, remote]) => {
        if (!String(remote?.remoteEntry || '').includes('localhost:8080')) return null;
        const microfrontendPath = path.join(workspacePath, name);
        const packagePath = path.join(microfrontendPath, 'package.json');
        if (!fs.existsSync(packagePath)) return null;

        const microfrontendPackage = readJson(packagePath, {});
        if (syncGit) {
          try {
            await execFileAsync(
              'git',
              ['-C', microfrontendPath, 'fetch', '--all', '--prune'],
              { encoding: 'utf8', windowsHide: true },
            );
          } catch {
            // La información local sigue siendo útil si el remoto no está disponible.
          }
        }
        const [git, gitReference] = await Promise.all([
          gitWorkingTreeStatus(microfrontendPath),
          activeGitReference(microfrontendPath),
        ]);

        return {
          id: projectId(microfrontendPath), name, path: microfrontendPath,
          version: remote.version || microfrontendPackage.version || null,
          git: gitReference,
          hasLocalChanges: git.hasLocalChanges,
          remoteEntry: remote.remoteEntry,
          watchAvailable: Boolean(microfrontendPackage.scripts?.watch),
          buildAvailable: Boolean(microfrontendPackage.scripts?.build),
          localBuildAvailable: fs.existsSync(path.join(microfrontendPath, 'dist')),
        };
      }),
    )).filter(Boolean)
    : [];
  const serverPort = Number(defaults.serverPort || 8080);

  return {
    url: `http://127.0.0.1:${serverPort}/${appName ? `${appName}/` : ''}`,
    serverPort,
    serverPath,
    appName,
    configFolder,
    webappPath,
    workflow: {
      scaffolding: Boolean(pkg.scripts?.scaffolding),
      prepareServer: Boolean(pkg.scripts?.['prepare-server']),
      buildLocal: Boolean(pkg.scripts?.['build:local']),
      localServer: Boolean(pkg.scripts?.['local-server']),
      checkProject: Boolean(pkg.scripts?.['check-project']),
    },
    microfrontends,
  };
}

export async function scanShells(rootPath, defaults) {
  if (!rootPath || !fs.existsSync(rootPath)) return [];
  if (scanCache.rootPath === rootPath && scanCache.projects !== null)
    return scanCache.projects;
  
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.angular', '.nx', '.next']);
  const pending = [{ directory: rootPath, depth: 0 }];
  const shellsToProcess = [];

  while (pending.length) {
    const { directory: current, depth } = pending.pop();
    if (isShellDirectory(current)) {
      const packagePath = path.join(current, 'package.json');
      const pkg = fs.existsSync(packagePath) ? readJson(packagePath, {}) : {};
      shellsToProcess.push({ shellPath: current, pkg });
      continue;
    }
    // El webapp no es la unidad que descubrimos, pero tampoco es necesario
    // recorrer su contenido para encontrar una shell: ambas rutas son hermanas.
    if (isWebappDirectory(current)) continue;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { continue; }

    if (depth < 6) {
      for (const entry of entries) {
        if (entry.isDirectory() && !ignored.has(entry.name)) {
          pending.push({ directory: path.join(current, entry.name), depth: depth + 1 });
        }
      }
    }
  }

  const found = await Promise.all(
    shellsToProcess.map(async ({ shellPath, pkg }) => {
      const profile = await shellProfile(shellPath, pkg, defaults);
      // Una shell aislada no es un proyecto operable para el launcher. La
      // webapp debe existir físicamente como carpeta hermana y estar asociada
      // desde config de la shell.
      if (!profile.webappPath) return null;
      return {
        id: projectId(shellPath),
        name: profile.configFolder || path.basename(path.dirname(shellPath)),
        path: shellPath,
        ...profile,
        detected: true
      };
    })
  );

  const projects = found
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  scanCache = { rootPath, projects };
  return projects;
}

export async function getProjects() {
  const config = readConfig();
  const detected = await scanShells(config.environment.rootPath, config.environment);
  const serverPort = Number(config.environment.serverPort || 8080);
  const projects = detected.map((project) => {
    let url = project.url;
    try { const parsed = new URL(url); parsed.port = String(serverPort); url = parsed.toString(); } catch { /* ... */ }
    return { ...project, serverPort, url };
  });

  projectIndex = new Map(projects.map((project) => [project.id, project]));
  return projects;
}

/** Carga los microfrontends de una shell ya descubierta bajo demanda. */
export async function getProjectDetails(projectId) {
  const project = getIndexedProject(projectId);
  if (!project || !fs.existsSync(project.path)) return null;

  const config = readConfig();
  const packagePath = path.join(project.path, 'package.json');
  const pkg = fs.existsSync(packagePath) ? readJson(packagePath, {}) : {};
  const profile = await shellProfile(project.path, pkg, config.environment);
  const [shellGit, webappGit] = await Promise.all([
    activeGitReference(project.path),
    profile.webappPath
      ? activeGitReference(profile.webappPath)
      : Promise.resolve(null),
  ]);
  const detailedProject = {
    ...project,
    ...profile,
    microfrontends: undefined,
    git: {
      shell: shellGit,
      webapp: webappGit,
    },
  };

  projectIndex.set(projectId, detailedProject);
  scanCache = {
    ...scanCache,
    projects: scanCache.projects?.map((item) =>
      item.id === projectId ? detailedProject : item,
    ) ?? null,
  };
  return detailedProject;
}

/** Carga los microfrontends desde la configuración de una shell ya validada. */
export async function getProjectMicrofrontends(projectId) {
  const project = getIndexedProject(projectId);
  if (!project) return null;

  const workspacePath = path.dirname(project.path);
  if (!fs.existsSync(workspacePath)) return null;

  const config = readConfig();
  const packagePath = path.join(project.path, 'package.json');
  const pkg = fs.existsSync(packagePath) ? readJson(packagePath, {}) : {};
  const profile = await shellProfile(project.path, pkg, config.environment, {
    includeMicrofrontends: true,
  });
  const projectWithMicrofrontends = {
    ...project,
    microfrontends: profile.microfrontends,
  };

  projectIndex.set(projectId, projectWithMicrofrontends);
  return profile.microfrontends;
}

// Fast-path for actions that only need an already discovered local path.
// It deliberately avoids a fresh shell scan and its Git branch lookups.
export function getIndexedProject(projectId) {
  return projectIndex.get(projectId) || null;
}

export async function refreshProjects() {
  invalidateScanCache();
  return getProjects();
}

/** Actualiza en caché los campos indicados de un microfrontend. */
function patchMicrofrontendCache(projectId, microfrontendId, patch) {
  const updateProject = (project) => {
    if (project.id !== projectId) return project;

    const microfrontends = project.microfrontends?.map((microfrontend) =>
      microfrontend.id === microfrontendId
        ? { ...microfrontend, ...patch }
        : microfrontend,
    );

    return microfrontends ? { ...project, microfrontends } : project;
  };

  scanCache = {
    ...scanCache,
    projects: scanCache.projects?.map(updateProject) ?? null,
  };

  const indexedProject = projectIndex.get(projectId);
  if (indexedProject) projectIndex.set(projectId, updateProject(indexedProject));
}

/** Actualiza en caché la rama activa de un microfrontend. */
export function updateMicrofrontendBranchCache(projectId, microfrontendId, branch) {
  patchMicrofrontendCache(projectId, microfrontendId, {
    git: {
      type: branch ? 'branch' : 'detached',
      name: branch || 'No disponible',
    },
  });
}

export function invalidateScanCache() {
  scanCache = { rootPath: '', projects: null };
  projectIndex = new Map();
}

export function assertInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta de almacenamiento no válida.');
}
