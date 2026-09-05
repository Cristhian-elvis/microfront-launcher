export function createMovaHandler({ getVersions, getTags, refreshTags, writePreferences, emitState, addLog, compileVersion, cancelBuild, readBody, json }) {
  return async function handleMovaRequest(request, response, url) {
    const { method, pathname } = { method: request.method, pathname: url.pathname };
    if (method === 'GET' && pathname === '/api/mova/versions') {
      json(response, 200, getVersions());
      return true;
    }
    if (method === 'PUT' && pathname === '/api/mova/preferences') {
      const body = await readBody(request);
      if (body.preferredTag && !getVersions().some((item) => item.tag === body.preferredTag)) {
        json(response, 400, { error: 'El tag seleccionado no existe.' });
        return true;
      }
      const preferences = writePreferences(body);
      emitState();
      json(response, 200, preferences);
      return true;
    }
    if (method === 'POST' && pathname === '/api/mova/tags/refresh') {
      addLog('Versiones', 'stage', 'Actualizando tags desde el remoto');
      const tags = refreshTags();
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
