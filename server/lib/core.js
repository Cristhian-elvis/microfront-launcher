// Reemplaza tus imports actuales por estos:
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(libDir, '..', '..');
export const distRoot = path.join(appRoot, 'dist');
export const configPath = path.join(appRoot, 'data', 'config.json');
function hasCompletedInitialSetup() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Boolean(
      String(config.rootPath || '').trim()
      && String(config.mova?.sourcePath || '').trim()
      && String(config.mova?.cdnHost || '').trim()
      && String(config.mova?.stencilComponentsFolderName || '').trim(),
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

export const defaultConfig = {
  rootPath: '',
  mova: {
    sourcePath: '',
    includeWithShell: true
  },
  shellDefaults: { command: 'npm run local-server', url: 'http://localhost:8080', serverPort: 8080, buildMode: 'never' },
  browser: {
    selected: 'chrome-insecure',
    openHost: 'localhost',
    openMode: null,
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
  avatarLetters: "ML"
};

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
  const {
    chrome: legacyChrome = {},
    browser: savedBrowser = {},
    projects: _legacyProjects,
    hiddenProjects: _legacyHiddenProjects,
    ...savedConfig
  } = saved;
  const savedMova = { ...(saved.mova || {}) };
  delete savedMova.componentPort;
  delete savedMova.legacyServerPath;
  delete savedMova.storybookPort;
  const savedShellDefaults = { ...(saved.shellDefaults || {}) };
  if (savedShellDefaults.command === 'npm start') savedShellDefaults.command = defaultConfig.shellDefaults.command;
  if (savedShellDefaults.url === 'http://localhost:4200') savedShellDefaults.url = defaultConfig.shellDefaults.url;
  if (!['automatic', 'always', 'never'].includes(savedShellDefaults.buildMode)) savedShellDefaults.buildMode = defaultConfig.shellDefaults.buildMode;
  if (!Number.isInteger(Number(savedShellDefaults.serverPort)) || Number(savedShellDefaults.serverPort) < 1 || Number(savedShellDefaults.serverPort) > 65535) savedShellDefaults.serverPort = defaultConfig.shellDefaults.serverPort;
  return {
    ...defaultConfig,
    ...savedConfig,
    mova: { ...defaultConfig.mova, ...savedMova, includeWithShell: true },
    shellDefaults: { ...defaultConfig.shellDefaults, ...savedShellDefaults },
    browser: {
      ...defaultConfig.browser,
      ...savedBrowser,
      chrome: {
        ...defaultConfig.browser.chrome,
        ...savedBrowser.chrome,
        path: savedBrowser.chrome?.path ?? legacyChrome.path ?? defaultConfig.browser.chrome.path,
        userDataDir: savedBrowser.chrome?.userDataDir ?? legacyChrome.userDataDir ?? defaultConfig.browser.chrome.userDataDir,
      },
      edge: {
        ...defaultConfig.browser.edge,
        ...savedBrowser.edge,
        path: savedBrowser.edge?.path ?? legacyChrome.edgePath ?? defaultConfig.browser.edge.path,
        userDataDir: savedBrowser.edge?.userDataDir ?? legacyChrome.edgeUserDataDir ?? defaultConfig.browser.edge.userDataDir,
      },
      selected: (() => {
        const selected = savedBrowser.selected ?? savedBrowser.browser ?? legacyChrome.browser;
        if (selected === 'chrome') return 'chrome-insecure';
        if (selected === 'edge') return 'edge-insecure';
        return ['chrome-insecure', 'edge-insecure'].includes(selected)
          ? selected
          : defaultConfig.browser.selected;
      })(),
      openHost: ['localhost', '127.0.0.1'].includes(savedBrowser.openHost ?? legacyChrome.openHost)
        ? (savedBrowser.openHost ?? legacyChrome.openHost)
        : defaultConfig.browser.openHost,
      openMode: ['tab', 'window'].includes(savedBrowser.openMode ?? legacyChrome.openMode)
        ? (savedBrowser.openMode ?? legacyChrome.openMode)
        : null,
    }
  };
}

export function readPreferences() {
  const saved = readJson(preferencesPath, defaultPreferences);
  delete saved.storybookMode;
  delete saved.preferredTag;
  delete saved.componentsVersion;
  const preferences = { ...defaultPreferences, ...saved };
  return {
    ...preferences,
    avatarLetters: String(preferences.avatarLetters || "ML")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 2)
      .toUpperCase(),
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
      execFileAsync('git', ['-C', projectPath, 'for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'], gitOptions)
    ]);

    const branch = branchReq.stdout.trim() || 'HEAD';
    const branches = [...new Set(refsReq.stdout.split(/\r?\n/)
      .filter((ref) => ref && ref !== 'HEAD' && ref !== 'origin'))].sort();
    return { branch, branches };
  } catch {
    return { branch: 'No disponible', branches: [] };
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

function normalizeFrameworkVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function shellMatchesFrameworkVersion(frameworkVersion, shellTag, packageVersion) {
  const expected = normalizeFrameworkVersion(frameworkVersion);
  return Boolean(
    expected &&
    normalizeFrameworkVersion(shellTag) === expected &&
    normalizeFrameworkVersion(packageVersion) === expected,
  );
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
  { syncGit = false, includeGit = syncGit } = {},
) {
  const { appConfig, configFolder, webappPath } = linkedWebappInfo(shellPath);
  const workspacePath = path.dirname(shellPath);

  const appName = appConfig?.app || configFolder || null;
  const serverPath = path.join(workspacePath, 'server');
  
  // AHORA PROCESAMOS LOS MICROFRONTENDS EN PARALELO
  const microfrontendsRaw = await Promise.all(
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
      const git = includeGit
        ? await gitBranchInfo(microfrontendPath)
        : { branch: null, branches: [] };

      return {
        id: projectId(microfrontendPath), name, path: microfrontendPath,
        version: remote.version || microfrontendPackage.version || null,
        branch: git.branch,
        branches: git.branches,
        remoteEntry: remote.remoteEntry,
        command: microfrontendPackage.scripts?.watch ? 'npm run watch' : null,
        watchAvailable: Boolean(microfrontendPackage.scripts?.watch),
        buildAvailable: Boolean(microfrontendPackage.scripts?.build),
        localBuildAvailable: fs.existsSync(path.join(microfrontendPath, 'dist'))
      };
    })
  );
  
  const microfrontends = microfrontendsRaw.filter(Boolean); // Limpiamos los nulls
  const serverPort = Number(defaults.serverPort || 8080);
  const frameworkVersion = appConfig?.frameworkVersion || null;
  const shellTag = includeGit ? await exactGitTag(shellPath) : null;
  const shellPackageVersion = pkg.version || null;
  const shellDependenciesReady = fs.existsSync(path.join(shellPath, 'node_modules'));
  
  return {
    command: pkg.scripts?.['local-server'] ? 'npm run local-server' : defaults.command,
    url: appName ? `http://127.0.0.1:${serverPort}/${appName}/` : defaults.url.replace('localhost', '127.0.0.1'),
    serverUrl: `http://localhost:${serverPort}`, serverPort, serverPath,
    appName, configFolder, webappPath, frameworkVersion, shellTag, shellPackageVersion, shellDependenciesReady,
    configured: includeGit
      ? Boolean(
          appName &&
          shellDependenciesReady &&
          shellMatchesFrameworkVersion(
            frameworkVersion,
            shellTag,
            shellPackageVersion,
          ),
        )
      : undefined,
    workflow: {
      scaffolding: Boolean(pkg.scripts?.scaffolding),
      prepareServer: Boolean(pkg.scripts?.['prepare-server']),
      buildLocal: Boolean(pkg.scripts?.['build:local']),
      localServer: Boolean(pkg.scripts?.['local-server'])
    },
    microfrontends
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
  const detected = await scanShells(config.rootPath, config.shellDefaults);
  const serverPort = Number(config.shellDefaults.serverPort || 8080);
  const projects = detected.map((project) => {
    let url = project.url;
    try { const parsed = new URL(url); parsed.port = String(serverPort); url = parsed.toString(); } catch { /* ... */ }
    return { ...project, serverPort, url };
  });
  
  projectIndex = new Map(projects.map((project) => [project.id, project]));
  return projects;
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

export async function syncProject(projectId) {
  const currentProject = getIndexedProject(projectId);
  if (!currentProject)
    throw new Error('El proyecto no está cargado. Actualiza el catálogo de proyectos.');

  const config = readConfig();
  const packagePath = path.join(currentProject.path, 'package.json');
  if (!fs.existsSync(packagePath))
    throw new Error('No se encontró package.json para la shell solicitada.');

  const profile = await shellProfile(
    currentProject.path,
    readJson(packagePath, {}),
    config.shellDefaults,
    { syncGit: true, includeGit: true },
  );
  const updatedProject = {
    ...currentProject,
    ...profile,
    id: currentProject.id,
    name: currentProject.name,
    path: currentProject.path,
  };

  scanCache = {
    ...scanCache,
    projects: scanCache.projects?.map((project) =>
      project.id === projectId ? updatedProject : project,
    ) ?? null,
  };
  projectIndex.set(projectId, updatedProject);
  return updatedProject;
}

export function updateMicrofrontendGitCache(
  projectId,
  microfrontendId,
  gitBranchData,
) {
  const updateProject = (project) => {
    if (project.id !== projectId) return project;

    const microfrontends = project.microfrontends?.map((microfrontend) =>
      microfrontend.id === microfrontendId
        ? {
            ...microfrontend,
            branch: gitBranchData.branch,
            branches: gitBranchData.branches,
          }
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
export function safeTagName(tag) {
  return String(tag).replace(/[^a-zA-Z0-9._-]/g, '_');
}

let tagCache = null;

function cacheTags(tags) {
  tagCache = Array.isArray(tags) ? tags : [];
  return tagCache;
}

async function readTagsFromGit(sourcePath) {
  const { stdout: output } = await execFileAsync('git', [
    '-C', sourcePath, 'tag', '--sort=-creatordate',
    '--format=%(refname:short)|%(creatordate:iso8601)|%(objectname:short)'
  ], { encoding: 'utf8', windowsHide: true });
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [tag, date, commit] = line.split('|');
    return { tag, date, commit };
  }).filter((item) => item.tag.startsWith('release-'));
}

export async function getTags() {
  if (tagCache) return tagCache;

  // El catálogo persistido evita ejecutar Git en cada arranque.
  const { sourcePath } = readConfig().mova;
  if (!sourcePath) return [];
  try {
    if (!fs.existsSync(path.join(sourcePath, '.git'))) throw new Error('Repositorio no disponible');
    return cacheTags(await readTagsFromGit(sourcePath));
  } catch {
    return [];
  }
}

export async function getVersionByTag(tag) {
  const normalizedTag = String(tag || '').trim();
  if (!/^release-[a-zA-Z0-9._-]+$/.test(normalizedTag)) return null;
  const { sourcePath } = readConfig().mova;
  if (!sourcePath || !fs.existsSync(path.join(sourcePath, '.git'))) return null;
  try {
    const { stdout } = await execFileAsync('git', [
      '-C', sourcePath,
      'for-each-ref', `refs/tags/${normalizedTag}`,
      '--format=%(refname:short)|%(creatordate:iso8601)|%(objectname:short)',
    ], { encoding: 'utf8', windowsHide: true });
    const [foundTag, date, commit] = stdout.trim().split('|');
    if (foundTag !== normalizedTag) return null;
    const cached = getCachedVersions().some((item) => item.tag === normalizedTag);
    return {
      tag: normalizedTag,
      date,
      commit,
      version: normalizedTag.replace(/^release-/, ''),
      cached,
      preferred: false,
    };
  } catch {
    return null;
  }
}

export function getCachedVersions() {
  if (!fs.existsSync(versionsRoot)) return [];
  return fs.readdirSync(versionsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => {
      const root = path.join(versionsRoot, entry.name);
      const manifest = readJson(path.join(root, 'manifest.json'), null);
      return manifest && fs.existsSync(path.join(root, 'dist')) ? manifest : null;
    }).filter(Boolean);
}

export async function refreshTags() {
  const { sourcePath } = readConfig().mova;
  if (!fs.existsSync(path.join(sourcePath, '.git'))) throw new Error('El repositorio MOVA no está disponible para actualizar tags.');
  try {
    await execFileAsync(
      'git',
      ['-C', sourcePath, 'fetch', '--tags', '--prune'],
      { encoding: 'utf8', windowsHide: true },
    );
  } catch (error) {
    const details = String(error.stderr || error.message || '').trim();
    throw new Error(`No se pudieron actualizar los tags.${details ? ` ${details}` : ''}`);
  }
  return cacheTags(await readTagsFromGit(sourcePath));
}

export function versionPaths(tag) {
  const root = path.join(versionsRoot, safeTagName(tag));
  return { root, dist: path.join(root, 'dist'), manifest: path.join(root, 'manifest.json') };
}

export function invalidateScanCache() {
  scanCache = { rootPath: '', projects: null };
  projectIndex = new Map();
}

export function assertInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta de almacenamiento no válida.');
}
