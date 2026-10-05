import express from 'express';
import {
  browserRouter,
  cancelAndStopAll,
  componentsRouter,
  environmentRouter,
  handleRequest,
  microfrontendsRouter,
  movaRouter,
  projectsRouter,
  stateRouter,
} from './index.js';
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

const app = express();
app.disable('x-powered-by');
app.use('/api', stateRouter);
app.use('/api', projectsRouter);
app.use('/api', environmentRouter);
app.use('/api', movaRouter);
app.use('/api', componentsRouter);
app.use('/api', browserRouter);
app.use('/api', microfrontendsRouter);
app.use((request, response) => handleRequest(request, response));
app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ error: error.message || 'Error interno' });
});

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
  await cancelAndStopAll('Launcher cerrado');
  server.close(() => process.exit(0));
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
