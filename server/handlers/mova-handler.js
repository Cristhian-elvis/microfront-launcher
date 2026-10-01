import {
  getVersions,
  getVersionByTag,
  refreshTags,
  writePreferences
} from "./../lib/core.js";
import {
  addLog
} from "./../lib/runtime.js";
import { json, readBody } from "./../lib/http.js";

export function createMovaHandler({ emitPreferences, compileVersion, cancelBuild, getLatestVersion }) {
  return async function handleMovaRequest(request, response, url) {
    const { method, pathname } = { method: request.method, pathname: url.pathname };
    if (method === 'GET' && pathname === '/api/mova/versions') {
      json(response, 200, await getVersions());
      return true;
    }
    if (method === 'PUT' && pathname === '/api/mova/preferences') {
      const body = await readBody(request);
      const requested = body.componentsVersion || (body.preferredTag !== undefined
        ? { mode: 'manual', selectedTag: body.preferredTag }
        : null);
      if (!requested || !['latest', 'manual'].includes(requested.mode)) {
        json(response, 400, { error: 'Selecciona una estrategia de versión válida.' });
        return true;
      }
      if (requested.mode === 'manual' && requested.selectedTag && !await getVersionByTag(requested.selectedTag)) {
        json(response, 400, { error: 'El tag seleccionado no existe.' });
        return true;
      }
      const preferences = writePreferences({ componentsVersion: requested });
      emitPreferences();
      json(response, 200, preferences);
      return true;
    }
    if (method === 'GET' && pathname === '/api/mova/latest') {
      const projectId = url.searchParams.get('projectId');
      if (!projectId) {
        json(response, 400, { error: 'Selecciona una shell para consultar la última versión.' });
        return true;
      }
      json(response, 200, await getLatestVersion(projectId));
      return true;
    }
    if (method === 'POST' && pathname === '/api/mova/tags/refresh') {
      addLog('Versiones', 'stage', 'Actualizando tags desde el remoto');
      const tags = await refreshTags();
      addLog('Versiones', 'success', `${tags.length} tags disponibles tras actualizar.`);
      json(response, 200, { ok: true, tags, message: `${tags.length} tags disponibles tras actualizar.` });
      return true;
    }
    if (method === 'POST' && pathname === '/api/mova/build') {
      const { tag } = await readBody(request);
      compileVersion(tag).catch(() => {});
      json(response, 202, { ok: true, message: `Compilación de ${tag} iniciada.` });
      return true;
    }
    if (method === 'POST' && pathname === '/api/mova/build/cancel') {
      cancelBuild();
      json(response, 202, { ok: true, message: 'Cancelando compilación de MOVA.' });
      return true;
    }
    return false;
  };
}
