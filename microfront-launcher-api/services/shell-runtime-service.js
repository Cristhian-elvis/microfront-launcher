import { readConfig } from '../lib/core.js';
import path from 'node:path';

import { waitForUrl } from '../lib/process-manager.js';
import { startStaticServer } from '../lib/static-server.js';
import { inspectHttp } from '../lib/http-client.js';
import { state } from '../state.js';
import { assertNotCancelled } from './process-runner-service.js';
import { RuntimeStateService } from './runtime-state-service.js';

export async function startShell(project, signal) {
  assertNotCancelled(signal);

  if (state.shell.status !== 'preparing' || state.shell.projectId !== project.id) {
    throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
  }

  if (!project.appName) {
    throw new Error(
      'La shell no tiene una aplicación enlazada. Ejecuta primero scaffolding.',
    );
  }

  const configuredPort = Number(readConfig().environment.serverPort || 8080);
  const shellUrl = new URL(project.url);
  shellUrl.port = String(configuredPort);

  const occupied = await inspectHttp(shellUrl.toString());
  if (occupied.reachable) {
    throw new Error(
      `El puerto ${configuredPort} ya está ocupado por otra shell o servicio.`,
    );
  }

  state.shell = {
    status: 'starting',
    url: shellUrl.toString(),
    projectId: project.id,
    name: project.name,
    appName: project.appName,
    external: false,
  };
  RuntimeStateService.emitState();

  await startStaticServer({
    key: 'shell',
    label: project.name,
    root: project.serverPath,
    port: configuredPort,
    fallbackIndex: false,
    fallbackFile: path.join(project.appName, 'index.html'),
    cors: true,
  });
  await waitForUrl(shellUrl.toString(), { signal });

  state.shell = {
    status: 'running',
    url: shellUrl.toString(),
    projectId: project.id,
    name: project.name,
    appName: project.appName,
    external: false,
  };
  RuntimeStateService.emitState();
}
