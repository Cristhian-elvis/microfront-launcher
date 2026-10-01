import fs from "node:fs";
import path from "node:path";
import { getVersionByTag } from "../lib/core.js";

function appConfigForProject(project) {
  const candidates = [];
  if (project?.webappPath) {
    candidates.push(path.join(project.webappPath, "config", path.basename(project.webappPath), "app-config.json"));
  }
  if (project?.path && project?.configFolder) {
    candidates.push(path.join(project.path, "config", project.configFolder, "app-config.json"));
  }
  for (const filePath of candidates) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      // Probamos la configuración enlazada de la shell como respaldo.
    }
  }
  return null;
}

function packageUrlFromConfig(appConfig) {
  const environment = appConfig?.environment || appConfig?.enviroment || appConfig;
  const cdnHost = String(environment?.cdnHost || "").trim();
  const folder = String(environment?.stencilComponentsFolderName || "").trim();
  if (!cdnHost || !folder) return null;
  return new URL(`${folder.replace(/^\/+|\/+$/g, "")}/package.json`, `${cdnHost.replace(/\/+$/, "")}/`).toString();
}

export async function latestVersion(project) {
  const appConfig = appConfigForProject(project);
  const packageUrl = packageUrlFromConfig(appConfig);
  if (!packageUrl) {
    throw new Error("No se encontró environment.cdnHost o stencilComponentsFolderName en el app-config.json de la webapp.");
  }
  let response;
  try {
    response = await fetch(packageUrl, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Error("No se pudo consultar el package.json publicado de MOVA Components.");
  }
  if (!response.ok) throw new Error(`No se pudo consultar la última versión publicada (HTTP ${response.status}).`);
  const packageJson = await response.json();
  const publishedVersion = String(packageJson?.version || "").trim();
  if (!publishedVersion) throw new Error("El package.json publicado no contiene una versión válida.");
  const tag = publishedVersion.startsWith("release-") ? publishedVersion : `release-${publishedVersion}`;
  const version = await getVersionByTag(tag);
  if (!version) throw new Error(`La versión publicada ${publishedVersion} requiere el tag local ${tag}, pero no está disponible.`);
  return { ...version, packageUrl, source: "latest" };
}

/** Resuelve la versión de MOVA Components para una shell concreta. */
export async function selectedVersion(project) {
  return latestVersion(project);
}
