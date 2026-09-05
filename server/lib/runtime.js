import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const childProcesses = new Map();
export const staticServers = new Map();
export const eventClients = new Set();
export const logs = [];

export function emit(type, payload) {
  const event = { type, payload, at: new Date().toISOString() };
  const encoded = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of eventClients) client.write(encoded);
}

export function addLog(source, level, message) {
  const entry = {
    id: `${Date.now()}-${Math.random()}`,
    source,
    level,
    message: String(message).replace(/\u001b\[[0-9;]*m/g, '').trimEnd(),
    at: new Date().toISOString()
  };
  if (!entry.message) return;
  logs.push(entry);
  if (logs.length > 1200) logs.splice(0, logs.length - 1200);
  emit('log', entry);
}

export function processStatus() {
  return [...childProcesses.entries()].map(([key, item]) => ({
    key, pid: item.child.pid, label: item.label, startedAt: item.startedAt
  }));
}

export function spawnManaged({ key, label, file, args = [], cwd, shell = false, longRunning = true }) {
  const existing = childProcesses.get(key);
  if (existing && !existing.child.killed) return existing;
  if (!cwd || !fs.existsSync(cwd)) throw new Error(`La carpeta no existe: ${cwd}`);
  addLog(label, 'system', `Ejecutando: ${[file, ...args].join(' ')}`);
  const child = spawn(file, args, {
    cwd, shell, windowsHide: true,
    env: { ...process.env, FORCE_COLOR: '0' }
  });
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const record = { child, label, startedAt: new Date().toISOString(), done, longRunning, exitCode: null };
  childProcesses.set(key, record);
  child.stdout?.on('data', (chunk) => addLog(label, 'stdout', chunk.toString()));
  child.stderr?.on('data', (chunk) => addLog(label, 'stderr', chunk.toString()));
  child.on('error', (error) => addLog(label, 'error', error.message));
  child.on('exit', (code, signal) => {
    record.exitCode = code;
    addLog(label, code === 0 ? 'system' : 'error', `Proceso finalizado (código: ${code ?? '-'}, señal: ${signal ?? '-'})`);
    if (childProcesses.get(key)?.child === child) childProcesses.delete(key);
    resolveDone({ code, signal });
    emit('processes', processStatus());
  });
  emit('processes', processStatus());
  return record;
}

export function stopProcess(key) {
  const record = childProcesses.get(key);
  if (!record) return false;
  addLog(record.label, 'system', 'Deteniendo proceso...');
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(record.child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    record.child.kill('SIGTERM');
  }
  return true;
}

export async function stopAllProcesses() {
  const records = [...childProcesses.values()];
  for (const key of childProcesses.keys()) stopProcess(key);
  await Promise.race([
    Promise.all(records.map((record) => record.done)),
    new Promise((resolve) => setTimeout(resolve, 3500))
  ]);
}

export function waitForUrl(url, { timeoutMs = 90000, signal, processKey } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (signal?.aborted) return reject(new Error('Operación cancelada'));
      if (processKey && !childProcesses.has(processKey)) return reject(new Error(`El proceso terminó antes de responder: ${processKey}`));
      const request = http.get(url, { timeout: 2500 }, (response) => {
        response.resume();
        resolve({ ok: true, status: response.statusCode });
      });
      request.on('timeout', () => request.destroy());
      request.on('error', () => {
        if (signal?.aborted) reject(new Error('Operación cancelada'));
        else if (Date.now() >= deadline) reject(new Error(`Tiempo de espera agotado: ${url}`));
        else setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

export async function inspectHttp(url, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.on('data', (chunk) => { if (body.length < 200000) body += chunk.toString(); });
      response.on('end', () => resolve({ reachable: true, status: response.statusCode, body }));
    });
    request.on('timeout', () => { request.destroy(); resolve({ reachable: false, body: '' }); });
    request.on('error', () => resolve({ reachable: false, body: '' }));
  });
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function safeFile(root, requestPath, fallbackIndex, fallbackFile) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '') || (fallbackIndex ? 'index.html' : '');
  const candidate = path.resolve(root, relative);
  const relation = path.relative(path.resolve(root), candidate);
  if (relation.startsWith('..') || path.isAbsolute(relation)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (fallbackIndex) {
    const index = path.join(root, 'index.html');
    if (fs.existsSync(index)) return index;
  }
  if (fallbackFile) {
    const fallback = path.resolve(root, fallbackFile);
    const relation = path.relative(path.resolve(root), fallback);
    if (!relation.startsWith('..') && !path.isAbsolute(relation) && fs.existsSync(fallback) && fs.statSync(fallback).isFile()) return fallback;
  }
  return null;
}

export function startStaticServer({ key, label, root, port = 0, aliases = [], fallbackIndex = true, fallbackFile = null, cors = false, announce = true }) {
  if (!fs.existsSync(root)) return Promise.reject(new Error(`No existe el compilado: ${root}`));
  if (staticServers.has(key)) return Promise.resolve(staticServers.get(key));
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (request.url === '/__launcher/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ service: key, root }));
      }
      let requestPath = request.url;
      for (const alias of aliases) {
        if (requestPath === alias || requestPath.startsWith(`${alias}/`)) {
          requestPath = requestPath.slice(alias.length) || '/';
          break;
        }
      }
      const filePath = safeFile(root, requestPath, fallbackIndex, fallbackFile);
      if (!filePath) { response.writeHead(404); return response.end('Not found'); }
      response.writeHead(200, {
        'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {})
      });
      fs.createReadStream(filePath).pipe(response);
    });
    server.once('error', (error) => reject(error));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const record = { key, label, root, server, port: address.port, url: `http://127.0.0.1:${address.port}` };
      staticServers.set(key, record);
      if (announce) addLog(label, 'system', `Servidor disponible en ${record.url}`);
      emit('servers', serverStatus());
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
      emit('servers', serverStatus());
      resolve(true);
    };
    record.server.close(finish);
    // El servidor es local y administrado por el launcher: cerrar conexiones
    // activas evita que un navegador con keep-alive retrase toda la detención.
    record.server.closeIdleConnections?.();
    record.server.closeAllConnections?.();
  });
}

export async function stopAllStaticServers() {
  await Promise.all([...staticServers.keys()].map(stopStaticServer));
}

export function serverStatus() {
  return [...staticServers.values()].map(({ key, label, port, url, root }) => ({ key, label, port, url, root }));
}
