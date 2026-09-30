import { spawnManaged, stopProcess } from "../lib/runtime.js";

export function assertNotCancelled(signal) {
  if (signal?.aborted) throw new Error("Operación cancelada");
}

/** Ejecuta un proceso finito y lo enlaza a una señal de cancelación. */
export async function runProcessStep({ key, label, file, args, cwd, signal }) {
  assertNotCancelled(signal);
  const record = spawnManaged({ key, label, file, args, cwd, longRunning: false });
  const abort = () => stopProcess(key);
  signal?.addEventListener("abort", abort, { once: true });
  const result = await record.done;
  signal?.removeEventListener("abort", abort);
  assertNotCancelled(signal);
  if (result.error) throw result.error;
  if (result.code !== 0)
    throw new Error(`${label} terminó con código ${result.code}.`);
}
