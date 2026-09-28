function rejectMethod(request, response, json) {
  if (request.method === "POST") return false;
  json(response, 405, { error: "Método no permitido" });
  return true;
}

/**
 * Adaptador HTTP del dominio environment.
 * Cada método es invocado únicamente por su router correspondiente.
 */
export function createEnvironmentHandler({ environmentModel, readBody, json }) {
  return {
    async start(request, response) {
      if (rejectMethod(request, response, json)) return;
      const { projectId, microfrontendId, rebuildShell } = await readBody(request);
      environmentModel.start({ projectId, microfrontendId, rebuildShell });
      json(response, 202, { ok: true });
    },

    async rebuildShell(request, response) {
      if (rejectMethod(request, response, json)) return;
      const { projectId } = await readBody(request);
      environmentModel.rebuildShell({ projectId });
      json(response, 202, {
        ok: true,
        message: "Reconstrucción del servidor iniciada.",
      });
    },

    async cancel(request, response) {
      if (rejectMethod(request, response, json)) return;
      await environmentModel.stop("Inicio cancelado");
      json(response, 200, { ok: true });
    },

    async stop(request, response) {
      if (rejectMethod(request, response, json)) return;
      await environmentModel.stop("Entorno detenido");
      json(response, 200, { ok: true });
    },
  };
}
