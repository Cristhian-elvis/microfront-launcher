import {
  readConfig,
  readPreferences,
  needsInitialSetup,
  getProjects,
} from "./../lib/core.js";
import {
  eventClients,
  logs
} from "./../lib/runtime.js";
import { json } from "./../lib/http.js";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createStateHandler({ getRuntime }) {
  return async function handleStateRequest(request, response, url) {
    const { method, pathname } = { method: request.method, pathname: url.pathname };
    
    if (method === 'GET' && pathname === '/api/bootstrap') {
      const [projects] = await Promise.allSettled([getProjects()]);
      json(response, 200, {
        runtime: getRuntime(),
        preferences: readPreferences(),
        projects: projects.status === 'fulfilled' ? projects.value : [],
        // Los tags se cargan solo al entrar a Versiones o elegir modo manual.
        versions: [],
        logs: logs.slice(-500),
        setup: { required: needsInitialSetup() },
        errors: {
          ...(projects.status === 'rejected' ? { projects: errorMessage(projects.reason) } : {}),
        },
      });
      return true;
    }
    if (method === 'GET' && pathname === '/api/state') {
      json(response, 200, getRuntime());
      return true;
    }
    if (method === 'GET' && pathname === '/api/config') {
      json(response, 200, readConfig());
      return true;
    }
    if (method === 'GET' && pathname === '/api/setup') {
      json(response, 200, { required: needsInitialSetup() });
      return true;
    }
    if (method === 'GET' && pathname === '/api/projects') {
      // AÑADIDO: await antes de getProjects
      const projects = await getProjects({ force: url.searchParams.get('refresh') === '1' });
      json(response, 200, projects);
      return true;
    }
    if (method === 'GET' && pathname === '/api/logs') {
      json(response, 200, logs.slice(-500));
      return true;
    }
    if (method === 'GET' && pathname === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(': connected\n\n');
      eventClients.add(response);
      request.on('close', () => eventClients.delete(response));
      return true;
    }
    return false;
  };
}
