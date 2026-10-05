import { readConfig } from "../lib/core.js";

// Temporalmente fijo; pasará a configuración cuando se defina esa pantalla.
function publishedPackageUrl() {
  const { cdnHost, stencilComponentsFolderName } = readConfig().mova;
  const host = String(cdnHost || '').trim().replace(/\/+$/, '');
  const folder = String(stencilComponentsFolderName || '').trim().replace(/^\/+|\/+$/g, '');
  if (!host || !folder) {
    throw new Error('Configura mova.cdnHost y mova.stencilComponentsFolderName para consultar la versión publicada.');
  }
  return `${host}/${folder}/package.json`;
}

export async function latestVersion() {
  const packageUrl = publishedPackageUrl();
  let response;
  try {
    response = await fetch(packageUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "curl/8.0.1" },
    });
  } catch {
    throw new Error("No se pudo consultar el package.json publicado de MOVA Components.");
  }
  if (!response.ok) {
    throw new Error(
      `El CDN rechazó la lectura de ${packageUrl} (HTTP ${response.status}). `
      + 'Verifica que el package.json esté publicado y sea accesible para tu usuario.',
    );
  }
  const packageJson = await response.json();
  const publishedVersion = String(packageJson?.version || "").trim();
  if (!publishedVersion) throw new Error("El package.json publicado no contiene una versión válida.");
  const tag = publishedVersion.startsWith("release-") ? publishedVersion : `release-${publishedVersion}`;
  // Bootstrap only checks the published version. The local tag is checked when
  // Components or a shell starts, immediately before compilation.
  return {
    tag,
    version: publishedVersion.replace(/^release-/, ""),
    cached: false,
    packageUrl,
    source: "latest",
  };
}

/** Resuelve la versión de MOVA Components para una shell concreta. */
export async function selectedVersion() {
  return latestVersion();
}
