export function createStateHandler({ getState, readConfig, needsInitialSetup, getProjects, logs, eventClients, json }) {
  return async function handleStateRequest(request, response, url) {
    const { method, pathname } = { method: request.method, pathname: url.pathname };
    
    if (method === 'GET' && pathname === '/api/state') {
      json(response, 200, getState());
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