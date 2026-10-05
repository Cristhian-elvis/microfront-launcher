import fs from "node:fs";
import path from "node:path";
import { readConfig } from "../lib/core.js";
import {
  addLog,
  inspectHttp,
  startStaticServer,
  waitForUrl,
} from "../lib/runtime.js";
import { state } from "../state.js";
import { assertNotCancelled } from "./process-runner-service.js";
import { RuntimeStateService } from "./runtime-state-service.js";

function shellBuildIndex(project) {
  return path.join(project.serverPath, project.appName || "", "index.html");
}

export function createShellRuntimeService() {
  function needsShellBuild(project) {
    return !project.appName || !fs.existsSync(shellBuildIndex(project));
  }

  async function startShell(project, signal) {
    assertNotCancelled(signal);
    if (state.shell.status !== "preparing" || state.shell.projectId !== project.id)
      throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
    if (!project.appName)
      throw new Error(
        "La shell no tiene una aplicación enlazada. Ejecuta primero scaffolding.",
      );
    const configuredPort = Number(readConfig().shellDefaults.serverPort || 8080);
    const shellUrl = new URL(project.url);
    shellUrl.port = String(configuredPort);
    const occupied = await inspectHttp(shellUrl.toString());
    if (occupied.reachable)
      throw new Error(
        `El puerto ${configuredPort} ya está ocupado por otra shell o servicio.`,
      );
    const appIndex = shellBuildIndex(project);
    addLog(project.name, "system", `Validando build local: ${appIndex}`);
    if (!fs.existsSync(appIndex)) {
      const message = `No existe el build local de ${project.appName}. Usa “Reconstruir antes de iniciar”.`;
      addLog(project.name, "error", message);
      throw new Error(message);
    }
    addLog(project.name, "system", "Build local encontrado. Iniciando la shell.");
    state.shell = {
      status: "starting", url: shellUrl.toString(), projectId: project.id,
      name: project.name, appName: project.appName, external: false,
    };
    RuntimeStateService.emitState();
    await startStaticServer({
      key: "shell", label: project.name, root: project.serverPath,
      port: configuredPort, fallbackIndex: false,
      fallbackFile: path.join(project.appName, "index.html"), cors: true,
    });
    await waitForUrl(shellUrl.toString(), { signal });
    state.shell = {
      status: "running", url: shellUrl.toString(), projectId: project.id,
      name: project.name, appName: project.appName, external: false,
    };
    RuntimeStateService.emitState();
  }

  return { needsShellBuild, startShell };
}
