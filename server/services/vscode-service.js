import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

function findExecutable() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code', 'Code.exe'),
  ];
  const installed = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (installed) return { command: installed, shell: false };
  const lookup = spawnSync('where.exe', ['code'], { encoding: 'utf8', windowsHide: true });
  const command = lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean)?.trim() : null;
  return command ? { command, shell: /\.(cmd|bat)$/i.test(command) } : null;
}

function launch(command, args, shell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false, shell });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export function createVsCodeService({ findProject, addLog }) {
  async function openPath(project, targetPath, message) {
    const executable = findExecutable();
    if (!executable) throw new Error('No se encontró VS Code. Instálalo o agrega el comando code al PATH.');
    await launch(executable.command, ['--new-window', targetPath], executable.shell);
    addLog(project.name, 'system', message);
  }

  return {
    async openMicrofrontend(projectId, microfrontendId) {
      const project = await findProject(projectId);
      const microfrontend = project?.microfrontends?.find((item) => item.id === microfrontendId);
      if (!microfrontend) throw new Error('No se encontró el microfrontend solicitado.');
      await openPath(project, microfrontend.path, `VS Code abierto para ${microfrontend.name}.`);
    },
    async openProjectWebapp(projectId) {
      const project = await findProject(projectId);
      const webappPath = project?.path;
      if (!webappPath) throw new Error('La shell no tiene una ruta local configurada.');
      if (!fs.existsSync(webappPath)) throw new Error('No se encontró la ubicación local de la webapp asociada.');
      await openPath(project, webappPath, `VS Code abierto para la shell ${project.name}.`);
    },
  };
}
