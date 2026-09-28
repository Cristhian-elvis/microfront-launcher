import { getVersions, readPreferences } from "../lib/core.js";

/** Resuelve la versión de MOVA Components elegida para el entorno actual. */
export function selectedVersion() {
  const preferences = readPreferences();
  if (!preferences.preferredTag) return null;
  return getVersions().find((item) => item.tag === preferences.preferredTag) || null;
}
