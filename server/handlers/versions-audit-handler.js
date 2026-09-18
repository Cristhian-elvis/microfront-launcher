/**
 * Versions Audit Handler
 * ----------------------
 * Expone endpoints para:
 * - Auditar versiones locales (package.json) vs versiones configuradas por entorno (app-config.json).
 * - Actualizar (sincronizar) las versiones en app-config.json usando como fuente de verdad el
 *   package.json de cada microfront.
 *
 * Objetivo de negocio:
 * - Reducir el drift de versiones entre microfronts locales y lo que la Shell “cree” que está usando
 *   por ambiente (des/val/prod/local).
 * - Dar un flujo seguro de “alineación” de versiones con guardrails: solo permite actualizar si
 *   TODOS los microfronts están en main/master (regla solicitada en el prompt inicial).
 *
 * Contratos / Estructura esperada:
 * - Los app-config.json viven en: <webappPath>/config/{des|val|prod|<localDynamic>}/app-config.json
 * - El entorno "local" es dinámico y se resuelve con basename(<webappPath>).
 *
 * Importante:
 * - El update es de scope estricto: solo actualiza `remotes.<mf>.version` si la clave ya existe.
 * - NO modifica `remoteEntry` y NO crea nuevas entradas de remotes.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  readJson,
  writeJson,
  getIndexedProject,
  getProjects,
} from "../lib/core.js";

const execFileAsync = promisify(execFile);

function normalizeBranch(branch) {
  return String(branch || "").trim();
}

async function readCurrentBranch(repoPath) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoPath, "branch", "--show-current"],
      { encoding: "utf8", windowsHide: true },
    );
    return stdout.trim() || "HEAD";
  } catch {
    return "No disponible";
  }
}

function assertProjectHasWebapp(project) {
  if (!project?.webappPath) throw new Error("La shell no tiene webapp asociada.");
}

function environmentConfigPaths(webappPath) {
  // Estructura confirmada por usuario:
  // <webappPath>/config/{des|val|prod|<localDynamic>}/app-config.json
  const configRoot = path.join(webappPath, "config");
  const localDynamic = path.basename(webappPath);
  return {
    des: path.join(configRoot, "des", "app-config.json"),
    val: path.join(configRoot, "val", "app-config.json"),
    prod: path.join(configRoot, "prod", "app-config.json"),
    local: path.join(configRoot, localDynamic, "app-config.json"),
  };
}

function readEnvironmentAppConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath, null);
}

function getRemoteMap(appConfig) {
  const remotes = appConfig?.remotes;
  return remotes && typeof remotes === "object" ? remotes : {};
}

function getRemoteVersion(remote) {
  return remote?.version ?? null;
}

function isRemoteLinkedToLocal(remoteEntry) {
  return String(remoteEntry || "").includes("localhost:8080");
}

function buildAuditRows({ project, microfrontendsByName, environments }) {
  const rows = [];

  for (const [name, mf] of microfrontendsByName.entries()) {
    const mfVersion = mf.packageVersion;
    const mfBranch = mf.branch;

    const envStatus = {};
    for (const [envName, env] of Object.entries(environments)) {
      const remote = env?.remotes?.[name] || null;
      envStatus[envName] = {
        remoteEntry: remote?.remoteEntry ?? null,
        version: getRemoteVersion(remote),
        matches: Boolean(mfVersion && getRemoteVersion(remote) === mfVersion),
        linkedToLocal: isRemoteLinkedToLocal(remote?.remoteEntry),
      };
    }

    rows.push({
      microfrontend: {
        name,
        id: mf.id,
        path: mf.path,
        version: mfVersion,
        branch: mfBranch,
      },
      environments: envStatus,
      overallMatches: Object.values(envStatus).every((s) => s.matches),
    });
  }

  rows.sort((a, b) =>
    a.microfrontend.name.localeCompare(b.microfrontend.name, "es"),
  );
  return rows;
}

function canUpdateAllMicrofronts(rows) {
  // Validation rule: enable only if ALL are in main/master
  return rows.every((row) =>
    ["main", "master"].includes(normalizeBranch(row.microfrontend.branch)),
  );
}

async function readMicrofrontPackageVersion(microfrontPath) {
  const packagePath = path.join(microfrontPath, "package.json");
  if (!fs.existsSync(packagePath)) return null;
  const pkg = readJson(packagePath, {});
  return pkg?.version ?? null;
}

async function buildMicrofrontendsIndex(project) {
  const microfrontends = Array.isArray(project.microfrontends)
    ? project.microfrontends
    : [];

  const byName = new Map();
  await Promise.all(
    microfrontends.map(async (mf) => {
      const packageVersion = await readMicrofrontPackageVersion(mf.path);
      const branch = await readCurrentBranch(mf.path);
      byName.set(mf.name, {
        id: mf.id,
        name: mf.name,
        path: mf.path,
        branch,
        packageVersion,
      });
    }),
  );
  return byName;
}

export function createVersionsAuditHandler({ json, readBody }) {
  return async function handleVersionsAuditRequest(request, response, url) {
    const { method, pathname } =
      request.method === "OPTIONS"
        ? request
        : { method: request.method, pathname: url.pathname };

    if (method === "GET" && pathname === "/api/versions-audit") {
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        json(response, 400, { error: "Falta projectId" });
        return true;
      }

      const project =
        getIndexedProject(projectId) ||
        (await getProjects()).find((p) => p.id === projectId);

      if (!project) {
        json(response, 404, { error: "Shell no encontrada" });
        return true;
      }
      assertProjectHasWebapp(project);

      const envPaths = environmentConfigPaths(project.webappPath);
      const environments = Object.fromEntries(
        Object.entries(envPaths).map(([envName, filePath]) => {
          const appConfig = readEnvironmentAppConfig(filePath);
          return [
            envName,
            {
              path: filePath,
              exists: Boolean(appConfig),
              remotes: getRemoteMap(appConfig),
            },
          ];
        }),
      );

      const microfrontendsByName = await buildMicrofrontendsIndex(project);
      const rows = buildAuditRows({
        project,
        microfrontendsByName,
        environments,
      });

      json(response, 200, {
        projectId,
        webappPath: project.webappPath,
        environments: Object.fromEntries(
          Object.entries(environments).map(([k, v]) => [
            k,
            { path: v.path, exists: v.exists },
          ]),
        ),
        rows,
        canUpdate: canUpdateAllMicrofronts(rows),
      });
      return true;
    }

    if (method === "POST" && pathname === "/api/versions-audit/update") {
      const body = await readBody(request);
      const projectId = body?.projectId;
      if (!projectId) {
        json(response, 400, { error: "Falta projectId" });
        return true;
      }

      const project =
        getIndexedProject(projectId) ||
        (await getProjects()).find((p) => p.id === projectId);

      if (!project) {
        json(response, 404, { error: "Shell no encontrada" });
        return true;
      }
      assertProjectHasWebapp(project);

      const microfrontendsByName = await buildMicrofrontendsIndex(project);

      // Pre-calc audit to enforce validation rule server-side too
      const envPaths = environmentConfigPaths(project.webappPath);
      const environments = Object.fromEntries(
        Object.entries(envPaths).map(([envName, filePath]) => {
          const appConfig = readEnvironmentAppConfig(filePath);
          return [
            envName,
            {
              path: filePath,
              exists: Boolean(appConfig),
              remotes: getRemoteMap(appConfig),
              appConfig,
            },
          ];
        }),
      );

      const rows = buildAuditRows({
        project,
        microfrontendsByName,
        environments,
      });

      if (!canUpdateAllMicrofronts(rows)) {
        json(response, 400, {
          error:
            "No se puede actualizar: todos los microfronts deben estar en main o master.",
        });
        return true;
      }

      // Strict scope: update only remotes.*.version (and keep remoteEntry as-is)
      const updatedEnvironments = [];
      for (const [envName, env] of Object.entries(environments)) {
        if (!env.exists || !env.appConfig) continue;

        const nextAppConfig = structuredClone(env.appConfig);
        const nextRemotes = getRemoteMap(nextAppConfig);

        for (const [mfName, mf] of microfrontendsByName.entries()) {
          if (!nextRemotes[mfName]) continue;
          nextRemotes[mfName] = {
            ...nextRemotes[mfName],
            version: mf.packageVersion ?? nextRemotes[mfName].version ?? null,
          };
        }

        nextAppConfig.remotes = nextRemotes;
        writeJson(env.path, nextAppConfig);

        updatedEnvironments.push(envName);
      }

      json(response, 200, { ok: true, updatedEnvironments });
      return true;
    }

    return false;
  };
}
