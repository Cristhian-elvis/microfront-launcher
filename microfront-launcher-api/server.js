import { createApiRouters } from './app/create-api-routers.js';
import { createApp } from './app/create-app.js';
import { EnvironmentLifecycleService } from './api/environment/lifecycle.js';
import { ensureRuntimeDirectories, getProjects } from './lib/core.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 3187);

if (process.argv.includes('--check')) {
  const projects = await getProjects();
  console.log(
    JSON.stringify(
      { ok: true, projectsDetected: projects.length, apiOnly: true },
      null,
      2,
    ),
  );
  process.exit(0);
}

ensureRuntimeDirectories();

const app = createApp({ routers: createApiRouters() });

const server = app.listen(port, host, () => {
  console.log(`Microfront Launcher API disponible en http://${host}:${port}`);
});

server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso.` : error,
  );
  process.exit(1);
});

async function cleanupAndExit() {
  await EnvironmentLifecycleService.stopEnvironmentInternals({
    reason: 'Launcher cerrado',
    emitFinalSession: true,
  });
  server.close(() => process.exit(0));
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
