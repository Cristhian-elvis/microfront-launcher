export function createLauncherHandler({ checkLauncherUpdates, json }) {
  return async function handleLauncherRequest(request, response, url) {
    if (request.method !== 'POST' || url.pathname !== '/api/launcher/check-updates') return false;
    json(response, 200, await checkLauncherUpdates());
    return true;
  };
}
