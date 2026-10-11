import { getIndexedProject, readConfig } from "../../lib/core.js";
import { addLog } from '../../lib/runtime-events.js';
import { state } from "../../state.js";
import { openBrowser } from "../../services/browser-service.js";
import { selectedVersion } from "../../services/components-version-service.js";
import { ensureComponents } from "../../services/components-runtime-service.js";
import {
  assertNotCancelled,
  runProcessStep,
} from "../../services/process-runner-service.js";
import { RuntimeStateService } from "../../services/runtime-state-service.js";
import { MicrofrontendRuntimeService } from "../../services/microfrontend-runtime-service.js";
import {
  needsShellBuild,
  startShell,
} from "../../services/shell-runtime-service.js";
import { EnvironmentLifecycleService } from "./lifecycle.js";
import { EnvironmentOperationService } from "./operation.js";
import { EnvironmentSessionStateService } from "./session-state.js";

/** Orquesta el inicio y la reconstrucción de un entorno. */
export async function runEnvironment(projectId, options = {}) {
    if (state.shell.status !== "stopped")
      throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
    const project = getIndexedProject(projectId);
    if (!project) throw new Error("Shell no encontrada.");

    state.shell = {
      status: "preparing",
      url: null,
      projectId: project.id,
      name: project.name,
      appName: project.appName,
      external: false,
    };
    RuntimeStateService.emitState();
    addLog(
      "Entorno",
      "stage",
      "Iniciando proceso. Validando la shell y MOVA Components…",
    );

    let version;
    let microfrontend;
    let automaticBuild;
    try {
      version = await selectedVersion();
      if (!version)
        throw new Error(
          "Selecciona una versión de MOVA Components antes de iniciar la shell.",
        );
      microfrontend = options.microfrontendId
        ? project.microfrontends?.find(
            (item) => item.id === options.microfrontendId,
          )
        : null;
      if (options.microfrontendId && !microfrontend)
        throw new Error(
          "El microfrontend seleccionado no pertenece a esta shell.",
        );
      const buildMode = readConfig().shellDefaults.buildMode;
      const buildMissing = needsShellBuild(project);
      if (buildMissing && buildMode === "never") {
        throw new Error(
          `No existe el build local de ${project.appName || project.name}. La configuración global indica solo levantar, sin reconstruir.`,
        );
      }
      automaticBuild =
        buildMode === "always" || (buildMode === "automatic" && buildMissing);
      if (
        automaticBuild &&
        (!project.workflow?.prepareServer || !project.workflow?.buildLocal)
      ) {
        throw new Error(
          `No existe el build local de ${project.appName || project.name} y la shell no define prepare-server y build:local para generarlo automáticamente.`,
        );
      }
    } catch (error) {
      state.shell = {
        status: "stopped",
        url: null,
        projectId: null,
        name: null,
        appName: null,
        external: false,
      };
      RuntimeStateService.emitState();
      EnvironmentSessionStateService.updateSession({
        status: "error",
        stage: "error",
        plan: null,
        message: `Error: ${error.message}`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
      throw error;
    }

    const current = EnvironmentOperationService.start({
      projectId,
      microfrontendId: microfrontend?.id || null,
    });
    const signal = current.controller.signal;
    const plan = [
      "components",
      ...(automaticBuild ? ["prepare", "buildShell"] : []),
      ...(microfrontend ? ["microfrontend"] : []),
      "shell",
    ];
    EnvironmentSessionStateService.updateSession({
      status: "starting",
      stage: "validation",
      plan,
      message: "Validando la configuración inicial",
      projectId,
      projectName: project.name,
      startedAt: new Date().toISOString(),
    });

    try {
      await EnvironmentSessionStateService.runTrackedStage({
        stage: "components",
        message: `Compilando MOVA Components ${version.version}`,
        task: async () => {
          assertNotCancelled(signal);
          await ensureComponents(project, version, signal);
          assertNotCancelled(signal);
        },
      });
      if (automaticBuild) {
        await EnvironmentSessionStateService.runTrackedStage({
          stage: "prepare",
          message: `Preparando enlaces de ${project.appName || project.name}`,
          task: () =>
            runProcessStep({
              key: `prepare:${project.id}`,
              label: `${project.name} · prepare-server`,
              file: process.platform === "win32" ? "npm.cmd" : "npm",
              args: ["run", "prepare-server"],
              cwd: project.path,
              signal,
            }),
        });
        await EnvironmentSessionStateService.runTrackedStage({
          stage: "buildShell",
          message: `Compilando shell local ${project.appName || ""}`,
          task: () =>
            runProcessStep({
              key: `build-shell:${project.id}`,
              label: `${project.name} · build:local`,
              file: process.platform === "win32" ? "npm.cmd" : "npm",
              args: ["run", "build:local"],
              cwd: project.path,
              signal,
            }),
        });
      }
      if (microfrontend) {
        await EnvironmentSessionStateService.runTrackedStage({
          stage: "microfrontend",
          message: `Iniciando watch de ${microfrontend.name}`,
          task: async () => {
            assertNotCancelled(signal);
            MicrofrontendRuntimeService.startMicrofrontend(
              project,
              microfrontend,
              signal,
            );
          },
        });
      }
      await EnvironmentSessionStateService.runTrackedStage({
        stage: "shell",
        message: `Iniciando servidor HTTP de ${project.name}`,
        task: async () => {
          assertNotCancelled(signal);
          await startShell(project, signal);
          assertNotCancelled(signal);
        },
      });
      await EnvironmentSessionStateService.runTrackedStage({
        stage: "chrome",
        message: "Abriendo navegador autorizado.",
        task: async () => {
          assertNotCancelled(signal);
          await openBrowser(project, {
            newWindow: readConfig().browser.openMode === 'window',
          });
          assertNotCancelled(signal);
        },
      });
      EnvironmentSessionStateService.updateSession({
        status: "ready",
        stage: "ready",
        message: `${project.name} está disponible`,
        projectId,
        projectName: project.name,
      });
    } catch (error) {
      const cancelled = signal.aborted;
      addLog(
        "Entorno",
        cancelled ? "system" : "error",
        cancelled ? "Inicio cancelado por el usuario." : error.message,
      );
      await EnvironmentLifecycleService.cleanupStartedResources();
      EnvironmentSessionStateService.updateSession({
        status: cancelled ? "idle" : "error",
        stage: cancelled ? "idle" : "error",
        plan: null,
        message: cancelled ? "Inicio cancelado" : `Error: ${error.message}`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
    } finally {
      EnvironmentOperationService.end(current.id);
    }
  }

/**
 * Construye los argumentos de `npm run prepare-server` a partir de las
 * opciones elegidas por el usuario.
 *
 * El `package.json` de la shell fija el script como
 * `node scripts/prepare-server.mjs --remotes --link` (sin `--libs`, no
 * procesa librerías mova3 por defecto). Las opciones de acción (`libs`,
 * `remotes`, `link`) representan qué categorías procesar, con `remotes` y
 * `link` activos por defecto para replicar ese comportamiento fijo.
 *
 * Además, `prepare-server` delega en las mismas clases `ProjectChecker`/
 * `MicrofrontendProjectChecker` de `@mova3/lib-schematics` que usa
 * `check-project` para cada librería/remote incluido, por lo que acepta los
 * mismos flags de pasos (`--skip=update,check,install,build` y
 * `--forceBuild`), aplicados globalmente a todas las categorías activas.
 * @param {{ libs?: boolean, remotes?: boolean, link?: boolean, syncGit?: boolean, forceBuild?: boolean, skipBuild?: boolean, skipCheck?: boolean, localMode?: boolean }} [options]
 */
function buildPrepareServerArgs(options = {}) {
  const {
    libs = false,
    remotes = true,
    link = true,
    syncGit = true,
    forceBuild = false,
    skipBuild = false,
    skipCheck = false,
    localMode = false,
  } = options;
  const args = ["run", "prepare-server", "--"];
  if (libs) args.push("--libs");
  if (remotes) args.push("--remotes");
  if (link) args.push("--link");
  // Los pasos de ejecución (sync Git/check/install/build) y el comportamiento
  // (forceBuild/localMode) solo tienen efecto sobre los remotes procesados;
  // si `remotes` está desactivado no hay nada sobre lo que aplicarlos.
  if (remotes) {
    const skip = [];
    if (!syncGit) skip.push("update");
    if (skipCheck) skip.push("check", "install");
    if (skipBuild) skip.push("build");
    if (skip.length) args.push(`--skip=${skip.join(",")}`);
    if (forceBuild) args.push("--forceBuild");
    if (localMode) args.push("--local");
  }
  return args;
}

export async function prepareShellServer(projectId, options) {
    const { buildLocal = false } = options ?? {};
    const project = getIndexedProject(projectId);
    if (!project)
      throw new Error(
        "Shell no cargada. Actualiza el catálogo antes de reconstruir su servidor.",
      );
    if (state.shell.status !== "stopped" && state.shell.projectId === projectId)
      throw new Error("Detén la shell antes de reconstruir su servidor.");
    if (!project.workflow?.prepareServer)
      throw new Error("Esta shell no define npm run prepare-server.");
    if (buildLocal && !project.workflow?.buildLocal)
      throw new Error("Esta shell no define npm run build:local.");

    const current = EnvironmentOperationService.start({
      projectId,
      mode: "prepare-server",
    });
    const signal = current.controller.signal;
    EnvironmentSessionStateService.updateSession({
      status: "building",
      stage: "prepare",
      plan: buildLocal ? ["prepare", "buildShell"] : ["prepare"],
      message: "Preparando servidor local",
      projectId,
      projectName: project.name,
      startedAt: new Date().toISOString(),
    });
    try {
      await EnvironmentSessionStateService.runTrackedStage({
        stage: "prepare",
        message: "Preparar servidor de la shell",
        task: () =>
          runProcessStep({
            key: `prepare:${project.id}`,
            label: `${project.name} · prepare-server`,
            file: process.platform === "win32" ? "npm.cmd" : "npm",
            args: buildPrepareServerArgs(options),
            cwd: project.path,
            signal,
          }),
      });
      if (buildLocal) {
        await EnvironmentSessionStateService.runTrackedStage({
          stage: "buildShell",
          message: "Construir servidor local",
          task: () =>
            runProcessStep({
              key: `build-shell:${project.id}`,
              label: `${project.name} · build:local`,
              file: process.platform === "win32" ? "npm.cmd" : "npm",
              args: ["run", "build:local"],
              cwd: project.path,
              signal,
            }),
        });
      }
      EnvironmentSessionStateService.updateSession({
        status: "idle",
        stage: "idle",
        plan: null,
        message: `Servidor de ${project.name} preparado`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
    } catch (error) {
      const cancelled = signal.aborted;
      addLog(
        "Preparar servidor",
        cancelled ? "system" : "error",
        cancelled ? "Preparación cancelada." : error.message,
      );
      EnvironmentSessionStateService.updateSession({
        status: "idle",
        stage: "idle",
        plan: null,
        message: cancelled
          ? "Preparación cancelada"
          : `Error: ${error.message}`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
      throw error;
    } finally {
      EnvironmentOperationService.end(current.id);
    }
  }

export function startInBackground(projectId, options = {}) {
    void runEnvironment(projectId, options).catch((error) => {
      addLog(
        'Entorno',
        'error',
        error instanceof Error ? error.message : String(error),
      );
    });
  }

export function prepareShellServerInBackground(projectId, options) {
    void prepareShellServer(projectId, options).catch((error) => {
      addLog(
        'Preparar servidor',
        'error',
        error instanceof Error ? error.message : String(error),
      );
    });
  }
