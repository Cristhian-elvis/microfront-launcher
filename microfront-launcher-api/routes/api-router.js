export function createApiRouter(handlers) {
  return async function routeApi(request, response, url) {
    for (const handler of handlers) {
      if (await handler(request, response, url)) return true;
    }
    return false;
  };
}
