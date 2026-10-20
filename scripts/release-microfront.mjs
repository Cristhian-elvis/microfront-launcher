import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const validReleaseTypes = new Set(['patch', 'minor', 'major']);
const ignoredDirectories = new Set(['.angular', '.git', '.next', 'build', 'coverage', 'dist', 'node_modules']);

function usage() {
  console.log(`Uso: npm run release:microfront -- <nombre-microfront> <patch|minor|major> [opciones]

Opciones:
  --root <ruta>       Raíz en la que buscar los proyectos. Por defecto usa data/config.json.
  --webapp <nombre>   Limita la actualización a una webapp concreta.
  --dry-run           Valida y muestra los cambios sin modificar repositorios.

Ejemplo:
  npm run release:microfront -- hcen_mf_centros patch`);
}

function parseArguments(argumentsList) {
  const positional = [];
  const options = { root: null, webapp: null, dryRun: false };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--root' || argument === '--webapp') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${argument}.`);
      options[argument.slice(2)] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`Opción no reconocida: ${argument}.`);
    } else {
      positional.push(argument);
    }
  }

  const [microfrontName, releaseType] = positional;
  if (positional.length !== 2 || !microfrontName || !validReleaseTypes.has(releaseType)) {
    throw new Error('Debes indicar el nombre del microfront y un tipo válido: patch, minor o major.');
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(microfrontName)) {
    throw new Error('El nombre del microfront contiene caracteres no permitidos.');
  }
  return { microfrontName, releaseType, ...options };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`No se puede leer JSON válido en ${filePath}: ${error.message}`);
  }
}

function configuredRoot() {
  const configPath = path.join(workspaceRoot, 'data', 'config.json');
  const rootPath = String(readJson(configPath).rootPath || '').trim();
  if (!rootPath) throw new Error('No hay una raíz de proyectos configurada. Indica --root <ruta>.');
  return rootPath;
}

function findDirectories(rootPath, predicate, maxDepth = 4) {
  const matches = [];
  const pending = [{ directory: rootPath, depth: 0 }];
  while (pending.length) {
    const { directory, depth } = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (predicate(entry, entryPath)) matches.push(entryPath);
      if (depth < maxDepth) pending.push({ directory: entryPath, depth: depth + 1 });
    }
  }
  return matches;
}

function findMicrofront(rootPath, microfrontName) {
  const candidates = findDirectories(
    rootPath,
    (entry, entryPath) => entry.name === microfrontName && fs.existsSync(path.join(entryPath, 'package.json')),
  );
  if (!candidates.length) throw new Error(`No se encontró el microfront '${microfrontName}' bajo ${rootPath}.`);
  if (candidates.length > 1) throw new Error(`El microfront '${microfrontName}' es ambiguo: ${candidates.join(', ')}.`);
  return candidates[0];
}

function appConfigFiles(webappPath) {
  const configDirectory = path.join(webappPath, 'config');
  if (!fs.existsSync(configDirectory)) return [];
  return fs.readdirSync(configDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(configDirectory, entry.name, 'app-config.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function findWebappUpdates(rootPath, microfrontName, webappName) {
  const candidates = findDirectories(
    rootPath,
    (entry, entryPath) => (
      (!webappName ? /_webapp_/i.test(entry.name) : entry.name === webappName)
      && fs.existsSync(path.join(entryPath, 'config'))
    ),
  );
  if (webappName && !candidates.length) throw new Error(`No se encontró la webapp '${webappName}' bajo ${rootPath}.`);

  const updates = [];
  for (const webappPath of candidates) {
    for (const configPath of appConfigFiles(webappPath)) {
      const config = readJson(configPath);
      const remote = config.remotes?.[microfrontName];
      if (!remote) continue;
      if (typeof remote.version !== 'string' || !remote.version) {
        throw new Error(`El remote '${microfrontName}' no tiene una versión válida en ${configPath}.`);
      }
      if (typeof remote.remoteEntry !== 'string' || !remote.remoteEntry.includes(`/${remote.version}/`)) {
        throw new Error(`El remoteEntry de '${microfrontName}' no contiene su versión actual en ${configPath}.`);
      }
      updates.push({ webappPath, configPath, config, previousVersion: remote.version });
    }
  }
  if (!updates.length) throw new Error(`No hay app-config.json que referencie '${microfrontName}'.`);
  return updates;
}

async function runGit(projectPath, args) {
  const { stdout } = await execFileAsync('git', ['-C', projectPath, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return stdout.trim();
}

async function validateRepository(projectPath) {
  const branch = await runGit(projectPath, ['branch', '--show-current']);
  if (!['main', 'master'].includes(branch)) {
    throw new Error(`${projectPath} debe estar en main o master; rama actual: ${branch || 'HEAD separado'}.`);
  }
  const status = await runGit(projectPath, ['status', '--porcelain']);
  if (status) throw new Error(`${projectPath} tiene cambios sin confirmar. Libera el árbol de trabajo antes de publicar.`);

  const remoteBranch = `origin/${branch}`;
  try {
    await runGit(projectPath, ['fetch', 'origin', '--prune']);
    await runGit(projectPath, ['rev-parse', '--verify', remoteBranch]);
  } catch {
    throw new Error(`${projectPath} no permite verificar la rama remota ${remoteBranch}.`);
  }

  const divergence = await runGit(projectPath, ['rev-list', '--left-right', '--count', `${remoteBranch}...HEAD`]);
  const [behind = 0, ahead = 0] = divergence.split(/\s+/).map(Number);
  if (behind || ahead) {
    throw new Error(
      `${projectPath} no está sincronizado con ${remoteBranch} `
      + `(por detrás: ${behind}, por delante: ${ahead}).`,
    );
  }
}

function replaceVersionInRemoteEntry(remoteEntry, previousVersion, nextVersion) {
  return remoteEntry.replace(`/${previousVersion}/`, `/${nextVersion}/`);
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.release-tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temporaryPath, filePath);
  fs.unlinkSync(temporaryPath);
}

async function main() {
  const { microfrontName, releaseType, root, webapp, dryRun } = parseArguments(process.argv.slice(2));
  const rootPath = path.resolve(root || configuredRoot());
  if (!fs.existsSync(rootPath)) throw new Error(`La raíz de proyectos no existe: ${rootPath}.`);

  const microfrontPath = findMicrofront(rootPath, microfrontName);
  const updates = findWebappUpdates(rootPath, microfrontName, webapp);
  const webapps = [...new Set(updates.map((update) => update.webappPath))];

  await validateRepository(microfrontPath);
  await Promise.all(webapps.map((webappPath) => validateRepository(webappPath)));

  const currentVersion = readJson(path.join(microfrontPath, 'package.json')).version;
  console.log(`Microfront: ${microfrontName} (${currentVersion})`);
  console.log(`Entornos a actualizar: ${updates.map((update) => update.configPath).join(', ')}`);

  if (dryRun) {
    console.log('Validación correcta. No se realizaron cambios (--dry-run).');
    return;
  }

  await execFileAsync('npm', ['version', releaseType, '--message=chore(release): v%s'], {
    cwd: microfrontPath,
    encoding: 'utf8',
    windowsHide: true,
  });
  const nextVersion = readJson(path.join(microfrontPath, 'package.json')).version;

  for (const update of updates) {
    const remote = update.config.remotes[microfrontName];
    remote.version = nextVersion;
    remote.remoteEntry = replaceVersionInRemoteEntry(remote.remoteEntry, update.previousVersion, nextVersion);
    writeJsonAtomically(update.configPath, update.config);
  }

  console.log(`Release ${microfrontName}@${nextVersion} creada con su tag v${nextVersion}.`);
  console.log(`Se actualizaron ${updates.length} configuración(es) de webapp. Confirma y publica esos cambios en sus repositorios.`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
