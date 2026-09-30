import { getIndexedProject, readConfig } from "../../lib/core.js";
import { addLog } from "../../lib/runtime.js";
import { state } from "../../state.js";
import { selectedVersion } from "../../services/components-version-service.js";
import {
  assertNotCancelled,
  runProcessStep,
} from "../../services/process-runner-service.js";

/** Orquesta el inicio y la reconstrucción de un entorno. */
export function createEnvironmentService({
  execution,
  lifecycle,
  operation,
  componentsRuntime,
  shellRuntime,
  microfrontendRuntime,
  openOrRequestBrowser,
  emitState,
}) {
  const {
    beginExecution,
    updateExecution,
    updateExecutionStep,
    updateSession,
    recordStartValidationError,
    runTrackedStage,
    clearExecutionForRestart,
  } = execution;
  const { ensureComponents } = componentsRuntime;
  const { needsShellBuild, startShell } = shellRuntime;
  const { startMicrofrontend } = microfrontendRuntime;

  async function runEnvironment(projectId, options = {}) {
    clearExecutionForRestart();

      if (state.shell.status !== "stopped") {
        throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
      }

      addLog(
        "Entorno",
        "stage",
        "Iniciando proceso. Validando la shell y MOVA Components…",
      );
      // AÑADIDO: await
      const project = getIndexedProject(projectId);
      if (!project) throw new Error("Shell no encoFntrada.");
      const validationStartedAt = new Date().toISOString();
      let version;
      let microfrontend;
      let automaticBuild;

    try {
      
      console.log("selectedVersion start", new Date().toISOString());
      version = await selectedVersion();
      console.log("selectedVersion end", version, new Date().toISOString());
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
      updateExecutionStep("validation", {
        status: "success",
        endedAt: new Date().toISOString(),
      });
      console.log("updateExecutionStep")
    } catch (error) {
      recordStartValidationError(project, error);
      throw error;
    }

    const current = operation.start({
      projectId,
      microfrontendId: microfrontend?.id || null,
    });
    const signal = current.controller.signal;
    const plan = [
      ...(["components"]),
      ...(automaticBuild ? ["prepare", "buildShell"] : []),
      ...(microfrontend ? ["microfrontend"] : []),
      "shell",
    ];
    const steps = [
      {
        id: "validation",
        label: "Validar inicio",
        command: "Validar shell y MOVA Components",
        detail: "Comprobando el build local y la configuración requerida.",
      },
      ...([
            {
              id: "components",
              label: "MOVA Components",
              command: "Compilar Components en la shell",
              detail:
                "Instalando la librería dentro de server/cudc-lib-componentes-stencil-VAL",
            },
          ]),
      ...(automaticBuild
        ? [
            {
              id: "prepare",
              label: "Preparar servidor",
              command: "Preparar servidor de la shell",
              detail: "Ejecutando: npm run prepare-server",
            },
            {
              id: "buildShell",
              label: "Compilar shell",
              command: "Construir shell local",
              detail: "Ejecutando: npm run build:local",
            },
          ]
        : []),
      ...(microfrontend
        ? [
            {
              id: "microfrontend",
              label: microfrontend.name,
              command: "Iniciar watch del microfrontend",
              detail: "Ejecutando: npm run watch",
            },
          ]
        : []),
      {
        id: "shell",
        label: project.appName || project.name,
        command: "Iniciar shell",
        detail: "Servidor HTTP interno del launcher (Node.js)",
      },
      {
        id: "chrome",
        label: "Chrome autorizado",
        command: "Abrir navegador autorizado",
        detail: "Ejecutando navegador autorizado",
      },
    ];

    console.log("beginExecution")
    beginExecution(project, steps);
    updateExecutionStep("validation", {
      status: "running",
      startedAt: validationStartedAt,
    });
    updateSession({
      status: "starting",
      stage: "validation",
      plan,
      message: "Validando la configuración inicial",
      projectId,
      projectName: project.name,
      startedAt: new Date().toISOString(),
    });

    try {

      updateExecutionStep("validation", {
        status: "success",
        endedAt: new Date().toISOString(),
      });
      updateSession({
        status: "starting",
        stage: "components",
        plan,
        message: `Iniciando MOVA Components ${version.version}`,
        projectId,
        projectName: project.name,
      });

      await runTrackedStage({
          id: "components",
          message: `Compilando MOVA Components ${version.version}`,
          task: async () => {
            assertNotCancelled(signal);
            await ensureComponents(project, version, signal);
            assertNotCancelled(signal);
          },
        });

      console.log('automaticBuild');
      if (automaticBuild) {
        await runTrackedStage({
          id: "prepare",
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
        await runTrackedStage({
          id: "buildShell",
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
        await runTrackedStage({
          id: "microfrontend",
          message: `Iniciando watch de ${microfrontend.name}`,
          task: async () => {
            assertNotCancelled(signal);
            startMicrofrontend(project, microfrontend, signal);
          },
        });
      }
      console.log('startShell');
      await runTrackedStage({
        id: "shell",
        message: `Iniciando servidor HTTP de ${project.name}`,
        task: async () => {
          assertNotCancelled(signal);
          await startShell(project, signal);
          assertNotCancelled(signal);
        },
      });
      await runTrackedStage({
        id: "chrome",
        message: "Abriendo navegador autorizado.",
        task: async () => {
          assertNotCancelled(signal);
          await openOrRequestBrowser(project);
          assertNotCancelled(signal);
        },
      });
      updateExecution({
        status: "success",
        error: null,
        endedAt: new Date().toISOString(),
      });
      updateSession({
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
      const finalStatus = cancelled ? "cancelled" : "error";
      updateExecution({
        status: finalStatus,
        error: cancelled ? "Inicio cancelado" : error.message,
        endedAt: new Date().toISOString(),
        steps: state.execution.steps.map((step) => ({
          ...step,
          status:
            step.status === "pending"
              ? "skipped"
              : cancelled && ["running", "error"].includes(step.status)
                ? "cancelled"
                : step.status,
          endedAt: ["running", "pending"].includes(step.status)
            ? new Date().toISOString()
            : step.endedAt,
        })),
      });
      await lifecycle.cleanupStartedResources();
      updateSession({
        status: "idle",
        stage: "idle",
        plan: null,
        message: cancelled ? "Inicio cancelado" : `Error: ${error.message}`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
    } finally {
      operation.end(current.id);
    }
  }

  async function rebuildShellServer(projectId) {
    // AÑADIDO: await
    const project = (await getProjects()).find((item) => item.id === projectId);
    if (!project) throw new Error("Shell no encontrada.");
    if (state.shell.status !== "stopped" && state.shell.projectId === projectId)
      throw new Error("Detén la shell antes de reconstruir su servidor.");
    if (!project.workflow?.prepareServer || !project.workflow?.buildLocal)
      throw new Error(
        "Esta shell no define npm run prepare-server y npm run build:local.",
      );

    const current = operation.start({
      projectId,
      mode: "rebuild-server",
    });
    const signal = current.controller.signal;
    const steps = [
      {
        id: "prepare",
        label: "Preparar servidor",
        command: "Preparar servidor de la shell",
        detail: "Ejecutando: npm run prepare-server",
      },
      {
        id: "buildShell",
        label: "Compilar shell",
        command: "Construir servidor local",
        detail: "Ejecutando: npm run build:local",
      },
    ];
    beginExecution(project, steps, "rebuild");
    updateSession({
      status: "building",
      stage: "prepare",
      plan: ["prepare", "buildShell"],
      message: "Reconstruyendo servidor local",
      projectId,
      projectName: project.name,
      startedAt: new Date().toISOString(),
    });
    try {
      await runTrackedStage({
        id: "prepare",
        message: "Preparar servidor de la shell",
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
      await runTrackedStage({
        id: "buildShell",
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
      updateExecution({
        status: "success",
        error: null,
        endedAt: new Date().toISOString(),
      });
      updateSession({
        status: "idle",
        stage: "idle",
        plan: null,
        message: `Servidor de ${project.name} reconstruido`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
    } catch (error) {
      const cancelled = signal.aborted;
      updateExecution({
        status: cancelled ? "cancelled" : "error",
        error: cancelled ? "Reconstrucción cancelada" : error.message,
        endedAt: new Date().toISOString(),
      });
      addLog(
        "Reconstruir servidor",
        cancelled ? "system" : "error",
        cancelled ? "Reconstrucción cancelada." : error.message,
      );
      updateSession({
        status: "idle",
        stage: "idle",
        plan: null,
        message: cancelled
          ? "Reconstrucción cancelada"
          : `Error: ${error.message}`,
        projectId: null,
        projectName: null,
        startedAt: null,
      });
      throw error;
    } finally {
      operation.end(current.id);
    }
  }

  return { runEnvironment, rebuildShellServer };
}
