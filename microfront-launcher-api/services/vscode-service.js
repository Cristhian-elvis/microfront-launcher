import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getIndexedProject, getProjects } from '../lib/core.js';
import { addLog } from '../lib/runtime-events.js';

function findExecutable() {
  const candidates = [
    path.join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'Microsoft VS Code',
      'Code.exe',
    ),
    path.join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'Microsoft VS Code Insiders',
      'Code - Insiders.exe',
    ),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || '',
      'Microsoft VS Code',
      'Code.exe',
    ),
  ];

  const installed = candidates.find(
    (candidate) => candidate && fs.existsSync(candidate),
  );
  if (installed) return { command: installed, shell: false };

  const lookup = spawnSync('where.exe', ['code'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const command = lookup.status === 0
    ? lookup.stdout.split(/\r?\n/).find(Boolean)?.trim()
    : null;

  return command
    ? { command, shell: /\.(cmd|bat)$/i.test(command) }
    : null;
}

function launch(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function findProject(projectId) {
  return getIndexedProject(projectId)
    || (await getProjects()).find((project) => project.id === projectId);
}

async function openPath(project, targetPath, message) {
  const executable = findExecutable();

  if (!executable) {
    throw new Error(
      'No se encontró VS Code. Instálalo o agrega el comando code al PATH.',
    );
  }

  await launch(
    executable.command,
    ['--new-window', targetPath],
    { shell: executable.shell },
  );
  addLog(project.name, 'system', message);
}

function projectTarget(project, target, targetId) {
  if (target === 'shell') {
    return { path: project.path, label: `la shell ${project.name}` };
  }

  if (target === 'webapp') {
    if (!project.webappPath) {
      throw new Error('El proyecto no tiene una webapp asociada configurada.');
    }
    return { path: project.webappPath, label: `la webapp ${project.name}` };
  }

  if (target === 'microfrontend') {
    const microfrontend = project.microfrontends?.find(
      (item) => item.id === targetId,
    );
    if (!microfrontend) {
      throw new Error('No se encontró el microfrontend solicitado.');
    }
    return { path: microfrontend.path, label: microfrontend.name };
  }

  throw new Error('El destino solicitado no es válido.');
}

async function resolveProjectTarget(projectId, target, targetId) {
  const project = await findProject(projectId);
  if (!project) {
    throw new Error('No se encontró el proyecto solicitado.');
  }

  const destination = projectTarget(project, target, targetId);
  if (!destination.path || !fs.existsSync(destination.path)) {
    throw new Error('No se encontró la ubicación local solicitada.');
  }

  return { project, destination };
}

export async function openInVsCode(projectId, target, targetId) {
  const { project, destination } = await resolveProjectTarget(projectId, target, targetId);
  await openPath(project, destination.path, `VS Code abierto para ${destination.label}.`);
}

export async function openInFileExplorer(projectId, target, targetId) {
  const { project, destination } = await resolveProjectTarget(projectId, target, targetId);
  const command = process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  await launch(command, [destination.path]);
  addLog(project.name, 'system', `Carpeta abierta para ${destination.label}.`);
}

export async function openInTerminal(projectId, target, targetId) {
  const { project, destination } = await resolveProjectTarget(projectId, target, targetId);
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'x-terminal-emulator';
  const args = isWindows
    ? ['/d', '/c', 'start', 'cmd.exe', '/d', '/k']
    : [];
  await launch(command, args, {
    cwd: destination.path,
  });
  addLog(project.name, 'system', `Terminal abierta para ${destination.label}.`);
}
