import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

import { addLog } from './runtime-events.js';

export const childProcesses = new Map();

export function spawnManaged({
  key,
  label,
  file,
  args = [],
  cwd,
  shell = false,
  longRunning = true,
}) {
  const existing = childProcesses.get(key);
  if (existing && !existing.child.killed) return existing;

  if (!cwd || !fs.existsSync(cwd)) {
    throw new Error(`La carpeta no existe: ${cwd}`);
  }

  addLog(label, 'system', `Ejecutando: ${[file, ...args].join(' ')}`);

  const useShell = shell
    || (process.platform === 'win32' && /\.(cmd|bat)$/i.test(file));
  const child = spawn(file, args, {
    cwd,
    shell: useShell,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const record = {
    child,
    label,
    startedAt: new Date().toISOString(),
    done,
    longRunning,
    exitCode: null,
  };
  childProcesses.set(key, record);

  let settled = false;
  const finish = (result) => {
    if (settled) return;

    settled = true;
    if (childProcesses.get(key)?.child === child) {
      childProcesses.delete(key);
    }
    resolveDone(result);
  };

  child.stdout?.on('data', (chunk) => {
    addLog(label, 'stdout', chunk.toString());
  });
  child.stderr?.on('data', (chunk) => {
    addLog(label, 'stderr', chunk.toString());
  });
  child.on('error', (error) => {
    addLog(label, 'error', error.message);
    finish({ code: null, signal: null, error });
  });
  child.on('exit', (code, signal) => {
    record.exitCode = code;
    addLog(
      label,
      code === 0 ? 'system' : 'error',
      `Proceso finalizado (código: ${code ?? '-'}, señal: ${signal ?? '-'})`,
    );
    finish({ code, signal });
  });

  return record;
}

export function stopProcess(key) {
  const record = childProcesses.get(key);
  if (!record) return false;

  addLog(record.label, 'system', 'Deteniendo proceso...');

  if (process.platform === 'win32') {
    spawn(
      'taskkill',
      ['/PID', String(record.child.pid), '/T', '/F'],
      { windowsHide: true },
    );
  } else {
    record.child.kill('SIGTERM');
  }

  return true;
}

export async function stopAllProcesses() {
  const records = [...childProcesses.values()];

  for (const key of childProcesses.keys()) {
    stopProcess(key);
  }

  await Promise.race([
    Promise.all(records.map((record) => record.done)),
    new Promise((resolve) => setTimeout(resolve, 3500)),
  ]);
}

export function waitForUrl(
  url,
  { timeoutMs = 90000, signal, processKey } = {},
) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (signal?.aborted) {
        reject(new Error('Operación cancelada'));
        return;
      }

      if (processKey && !childProcesses.has(processKey)) {
        reject(
          new Error(`El proceso terminó antes de responder: ${processKey}`),
        );
        return;
      }

      const request = http.get(url, { timeout: 2500 }, (response) => {
        response.resume();
        resolve({ ok: true, status: response.statusCode });
      });

      request.on('timeout', () => request.destroy());
      request.on('error', () => {
        if (signal?.aborted) {
          reject(new Error('Operación cancelada'));
        } else if (Date.now() >= deadline) {
          reject(new Error(`Tiempo de espera agotado: ${url}`));
        } else {
          setTimeout(attempt, 1000);
        }
      });
    };

    attempt();
  });
}
