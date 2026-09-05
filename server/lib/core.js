// Reemplaza tus imports actuales por estos:
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process'; // Añadido execFile
import { promisify } from 'node:util'; // Añadido promisify
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile); // Inicializamos la versión asíncrona

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(libDir, '..', '..');
export const distRoot = path.join(appRoot, 'dist');
export const configPath = path.join(appRoot, 'data', 'config.json');
function hasCompletedInitialSetup() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Boolean(String(config.rootPath || '').trim() && String(config.mova?.sourcePath || '').trim());
  } catch {
    return false;
  }
}

let initialSetupRequired = !hasCompletedInitialSetup();
export const storageRoot = path.join(appRoot, 'storage');
export const preferencesPath = path.join(storageRoot, 'preferences.json');
export const tagCatalogPath = path.join(storageRoot, 'tag-catalog.json');
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
  chrome: {
    browser: 'chrome-insecure',
    path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: 'C:\\chrome-dev-data',
    edgePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    edgeUserDataDir: 'C:\\msedge-dev-data',
    openHost: 'localhost',
    openMode: null
  },
  projects: [],
  hiddenProjects: []
};

export const defaultPreferences = {
  preferredTag: null,
  favoriteShellIds: [],
  favoriteMicrofrontIds: []
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
    ...saved,
    mova: { ...defaultConfig.mova, ...savedMova, includeWithShell: true },
    shellDefaults: { ...defaultConfig.shellDefaults, ...savedShellDefaults },
    chrome: {
      ...defaultConfig.chrome,
      ...(saved.chrome || {}),
      // Las configuraciones previas siempre abrían con perfil aislado y sin
      // seguridad web; por compatibilidad se convierten a ese modo explícito.
      browser: ['chrome', 'edge', 'chrome-insecure', 'edge-insecure'].includes(saved.chrome?.browser)
        ? (saved.chrome.browser === 'chrome' ? 'chrome-insecure' : saved.chrome.browser === 'edge' ? 'edge-insecure' : saved.chrome.browser)
        : defaultConfig.chrome.browser,
      openHost: ['localhost', '127.0.0.1'].includes(saved.chrome?.openHost) ? saved.chrome.openHost : 'localhost',
      openMode: ['tab', 'window'].includes(saved.chrome?.openMode) ? saved.chrome.openMode : null
    },
    projects: Array.isArray(saved.projects) ? saved.projects : [],
    hiddenProjects: Array.isArray(saved.hiddenProjects) ? saved.hiddenProjects : []
  };
}

export function readPreferences() {
  const saved = readJson(preferencesPath, defaultPreferences);
  delete saved.storybookMode;
  const preferences = { ...defaultPreferences, ...saved };
  return {
    ...preferences,
    favoriteShellIds: Array.isArray(preferences.favoriteShellIds) ? preferences.favoriteShellIds : [],
    favoriteMicrofrontIds: Array.isArray(preferences.favoriteMicrofrontIds) ? preferences.favoriteMicrofrontIds : []
  };
}

export function writePreferences(next) {
  const value = { ...readPreferences(), ...next };
  writeJson(preferencesPath, value);
  return value;
}

export function projectId(projectPath) {
  return crypto.createHash('sha1').update(projectPath.toLowerCase()).digest('hex').slice(0, 12);
}

let scanCache = { rootPath: '', at: 0, projects: [] };
let projectIndex = new Map();

export function invalidateProjectScan() {
  scanCache.at = 0;
}

async function gitBranchInfo(projectPath) {
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

async function shellProfile(shellPath, pkg, defaults) {
  const projectRoot = path.dirname(shellPath);
  const configRoot = path.join(shellPath, 'config');
  let appConfig = null;
  let configFolder = null;
  
  if (fs.existsSync(configRoot)) {
    const candidates = fs.readdirSync(configRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !['des', 'val', 'prod'].includes(entry.name.toLowerCase()))
      .map((entry) => ({ folder: entry.name, file: path.join(configRoot, entry.name, 'app-config.json') }))
      .filter((item) => fs.existsSync(item.file));
    const preferred = candidates.find((item) => /webapp|local/i.test(item.folder)) || candidates[0];
    if (preferred) {
      appConfig = readJson(preferred.file, null);
      configFolder = preferred.folder;
    }
  }

  const appName = appConfig?.app || configFolder || null;
  const serverPath = path.join(projectRoot, 'server');
  
  // AHORA PROCESAMOS LOS MICROFRONTENDS EN PARALELO
  const microfrontendsRaw = await Promise.all(
    Object.entries(appConfig?.remotes || {}).map(async ([name, remote]) => {
      if (!String(remote?.remoteEntry || '').includes('localhost:8080')) return null;
      const microfrontendPath = path.join(projectRoot, name);
      const packagePath = path.join(microfrontendPath, 'package.json');
      if (!fs.existsSync(packagePath)) return null;
      
      const microfrontendPackage = readJson(packagePath, {});
      const git = await gitBranchInfo(microfrontendPath); // Esperamos a Git aquí
      
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
  
  return {
    command: pkg.scripts?.['local-server'] ? 'npm run local-server' : defaults.command,
    url: appName ? `http://127.0.0.1:${serverPort}/${appName}/` : defaults.url.replace('localhost', '127.0.0.1'),
    serverUrl: `http://localhost:${serverPort}`, serverPort, serverPath,
    appName, configFolder, configured: Boolean(appName && fs.existsSync(serverPath)),
    workflow: {
      scaffolding: Boolean(pkg.scripts?.scaffolding),
      prepareServer: Boolean(pkg.scripts?.['prepare-server']),
      buildLocal: Boolean(pkg.scripts?.['build:local']),
      localServer: Boolean(pkg.scripts?.['local-server'])
    },
    microfrontends
  };
}

export async function scanShells(rootPath, defaults, { force = false } = {}) {
  if (!rootPath || !fs.existsSync(rootPath)) return [];
  if (!force && scanCache.rootPath === rootPath && Date.now() - scanCache.at < 15000) return scanCache.projects;
  
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.angular', '.nx', '.next']);
  const pending = [{ directory: rootPath, depth: 0 }];
  const shellsToProcess = []; // Guardamos los detectados para procesarlos en paralelo

  while (pending.length) {
    const { directory: current, depth } = pending.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { continue; }

    if (path.basename(current).toLowerCase() === 'mova3_shell') {
      const packagePath = path.join(current, 'package.json');
      if (fs.existsSync(packagePath)) {
        try {
          const pkg = readJson(packagePath);
          if (pkg.scripts?.['local-server'] || pkg.scripts?.start) {
            const segments = path.relative(rootPath, current).split(path.sep).filter((part) => part !== 'mova3_shell');
            shellsToProcess.push({ current, pkg, segments });
          }
        } catch { /* Continue discovering other shells. */ }
      }
      continue;
    }

    if (depth < 6) {
      for (const entry of entries) {
        if (entry.isDirectory() && !ignored.has(entry.name)) {
          pending.push({ directory: path.join(current, entry.name), depth: depth + 1 });
        }
      }
    }
  }

  // PROCESAMOS TODOS LOS SHELLS DETECTADOS EN PARALELO
  const found = await Promise.all(
    shellsToProcess.map(async ({ current, pkg, segments }) => {
      const profile = await shellProfile(current, pkg, defaults);
      return {
        id: projectId(current),
        name: segments[0] || 'mova3_shell',
        path: current,
        ...profile,
        detected: true
      };
    })
  );

  const projects = found.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  scanCache = { rootPath, at: Date.now(), projects };
  return projects;
}

export async function getProjects({ force = false } = {}) {
  const config = readConfig();
  const detected = await scanShells(config.rootPath, config.shellDefaults, { force }); // Añadido await
  const byId = new Map(detected.map((project) => [project.id, project]));
  
  for (const project of config.projects) {
    const id = project.id || projectId(project.path);
    byId.set(id, { ...byId.get(id), ...project, id });
  }
  
  const hidden = new Set(config.hiddenProjects);
  const serverPort = Number(config.shellDefaults.serverPort || 8080);
  const projects = [...byId.values()].filter((project) => !hidden.has(project.id)).map((project) => {
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

export function saveProject(project) {
  const config = readConfig();
  const normalized = { ...project, id: project.id || projectId(project.path), detected: Boolean(project.detected) };
  delete normalized.serverPort;
  const index = config.projects.findIndex((item) => item.id === normalized.id);
  if (index >= 0) config.projects[index] = normalized;
  else config.projects.push(normalized);
  config.hiddenProjects = config.hiddenProjects.filter((id) => id !== normalized.id);
  writeJson(configPath, config);
  scanCache.at = 0;
  return normalized;
}

export function hideProject(id) {
  const config = readConfig();
  config.projects = config.projects.filter((item) => item.id !== id);
  config.hiddenProjects = [...new Set([...config.hiddenProjects, id])];
  writeJson(configPath, config);
}

export function safeTagName(tag) {
  return String(tag).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getTags() {
  const { sourcePath } = readConfig().mova;
  if (!sourcePath) return [];
  try {
    if (!fs.existsSync(path.join(sourcePath, '.git'))) throw new Error('Repositorio no disponible');
    const output = execFileSync('git', [
      '-C', sourcePath, 'tag', '--sort=-creatordate',
      '--format=%(refname:short)|%(creatordate:iso8601)|%(objectname:short)'
    ], { encoding: 'utf8', windowsHide: true });
    const tags = output.split(/\r?\n/).filter(Boolean).map((line) => {
      const [tag, date, commit] = line.split('|');
      return { tag, date, commit };
    }).filter((item) => item.tag.startsWith('release-'));
    writeJson(tagCatalogPath, { updatedAt: new Date().toISOString(), tags });
    return tags;
  } catch {
    return readJson(tagCatalogPath, { tags: [] }).tags || [];
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

export function refreshTags() {
  const { sourcePath } = readConfig().mova;
  if (!fs.existsSync(path.join(sourcePath, '.git'))) throw new Error('El repositorio MOVA no está disponible para actualizar tags.');
  try {
    execFileSync('git', ['-C', sourcePath, 'fetch', '--tags', '--prune'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const details = String(error.stderr || error.message || '').trim();
    throw new Error(`No se pudieron actualizar los tags.${details ? ` ${details}` : ''}`);
  }
  return getTags();
}

export function getVersions() {
  const preferences = readPreferences();
  const cached = new Map(getCachedVersions().map((item) => [item.tag, item]));
  return getTags().map((item) => ({
    ...item,
    version: item.tag.replace(/^release-/, ''),
    cached: cached.has(item.tag),
    preferred: item.tag === preferences.preferredTag
  }));
}

export function versionPaths(tag) {
  const root = path.join(versionsRoot, safeTagName(tag));
  return { root, dist: path.join(root, 'dist'), manifest: path.join(root, 'manifest.json') };
}

export function assertInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta de almacenamiento no válida.');
}
