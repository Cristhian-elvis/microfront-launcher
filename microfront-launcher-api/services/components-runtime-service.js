import fs from "node:fs";
import path from "node:path";
import { assertInside, versionsRoot } from "../lib/core.js";
import { addLog } from "../lib/runtime.js";
import { state } from "../state.js";
import { assertNotCancelled } from "./process-runner-service.js";
import { RuntimeStateService } from "./../services/runtime-state-service.js";

function componentsLinkPath(project) {
  return path.join(project.serverPath, "cudc-lib-componentes-stencil-VAL");
}

function isPathInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveLinkTarget(link) {
  try {
    return fs.realpathSync.native(link);
  } catch {
    return path.resolve(path.dirname(link), fs.readlinkSync(link));
  }
}

function inspectComponentsLink(link) {
  try {
    const info = fs.lstatSync(link);
    if (!info.isSymbolicLink())
      return { kind: info.isDirectory() ? "directory" : "file" };
    const target = resolveLinkTarget(link);
    return {
      kind: "link",
      target,
      managed: path.basename(target).toLowerCase() === "dist" && isPathInside(versionsRoot, target),
    };
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "missing" };
    throw error;
  }
}

function replaceManagedComponentsLink(link) {
  const existing = inspectComponentsLink(link);
  if (existing.kind === "missing") return;
  if (existing.kind === "link" && existing.managed) {
    addLog("MOVA Components", "system", `Reemplazando asociación administrada: ${existing.target}`);
    fs.rmSync(link, { recursive: true, force: true });
    return;
  }
  const detail = existing.target ? ` (${existing.target})` : "";
  throw new Error(
    `La ruta de MOVA Components ya existe como ${existing.kind}${detail} y no fue creada por el launcher.`,
  );
}

export function createComponentsRuntimeService({ buildComponents }) {
  async function ensureComponents(project, version, signal) {
    assertNotCancelled(signal);
    if (!version)
      throw new Error("Selecciona una versión de MOVA Components antes de iniciar la shell.");
    const paths = await buildComponents(version, signal);
    const link = componentsLinkPath(project);
    assertInside(project.serverPath, link);
    addLog("MOVA Components", "stage", `Verificando asociación para ${version.tag}.`);
    replaceManagedComponentsLink(link);
    assertNotCancelled(signal);
    addLog("MOVA Components", "stage", "Creando asociación de Components en server.");
    fs.symlinkSync(paths.dist, link, "junction");
    state.components = {
      status: "running", url: project.url, version: version.version,
      tag: version.tag, external: false,
    };
    addLog("MOVA Components", "success", "Asociación creada correctamente.");
    RuntimeStateService.emitState();
  }

  return { ensureComponents };
}
