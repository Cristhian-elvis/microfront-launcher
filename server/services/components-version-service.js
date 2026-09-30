import { getVersions, readPreferences } from "../lib/core.js";

/** Resuelve la versión de MOVA Components elegida para el entorno actual. */
export async function selectedVersion() {
  const preferences = readPreferences();
  if (!preferences.preferredTag) return null;
  const versions = await getVersions();
  return versions.find((item) => item.tag === preferences.preferredTag) || null;
}
