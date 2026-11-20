import http from 'node:http';

export function inspectHttp(url, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';

      response.on('data', (chunk) => {
        if (body.length < 200000) {
          body += chunk.toString();
        }
      });
      response.on('end', () => {
        resolve({
          reachable: true,
          status: response.statusCode,
          body,
        });
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ reachable: false, body: '' });
    });
    request.on('error', () => resolve({ reachable: false, body: '' }));
  });
}
