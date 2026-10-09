import { spawn } from 'node:child_process';

import { getIndexedProject, getProjects } from '../lib/core.js';
import { addLog } from '../lib/runtime-events.js';

async function findProject(projectId) {
  return getIndexedProject(projectId)
    || (await getProjects()).find((project) => project.id === projectId);
}

export async function openScaffolding(projectId) {
  const project = await findProject(projectId);

  if (!project) {
    throw new Error('Shell no encontrada.');
  }

  if (!project.workflow?.scaffolding) {
    throw new Error('Esta shell no define npm run scaffolding.');
  }

  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/k', 'npm run scaffolding'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    : spawn('npm', ['run', 'scaffolding'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
    });

  child.unref();
  addLog(
    project.name,
    'system',
    'Configuración inicial abierta en una terminal independiente.',
  );
}
