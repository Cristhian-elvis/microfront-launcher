const WEBAPP_NAME_PATTERN = /^([a-z0-9]{4})_webapp_/i;

export function projectDisplayName(name) {
  const value = String(name || "");
  const match = value.match(WEBAPP_NAME_PATTERN);
  return (match?.[1] || value || "Ninguna").toUpperCase();
}
