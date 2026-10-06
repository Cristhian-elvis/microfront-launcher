import { Router } from 'express';
import {
  getProjects,
  needsInitialSetup,
  readConfig,
  readPreferences,
} from '../../lib/core.js';
import { eventClients, logs } from '../../lib/runtime.js';
import { RuntimeStateService } from "./../../services/runtime-state-service.js";
import {
  latestVersion,
} from "./../../services/components-version-service.js";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createStateRouter() {
  const router = Router();

  router.get('/bootstrap', async (request, response) => {
    if (needsInitialSetup()) {
      response.json({ setup: { required: true } });
      return;
    }

    const [projects] = await Promise.allSettled([getProjects()]);
    let latestComponentsVersion = null;
    let latestVersionError = null;
    try {
      latestComponentsVersion = await latestVersion();
    } catch (error) {
      latestVersionError = errorMessage(error);
    }

    response.json({
      runtime: RuntimeStateService.getRuntime(),
      preferences: readPreferences(),
      projects: projects.status === 'fulfilled' ? projects.value : [],
      latestVersion: latestComponentsVersion,
      logs: logs.slice(-500),
      setup: { required: needsInitialSetup() },
      errors: {
        ...(projects.status === 'rejected'
          ? { projects: errorMessage(projects.reason) }
          : {}),
        ...(latestVersionError ? { latestVersion: latestVersionError } : {}),
      },
    });
  });

  router.get('/state', (request, response) => response.json(RuntimeStateService.getRuntime()));
  router.get('/config', (request, response) => response.json(readConfig()));
  router.get('/setup', (request, response) => {
    response.json({ required: needsInitialSetup() });
  });
  router.get('/logs', (request, response) => response.json(logs.slice(-500)));
  router.get('/events', (request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(': connected\n\n');
    eventClients.add(response);
    request.on('close', () => eventClients.delete(response));
  });

  return router;
}
