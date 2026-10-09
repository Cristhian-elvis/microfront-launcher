import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { addLog } from './runtime-events.js';

export const staticServers = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function safeFile(root, requestPath, fallbackIndex, fallbackFile) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '') || (
    fallbackIndex ? 'index.html' : ''
  );
  const candidate = path.resolve(root, relative);
  const relation = path.relative(path.resolve(root), candidate);

  if (relation.startsWith('..') || path.isAbsolute(relation)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  if (fallbackIndex) {
    const index = path.join(root, 'index.html');
    if (fs.existsSync(index)) return index;
  }

  if (fallbackFile) {
    const fallback = path.resolve(root, fallbackFile);
    const fallbackRelation = path.relative(path.resolve(root), fallback);

    if (
      !fallbackRelation.startsWith('..')
      && !path.isAbsolute(fallbackRelation)
      && fs.existsSync(fallback)
      && fs.statSync(fallback).isFile()
    ) {
      return fallback;
    }
  }

  return null;
}

export function startStaticServer({
  key,
  label,
  root,
  port = 0,
  aliases = [],
  fallbackIndex = true,
  fallbackFile = null,
  cors = false,
  announce = true,
}) {
  if (!fs.existsSync(root)) {
    return Promise.reject(new Error(`No existe el compilado: ${root}`));
  }

  if (staticServers.has(key)) {
    return Promise.resolve(staticServers.get(key));
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (request.url === '/__launcher/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ service: key, root }));
        return;
      }

      let requestPath = request.url;
      for (const alias of aliases) {
        if (requestPath === alias || requestPath.startsWith(`${alias}/`)) {
          requestPath = requestPath.slice(alias.length) || '/';
          break;
        }
      }

      const filePath = safeFile(
        root,
        requestPath,
        fallbackIndex,
        fallbackFile,
      );

      if (!filePath) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Content-Type': mime[path.extname(filePath).toLowerCase()]
          || 'application/octet-stream',
        ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}),
      });
      fs.createReadStream(filePath).pipe(response);
    });

    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const record = {
        key,
        label,
        root,
        server,
        port: address.port,
        url: `http://127.0.0.1:${address.port}`,
      };

      staticServers.set(key, record);
      if (announce) {
        addLog(label, 'system', `Servidor disponible en ${record.url}`);
      }
      resolve(record);
    });
  });
}

export function stopStaticServer(key) {
  const record = staticServers.get(key);
  if (!record) return Promise.resolve(false);

  return new Promise((resolve) => {
    const finish = () => {
      staticServers.delete(key);
      addLog(record.label, 'system', 'Servidor detenido.');
      resolve(true);
    };

    record.server.close(finish);
    record.server.closeIdleConnections?.();
    record.server.closeAllConnections?.();
  });
}

export async function stopAllStaticServers() {
  await Promise.all([...staticServers.keys()].map(stopStaticServer));
}
