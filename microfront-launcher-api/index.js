import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import {
  versionsRoot,
  workRoot,
  readConfig,
  writeJson,
  getProjects,
  getVersionByTag,
  refreshTags,
  versionPaths,
  safeTagName,
  assertInside,
  getIndexedProject,
  gitBranchInfo,
  updateMicrofrontendGitCache,
} from "./lib/core.js";
import {
  addLog,
  spawnManaged,
  startStaticServer,
  stopStaticServer,
} from "./lib/runtime.js";
import { createEnvironmentModel } from "./api/environment/model.js";
import { createEnvironmentRouter } from "./api/environment/router.js";
import { createBrowserRouter } from "./api/browser/router.js";
import { createComponentsRouter } from "./api/components/router.js";
import { createMicrofrontendsRouter } from "./api/microfrontends/router.js";
import { createMovaRouter } from "./api/mova/router.js";
import { createProjectsRouter } from "./api/projects/router.js";
import { createStateRouter } from "./api/state/router.js";
import { EnvironmentLifecycleService } from "./api/environment/lifecycle.js";
import { createEnvironmentService } from "./api/environment/service.js";
import { createVsCodeService } from "./services/vscode-service.js";
import { createProjectGitService } from "./services/project-git-service.js";
import { MicrofrontendRuntimeService } from "./services/microfrontend-runtime-service.js";
import { RuntimeStateService } from "./services/runtime-state-service.js";
import {
  assertNotCancelled,
  runProcessStep,
} from "./services/process-runner-service.js";
import { createShellRuntimeService } from "./services/shell-runtime-service.js";
import {
  selectedVersion,
} from "./services/components-version-service.js";
import { createComponentsRuntimeService } from "./services/components-runtime-service.js";
import { createBrowserService } from "./services/browser-service.js";
import { createLocalDirectoryPicker } from "./services/local-directory-picker-service.js";
import { createMicrofrontendBuildService } from "./services/microfrontend-build-service.js";
import { json } from "./lib/http.js";
import { state } from "./state.js";

let branchOperation = null;

async function buildComponents(version, signal, { force = false } = {}) {
  const tag = version.tag;
  let localVersion = await getVersionByTag(tag);
  let tagsSynchronized = false;
  if (!localVersion) {
    assertNotCancelled(signal);
    addLog(
      "MOVA Components",
      "stage",
      `El tag ${tag} no está disponible localmente. Sincronizando tags remotos.`,
    );
    await refreshTags();
    tagsSynchronized = true;
    assertNotCancelled(signal);
    localVersion = await getVersionByTag(tag);
  }
  if (!localVersion) throw new Error(`El tag no existe localmente: ${tag}`);
  if (tagsSynchronized)
    addLog(
      "MOVA Components",
      "success",
      `Tag ${tag} sincronizado correctamente.`,
    );
  const config = readConfig();
  const storageDirectories = [
    { path: versionsRoot, label: "caché de versiones" },
    { path: workRoot, label: "área de trabajo temporal" },
  ];
  for (const directory of storageDirectories) {
    if (fs.existsSync(directory.path)) continue;
    addLog(
      "Versiones",
      "stage",
      `Creando ${directory.label}: ${directory.path}`,
    );
    fs.mkdirSync(directory.path, { recursive: true });
    addLog("Versiones", "success", `${directory.label} creada.`);
  }
  const working = path.join(workRoot, `${safeTagName(tag)}-${Date.now()}`);
  assertInside(workRoot, working);
  const destination = versionPaths(tag);
  const hasCachedBuild =
    fs.existsSync(destination.manifest) && fs.existsSync(destination.dist);
  if (hasCachedBuild && !force) return destination;

  try {
    await runProcessStep({
      key: "build:clone",
      label: "Versiones",
      file: "git",
      args: [
        "clone",
        "--local",
        "--no-checkout",
        config.mova.sourcePath,
        working,
      ],
      cwd: workRoot,
      signal,
    });
    await runProcessStep({
      key: "build:checkout",
      label: "Versiones",
      file: "git",
      args: ["checkout", "--detach", tag],
      cwd: working,
      signal,
    });
    await runProcessStep({
      key: "build:install",
      label: "Build MOVA",
      file: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["ci"],
      cwd: working,
      signal,
    });
    await runProcessStep({
      key: "build:compile",
      label: "Build MOVA",
      file: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["run", "build"],
      cwd: working,
      signal,
    });
    assertNotCancelled(signal);

    const sourceDist = path.join(working, "dist");
    if (!fs.existsSync(sourceDist))
      throw new Error("El build no generó la carpeta dist.");
    if (force && fs.existsSync(destination.root)) {
      assertInside(versionsRoot, destination.root);
      fs.rmSync(destination.root, { recursive: true, force: true });
    }
    fs.mkdirSync(destination.root, { recursive: true });
    fs.cpSync(sourceDist, destination.dist, { recursive: true });
    assertNotCancelled(signal);
    writeJson(destination.manifest, { tag });
    addLog(
      "Build MOVA",
      "success",
      `${tag} compilado y almacenado para reutilizarse.`,
    );
    return destination;
  } catch (error) {
    throw error;
  } finally {
    if (
      !fs.existsSync(destination.manifest) &&
      fs.existsSync(destination.root)
    ) {
      assertInside(versionsRoot, destination.root);
      fs.rmSync(destination.root, { recursive: true, force: true });
    }
    if (fs.existsSync(working)) {
      assertInside(workRoot, working);
      fs.rmSync(working, { recursive: true, force: true });
    }
  }
}
const componentsRuntime = createComponentsRuntimeService({
  buildComponents
});

async function startComponentsStandalone() {
  const version = await selectedVersion();
  if (!version)
    throw new Error(
      "Selecciona una versión de MOVA Components antes de iniciarlo.",
    );
  const paths = await buildComponents(version, new AbortController().signal);
  const config = readConfig();
  const server = await startStaticServer({
    key: "components",
    label: "MOVA Components",
    root: paths.dist,
    port: Number(config.shellDefaults.serverPort),
    aliases: ["/cudc-lib-componentes-stencil-VAL"],
    fallbackIndex: false,
  });
  state.components = {
    status: "running",
    url: server.url,
    version: version.version,
    tag: version.tag,
    external: false,
  };
  RuntimeStateService.emitState();
  return state.components;
}

async function stopComponents() {
  await stopStaticServer("components");
  state.components = {
    status: "stopped",
    url: null,
    version: null,
    tag: null,
    external: false,
  };
  RuntimeStateService.emitState();
}

const microfrontendBuildService = createMicrofrontendBuildService({
  isBranchOperationRunning: () => Boolean(branchOperation),
});


async function startMicrofrontendBranchBatch(
  projectId,
  microfrontendIds,
  branch,
) {
  if (branchOperation || state.microfrontendBuild.status === "running")
    throw new Error("Ya hay una operación de microfrontend en curso.");

  // AÑADIDO: await
  const { microfrontends } = await selectedMicrofrontends(
    projectId,
    microfrontendIds,
  );

  const startedAt = new Date().toISOString();
  const run = async () => {
    const results = await Promise.all(
      microfrontends.map(async (microfrontend) => {
        const report = (patch) =>
          RuntimeStateService.updateMicrofrontendOperation(
            "branch",
            projectId,
            microfrontend.id,
            {
              status: "running",
              branch,
              startedAt,
              ...patch,
            },
          );
        report({
          phase: "validating",
          message: "Preparando cambio",
          error: null,
        });
        try {
          await switchMicrofrontendBranch(
            projectId,
            microfrontend.id,
            branch,
            null,
            report,
          );
          RuntimeStateService.updateMicrofrontendOperation(
            "branch",
            projectId,
            microfrontend.id,
            {
              status: "success",
              branch,
              phase: "done",
              message: "Completado",
              error: null,
              startedAt,
            },
          );
          return true;
        } catch (error) {
          RuntimeStateService.updateMicrofrontendOperation(
            "branch",
            projectId,
            microfrontend.id,
            {
              status: "error",
              branch,
              phase: "error",
              message: "No se pudo cambiar la rama",
              error: error.message,
              startedAt,
            },
          );
          return false;
        }
      }),
    );
    const completedIds = microfrontends
      .filter((_, index) => results[index])
      .map((item) => item.id);
    RuntimeStateService.updateMicrofrontendBranch({
      status: results.every(Boolean) ? "success" : "error",
      projectId,
      microfrontendId: microfrontends.at(-1).id,
      branch,
      phase: "done",
      message: `Rama ${branch} aplicada a ${completedIds.length}/${microfrontends.length} microfronts.`,
      error: null,
      startedAt,
      batchIds: microfrontendIds,
      completedIds,
    });
  };
  branchOperation = run()
    .catch((error) => {
      RuntimeStateService.updateMicrofrontendBranch({
        status: "error",
        branch,
        error: error.message,
        message: "El cambio de rama por lote no se completó.",
        startedAt,
        batchIds: microfrontendIds,
      });
      addLog("Microfronts", "error", error.message);
    })
    .finally(() => {
      branchOperation = null;
    });
}

const shellRuntime = createShellRuntimeService();
const browserService = createBrowserService({ addLog, readConfig });

async function openOrRequestBrowser(project) {
  const config = readConfig();
  return browserService.open(project, {
    newWindow: config.browser.openMode === "window",
  });
}

export async function cancelAndStopAll(reason = "Entorno detenido") {
  await EnvironmentLifecycleService.stopEnvironmentInternals({
    reason,
    emitFinalSession: true,
  });
}

async function openScaffolding(projectId) {
  const project = (await getProjects()).find((item) => item.id === projectId);
  if (!project) throw new Error("Shell no encontrada.");
  if (!project.workflow?.scaffolding)
    throw new Error("Esta shell no define npm run scaffolding.");
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/k", "npm run scaffolding"], {
          cwd: project.path,
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        })
      : spawn("npm", ["run", "scaffolding"], {
          cwd: project.path,
          detached: true,
          stdio: "ignore",
        });
  child.unref();
  addLog(
    project.name,
    "system",
    "Configuración inicial abierta en una terminal independiente.",
  );
}

async function reopenChrome({ newWindow = true, url = null, browserMode = null } = {}) {
  // Si no hay shell activa, el navegador abre una pestaña nueva.
  const project =
    state.shell.status === "running" && state.shell.projectId
      ? getIndexedProject(state.shell.projectId)
      : null;
  if (state.shell.projectId && !project) {
    throw new Error("No se encontró la configuración de la shell activa.");
  }
  await browserService.open(project, { newWindow, url, browserMode });
}

async function openEmptyBrowser({ newWindow = true, url = null } = {}) {
  await browserService.open(null, { newWindow, url });
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      { encoding: "utf8", windowsHide: true },
      (error, stdout, stderr) => {
        if (error)
          return reject(new Error(String(stderr || error.message).trim()));
        resolve(String(stdout || "").trim());
      },
    );
  });
}

async function switchMicrofrontendBranch(
  projectId,
  microfrontendId,
  branch,
  progress = null,
  report = null,
) {
  // AÑADIDO: await
  const project = (await getProjects()).find((item) => item.id === projectId);
  const microfrontend = project?.microfrontends?.find(
    (item) => item.id === microfrontendId,
  );
  if (!microfrontend)
    throw new Error("No se encontró el microfrontend solicitado.");
  const branchName = String(branch).replace(/^origin\//, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branchName))
    throw new Error("La rama indicada no es válida.");
  const progressMessage = (message, step) => {
    const batch =
      progress?.total > 1
        ? ` · microfront ${progress.position}/${progress.total}`
        : "";
    return `${message} (paso ${step}/4${batch})`;
  };
  const updatePhase = (phase, message) => {
    RuntimeStateService.updateMicrofrontendBranch({ phase, message });
    report?.({ phase, message });
  };
  updatePhase("validating", progressMessage("Comprobando cambios locales", 1));
  const changes = await runGit(["status", "--porcelain"], microfrontend.path);
  if (changes)
    throw new Error(
      `${microfrontend.name} tiene cambios locales. Confírmalos o guárdalos antes de cambiar de rama.`,
    );
  addLog(
    "Microfronts",
    "stage",
    `Actualizando referencias de ${microfrontend.name}.`,
  );
  updatePhase("fetch", progressMessage("Actualizando referencias remotas", 2));
  await runGit(["fetch", "--all", "--prune"], microfrontend.path);
  const localBranches = await runGit(
    ["branch", "--format=%(refname:short)"],
    microfrontend.path,
  );
  const hasLocalBranch = localBranches.split(/\r?\n/).includes(branchName);
  const remoteBranches = await runGit(
    ["branch", "--remotes", "--format=%(refname:short)"],
    microfrontend.path,
  );
  const hasRemoteBranch = remoteBranches
    .split(/\r?\n/)
    .includes(`origin/${branchName}`);
  if (!hasLocalBranch && !hasRemoteBranch)
    throw new Error(
      `La rama ${branch} no existe en el repositorio de ${microfrontend.name}.`,
    );
  updatePhase("switch", progressMessage(`Cambiando a ${branchName}`, 3));
  await runGit(
    hasLocalBranch
      ? ["switch", branchName]
      : ["switch", "--track", `origin/${branchName}`],
    microfrontend.path,
  );
  if (hasRemoteBranch) {
    updatePhase("pull", progressMessage(`Sincronizando ${branchName}`, 4));
    await runGit(
      ["pull", "--ff-only", "origin", branchName],
      microfrontend.path,
    );
  }
  const newGitInfo = await gitBranchInfo(microfrontend.path);
  updateMicrofrontendGitCache(projectId, microfrontendId, newGitInfo);

  addLog(
    "Microfronts",
    "success",
    `${microfrontend.name} sincronizado en la rama ${branch}.`,
  );
}

function startMicrofrontendBranchSwitch(projectId, microfrontendId, branch) {
  if (branchOperation || state.microfrontendBuild.status === "running") {
    throw new Error("Ya hay una operación de microfrontend en curso.");
  }
  const id = `${Date.now()}-${Math.random()}`;
  branchOperation = { id };
  RuntimeStateService.updateMicrofrontendBranch({
    status: "running",
    projectId,
    microfrontendId,
    branch,
    phase: "validating",
    message: "Preparando cambio de rama.",
    error: null,
    startedAt: new Date().toISOString(),
  });
  switchMicrofrontendBranch(projectId, microfrontendId, branch, {
    position: 1,
    total: 1,
  })
    .then(() =>
      RuntimeStateService.updateMicrofrontendBranch({
        status: "success",
        branch,
        phase: "done",
        message: `Rama ${branch} aplicada correctamente.`,
        error: null,
      }),
    )
    .catch((error) => {
      addLog("Microfronts", "error", error.message);
      RuntimeStateService.updateMicrofrontendBranch({
        status: "error",
        phase: "error",
        message: "No se pudo cambiar la rama.",
        error: error.message,
      });
    })
    .finally(() => {
      if (branchOperation?.id === id) branchOperation = null;
      RuntimeStateService.emitState();
    });
}

const selectLocalDirectory = createLocalDirectoryPicker();

const findProject = async (projectId) => getIndexedProject(projectId) ||
  (await getProjects()).find((item) => item.id === projectId);
const vsCodeService = createVsCodeService({ findProject, addLog });
const projectGitService = createProjectGitService({
  findProject,
});
export const microfrontendsRouter = createMicrofrontendsRouter({
  openMicrofrontend: vsCodeService.openMicrofrontend,
  buildMicrofrontend: microfrontendBuildService.buildMicrofrontend,
  startBuildBatch: microfrontendBuildService.startBatch,
  startBranchSwitch: startMicrofrontendBranchSwitch,
  startBranchBatch: startMicrofrontendBranchBatch,
  startWatch: MicrofrontendRuntimeService.startMicrofrontend,
});
export const projectsRouter = createProjectsRouter({
  getProjectGitInfo: projectGitService.getProjectGitInfo,
  selectLocalDirectory,
  openScaffolding,
  openProjectWebapp: vsCodeService.openProjectWebapp,
});
export const browserRouter = createBrowserRouter({
  reopenChrome,
  openEmptyBrowser,
});
export const stateRouter = createStateRouter();
export const movaRouter = createMovaRouter();
export const componentsRouter = createComponentsRouter({
  state,
  startComponents: startComponentsStandalone,
  stopComponents,
  stopEnvironment: cancelAndStopAll,
});
const environmentService = createEnvironmentService({
  componentsRuntime,
  shellRuntime,
  openOrRequestBrowser,
});
const environmentModel = createEnvironmentModel({
  environmentService,
  cancelAndStopAll,
});
export const environmentRouter = createEnvironmentRouter({
  environmentModel,
});
export function handleRequest(request, response) {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "127.0.0.1:3187"}`,
  );
  if (url.pathname.startsWith("/api/")) {
    json(response, 404, { error: "Ruta no encontrada" });
    return;
  }
  json(response, 404, {
    error: "Esta dirección expone solo la API local.",
    frontend: "http://localhost:4200",
  });
}
