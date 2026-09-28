/** Controla una única operación activa del entorno y su cancelación. */
export function createEnvironmentOperation({ onChange }) {
  let current = null;

  function start(details = {}) {
    if (current) throw new Error("Ya hay una operación de entorno en curso.");
    current = {
      id: `${Date.now()}-${Math.random()}`,
      controller: new AbortController(),
      ...details,
    };
    onChange();
    return current;
  }

  function end(id) {
    if (current?.id !== id) return;
    current = null;
    onChange();
  }

  function clear() {
    current = null;
    onChange();
  }

  return {
    start,
    end,
    get: () => current,
    isRunning: () => Boolean(current),
    clear,
  };
}
