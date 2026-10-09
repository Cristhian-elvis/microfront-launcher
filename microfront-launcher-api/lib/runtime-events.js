export const eventClients = new Set();
export const logs = [];

export function emit(type, payload) {
  const event = { type, payload, at: new Date().toISOString() };
  const encoded = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of eventClients) {
    client.write(encoded);
  }
}

export function addLog(source, level, message) {
  const entry = {
    id: `${Date.now()}-${Math.random()}`,
    source,
    level,
    message: String(message).trimEnd(),
    at: new Date().toISOString(),
  };

  if (!entry.message) return;

  logs.push(entry);
  if (logs.length > 1200) {
    logs.splice(0, logs.length - 1200);
  }

  emit('log', entry);
}
