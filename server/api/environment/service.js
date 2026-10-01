import { getIndexedProject, readConfig } from "../../lib/core.js";
import { addLog } from "../../lib/runtime.js";
import { state } from "../../state.js";
import { selectedVersion } from "../../services/components-version-service.js";
import { assertNotCancelled, runProcessStep } from "../../services/process-runner-service.js";

/** Orquesta el inicio y la reconstrucción de un entorno. */
export function createEnvironmentService({ session, lifecycle, operation, componentsRuntime, shellRuntime, microfrontendRuntime, openOrRequestBrowser, emitState }) {
  const { updateSession, runTrackedStage } = session;
  const { ensureComponents } = componentsRuntime;
  const { needsShellBuild, startShell } = shellRuntime;
  const { startMicrofrontend } = microfrontendRuntime;

  async function runEnvironment(projectId, options = {}) {
    if (state.shell.status !== "stopped") throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
    const project = getIndexedProject(projectId);
    if (!project) throw new Error("Shell no encontrada.");

    state.shell = { status: "preparing", url: null, projectId: project.id, name: project.name, appName: project.appName, external: false };
    emitState();
    addLog("Entorno", "stage", "Iniciando proceso. Validando la shell y MOVA Components…");

    let version;
    let microfrontend;
    let automaticBuild;
    try {
      version = await selectedVersion(project);
      if (!version) throw new Error("Selecciona una versión de MOVA Components antes de iniciar la shell.");
      microfrontend = options.microfrontendId
        ? project.microfrontends?.find((item) => item.id === options.microfrontendId)
        : null;
      if (options.microfrontendId && !microfrontend) throw new Error("El microfrontend seleccionado no pertenece a esta shell.");
      const buildMode = readConfig().shellDefaults.buildMode;
      const buildMissing = needsShellBuild(project);
      if (buildMissing && buildMode === "never") {
        throw new Error(`No existe el build local de ${project.appName || project.name}. La configuración global indica solo levantar, sin reconstruir.`);
      }
      automaticBuild = buildMode === "always" || (buildMode === "automatic" && buildMissing);
      if (automaticBuild && (!project.workflow?.prepareServer || !project.workflow?.buildLocal)) {
        throw new Error(`No existe el build local de ${project.appName || project.name} y la shell no define prepare-server y build:local para generarlo automáticamente.`);
      }
    } catch (error) {
      state.shell = { status: "stopped", url: null, projectId: null, name: null, appName: null, external: false };
      emitState();
      updateSession({ status: "error", stage: "error", plan: null, message: `Error: ${error.message}`, projectId: null, projectName: null, startedAt: null });
      throw error;
    }

    const current = operation.start({ projectId, microfrontendId: microfrontend?.id || null });
    const signal = current.controller.signal;
    const plan = ["components", ...(automaticBuild ? ["prepare", "buildShell"] : []), ...(microfrontend ? ["microfrontend"] : []), "shell"];
    updateSession({ status: "starting", stage: "validation", plan, message: "Validando la configuración inicial", projectId, projectName: project.name, startedAt: new Date().toISOString() });

    try {
      await runTrackedStage({ stage: "components", message: `Compilando MOVA Components ${version.version}`, task: async () => {
        assertNotCancelled(signal);
        await ensureComponents(project, version, signal);
        assertNotCancelled(signal);
      }});
      if (automaticBuild) {
        await runTrackedStage({ stage: "prepare", message: `Preparando enlaces de ${project.appName || project.name}`, task: () =>
          runProcessStep({ key: `prepare:${project.id}`, label: `${project.name} · prepare-server`, file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "prepare-server"], cwd: project.path, signal }) });
        await runTrackedStage({ stage: "buildShell", message: `Compilando shell local ${project.appName || ""}`, task: () =>
          runProcessStep({ key: `build-shell:${project.id}`, label: `${project.name} · build:local`, file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "build:local"], cwd: project.path, signal }) });
      }
      if (microfrontend) {
        await runTrackedStage({ stage: "microfrontend", message: `Iniciando watch de ${microfrontend.name}`, task: async () => {
          assertNotCancelled(signal);
          startMicrofrontend(project, microfrontend, signal);
        }});
      }
      await runTrackedStage({ stage: "shell", message: `Iniciando servidor HTTP de ${project.name}`, task: async () => {
        assertNotCancelled(signal);
        await startShell(project, signal);
        assertNotCancelled(signal);
      }});
      await runTrackedStage({ stage: "chrome", message: "Abriendo navegador autorizado.", task: async () => {
        assertNotCancelled(signal);
        await openOrRequestBrowser(project);
        assertNotCancelled(signal);
      }});
      updateSession({ status: "ready", stage: "ready", message: `${project.name} está disponible`, projectId, projectName: project.name });
    } catch (error) {
      const cancelled = signal.aborted;
      addLog("Entorno", cancelled ? "system" : "error", cancelled ? "Inicio cancelado por el usuario." : error.message);
      await lifecycle.cleanupStartedResources();
      updateSession({ status: cancelled ? "idle" : "error", stage: cancelled ? "idle" : "error", plan: null, message: cancelled ? "Inicio cancelado" : `Error: ${error.message}`, projectId: null, projectName: null, startedAt: null });
    } finally {
      operation.end(current.id);
    }
  }

  async function rebuildShellServer(projectId) {
    const project = getIndexedProject(projectId);
    if (!project) throw new Error("Shell no cargada. Actualiza el catálogo antes de reconstruir su servidor.");
    if (state.shell.status !== "stopped" && state.shell.projectId === projectId) throw new Error("Detén la shell antes de reconstruir su servidor.");
    if (!project.workflow?.prepareServer || !project.workflow?.buildLocal) throw new Error("Esta shell no define npm run prepare-server y npm run build:local.");

    const current = operation.start({ projectId, mode: "rebuild-server" });
    const signal = current.controller.signal;
    updateSession({ status: "building", stage: "prepare", plan: ["prepare", "buildShell"], message: "Reconstruyendo servidor local", projectId, projectName: project.name, startedAt: new Date().toISOString() });
    try {
      await runTrackedStage({ stage: "prepare", message: "Preparar servidor de la shell", task: () =>
        runProcessStep({ key: `prepare:${project.id}`, label: `${project.name} · prepare-server`, file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "prepare-server"], cwd: project.path, signal }) });
      await runTrackedStage({ stage: "buildShell", message: "Construir servidor local", task: () =>
        runProcessStep({ key: `build-shell:${project.id}`, label: `${project.name} · build:local`, file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "build:local"], cwd: project.path, signal }) });
      updateSession({ status: "idle", stage: "idle", plan: null, message: `Servidor de ${project.name} reconstruido`, projectId: null, projectName: null, startedAt: null });
    } catch (error) {
      const cancelled = signal.aborted;
      addLog("Reconstruir servidor", cancelled ? "system" : "error", cancelled ? "Reconstrucción cancelada." : error.message);
      updateSession({ status: "idle", stage: "idle", plan: null, message: cancelled ? "Reconstrucción cancelada" : `Error: ${error.message}`, projectId: null, projectName: null, startedAt: null });
      throw error;
    } finally {
      operation.end(current.id);
    }
  }

  return { runEnvironment, rebuildShellServer };
}
