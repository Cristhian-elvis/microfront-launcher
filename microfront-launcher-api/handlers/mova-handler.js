import { writePreferences } from "./../lib/core.js";
import { json, readBody } from "./../lib/http.js";

export function createMovaHandler({ emitPreferences }) {
  return async function handleMovaRequest(request, response, url) {
    const { method, pathname } = { method: request.method, pathname: url.pathname };
    if (method === 'PUT' && pathname === '/api/mova/preferences') {
      const body = await readBody(request);
      delete body.componentsVersion;
      delete body.preferredTag;
      writePreferences(body);
      emitPreferences();
      json(response, 200, { message: 'Preferencias guardadas.' });
      return true;
    }
    return false;
  };
}
