import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import {
  distRoot,
  versionsRoot,
  workRoot,
  readConfig,
  readPreferences,
  writeJson,
  getProjects,
  getVersions,
  getVersionByTag,
  versionPaths,
  safeTagName,
  assertInside,
  getIndexedProject,
  gitBranchInfo,
  exactGitTag,
  updateMicrofrontendGitCache,
} from "./lib/core.js";
import {
  childProcesses,
  emit,
  addLog,
  logs,
  spawnManaged,
  stopProcess,
  startStaticServer,
  stopStaticServer,
} from "./lib/runtime.js";
import { createMicrofrontendHandler } from "./handlers/microfrontend-handler.js";
import { createProjectsHandler } from "./handlers/projects-handler.js";
import { createBrowserHandler } from "./handlers/browser-handler.js";
import { createStateHandler } from "./handlers/state-handler.js";
import { createMovaHandler } from "./handlers/mova-handler.js";
import { createComponentsHandler } from "./handlers/components-handler.js";
import { createEnvironmentModel } from "./api/environment/model.js";
import { createEnvironmentHandler } from "./api/environment/handler.js";
import { createEnvironmentRouter } from "./api/environment/router.js";
import { createEnvironmentSessionState } from "./api/environment/session-state.js";
import { createEnvironmentLifecycle } from "./api/environment/lifecycle.js";
import { createEnvironmentOperation } from "./api/environment/operation.js";
import { createEnvironmentService } from "./api/environment/service.js";
import { createVersionsAuditHandler } from "./handlers/versions-audit-handler.js";
import { createApiRouter } from "./routes/api-router.js";
import { createVsCodeService } from "./services/vscode-service.js";
import { createProjectGitService } from "./services/project-git-service.js";
import { createMicrofrontendRuntimeService } from "./services/microfrontend-runtime-service.js";
import { assertNotCancelled, runProcessStep } from "./services/process-runner-service.js";
import { createShellRuntimeService } from "./services/shell-runtime-service.js";
import { latestVersion, selectedVersion } from "./services/components-version-service.js";
import { createComponentsRuntimeService } from "./services/components-runtime-service.js";
import { json, readBody } from "./lib/http.js";
import { state } from "./state.js";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 3187);

let buildOperation = null;
let branchOperation = null;

function emitRuntime() {
  emit("runtime", getRuntime());
}

const emitState = emitRuntime;
const environmentOperation = createEnvironmentOperation({ onChange: emitRuntime });

function getRuntime() {
  return { ...state, preferences: readPreferences() };
}

function emitPreferences() {
  emit("preferences", readPreferences());
}

const {
  updateSession,
  runTrackedStage,
} = createEnvironmentSessionState({ emitState });

function updateBuild(patch) {
  state.build = { ...state.build, ...patch };
  emitState();
}

function updateMicrofrontendBranch(patch) {
  state.microfrontendBranch = { ...state.microfrontendBranch, ...patch };
  emitState();
}

function updateMicrofrontendBuild(patch) {
  state.microfrontendBuild = { ...state.microfrontendBuild, ...patch };
  emitState();
}

function updateMicrofrontendOperation(kind, projectId, microfrontendId, patch) {
  const key = `${kind}:${microfrontendId}`;
  state.microfrontendOperations = {
    ...state.microfrontendOperations,
    [key]: {
      ...(state.microfrontendOperations[key] || {}),
      kind,
      projectId,
      microfrontendId,
      ...patch,
    },
  };
  emitState();
}

const {
  cleanupStartedResources,
  stopEnvironmentInternals,
} = createEnvironmentLifecycle({
  emitState, updateSession, getEnvironmentOperation: environmentOperation.get,
  clearEnvironmentOperation: environmentOperation.clear,
});

async function stopEnvironmentProcesses() {
  const records = [...childProcesses.entries()].filter(
    ([key]) => !key.startsWith("build:"),
  );
  for (const [key] of records) stopProcess(key);
  await Promise.race([
    Promise.all(records.map(([, record]) => record.done)),
    new Promise((resolve) => setTimeout(resolve, 3500)),
  ]);
}

function beginBuildOperation(details = {}) {
  if (buildOperation)
    throw new Error("Ya hay una compilación en curso.");
  const controller = new AbortController();
  const next = {
    id: `${Date.now()}-${Math.random()}`,
    type: "build",
    controller,
    ...details,
  };
  buildOperation = next;
  return next;
}

function endBuildOperation(id) {
  if (buildOperation?.id === id) buildOperation = null;
  emitState();
}

async function buildComponents(version, signal, { force = false } = {}) {
  const tag = version.tag;
  if (!await getVersionByTag(tag))
    throw new Error(`El tag no existe localmente: ${tag}`);
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

async function compileVersion(tag) {
  const versions = await getVersions();
  const version = versions.find((item) => item.tag === tag);
  if (!version) throw new Error("La versión seleccionada no existe.");
  const current = beginBuildOperation({ tag });
  updateBuild({
    status: "building",
    tag,
    action: "compile",
    message: `Compilando ${tag}`,
    startedAt: new Date().toISOString(),
  });
  try {
    await buildComponents(version, current.controller.signal, {
      force: version.cached,
    });
    updateBuild({
      status: "success",
      message: `${tag} compilado correctamente`,
      startedAt: null,
    });
  } catch (error) {
    updateBuild({
      status: current.controller.signal.aborted ? "idle" : "error",
      message: current.controller.signal.aborted
        ? "Compilación cancelada"
        : error.message,
      startedAt: null,
    });
    throw error;
  } finally {
    endBuildOperation(current.id);
  }
}

function cancelBuild() {
  if (!buildOperation)
    throw new Error("No hay una compilación de MOVA en curso.");
  addLog(
    "Build MOVA",
    "system",
    `Cancelando compilación de ${buildOperation.tag}.`,
  );
  buildOperation.controller.abort();
  updateBuild({ message: `Cancelando compilación de ${buildOperation.tag}` });
}

const componentsRuntime = createComponentsRuntimeService({
  buildComponents,
  emitState,
});

async function startComponentsStandalone(projectId) {
  const project = getIndexedProject(projectId);
  if (!project)
    throw new Error("Selecciona una shell para resolver la versión de MOVA Components.");
  const version = await selectedVersion(project);
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
  emitState();
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
  emitState();
}

const microfrontendRuntime = createMicrofrontendRuntimeService({
  emitState,
});
const { startMicrofrontend } = microfrontendRuntime;

function buildMicrofrontend(project, microfrontend) {
  if (branchOperation || state.microfrontendBuild.status === "running") {
    throw new Error("Ya hay una operación de microfrontend en curso.");
  }
  if (!microfrontend?.buildAvailable)
    throw new Error(
      `El microfrontend ${microfrontend?.name || ""} no define npm run build.`,
    );
  const key = `microfrontend-build:${project.id}:${microfrontend.id}`;
  updateMicrofrontendBuild({
    status: "running",
    projectId: project.id,
    microfrontendId: microfrontend.id,
    phase: "build",
    message: "Compilando.",
    error: null,
    startedAt: new Date().toISOString(),
  });
  const record = spawnManaged({
    key,
    label: `Build · ${microfrontend.name}`,
    file: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "build"],
    cwd: microfrontend.path,
    longRunning: false,
  });
  record.done.then(({ code }) => {
    if (state.microfrontendBuild.microfrontendId !== microfrontend.id) return;
    if (code === 0) {
      updateMicrofrontendBuild({
        status: "success",
        message: `${microfrontend.name} compilado correctamente.`,
        error: null,
      });
    } else {
      updateMicrofrontendBuild({
        status: "error",
        message: "La compilación no se completó.",
        error: `${microfrontend.name} terminó con código ${code ?? "-"}.`,
      });
    }
  });
  return record;
}

async function selectedMicrofrontends(projectId, microfrontendIds) {
  const project = (await getProjects()).find((item) => item.id === projectId);
  if (!project) throw new Error("No se encontró la shell solicitada.");
  const requested = new Set(
    Array.isArray(microfrontendIds) ? microfrontendIds : [],
  );
  const microfrontends = (project.microfrontends || []).filter((item) =>
    requested.has(item.id),
  );
  if (!microfrontends.length || microfrontends.length !== requested.size)
    throw new Error("La selección de microfronts no es válida.");
  return { project, microfrontends };
}

async function startMicrofrontendBuildBatch(projectId, microfrontendIds) {
  if (branchOperation || state.microfrontendBuild.status === "running")
    throw new Error("Ya hay una operación de microfrontend en curso.");

  // AÑADIDO: await
  const { project, microfrontends } = await selectedMicrofrontends(
    projectId,
    microfrontendIds,
  );

  if (microfrontends.some((item) => !item.buildAvailable))
    throw new Error(
      "La selección contiene microfronts sin el script npm run build.",
    );
  const startedAt = new Date().toISOString();
  const run = async () => {
    const results = await Promise.all(
      microfrontends.map(async (microfrontend) => {
        updateMicrofrontendOperation("build", projectId, microfrontend.id, {
          status: "running",
          phase: "build",
          message: "Compilando",
          error: null,
          startedAt,
        });
        const record = spawnManaged({
          key: `microfrontend-build:${project.id}:${microfrontend.id}`,
          label: `Build · ${microfrontend.name}`,
          file: process.platform === "win32" ? "npm.cmd" : "npm",
          args: ["run", "build"],
          cwd: microfrontend.path,
          longRunning: false,
        });
        const { code } = await record.done;
        if (code === 0) {
          updateMicrofrontendOperation("build", projectId, microfrontend.id, {
            status: "success",
            phase: "done",
            message: "Completado",
            error: null,
            startedAt,
          });
          return true;
        }
        const error = `Terminó con código ${code ?? "-"}.`;
        updateMicrofrontendOperation("build", projectId, microfrontend.id, {
          status: "error",
          phase: "error",
          message: "No se completó la compilación",
          error,
          startedAt,
        });
        return false;
      }),
    );
    const completedIds = microfrontends
      .filter((_, index) => results[index])
      .map((item) => item.id);
    updateMicrofrontendBuild({
      status: results.every(Boolean) ? "success" : "error",
      projectId,
      microfrontendId: microfrontends.at(-1).id,
      phase: "done",
      message: `${completedIds.length}/${microfrontends.length} microfronts compilados.`,
      error: null,
      startedAt,
      batchIds: microfrontendIds,
      completedIds,
    });
  };
  microfrontendBatchOperation = run()
    .catch((error) => {
      updateMicrofrontendBuild({
        status: "error",
        error: error.message,
        message: "La compilación por lote no se completó.",
        startedAt,
        batchIds: microfrontendIds,
      });
      addLog("Microfronts", "error", error.message);
    })
    .finally(() => {
      microfrontendBatchOperation = null;
    });
}

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
          updateMicrofrontendOperation("branch", projectId, microfrontend.id, {
            status: "running",
            branch,
            startedAt,
            ...patch,
          });
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
          updateMicrofrontendOperation("branch", projectId, microfrontend.id, {
            status: "success",
            branch,
            phase: "done",
            message: "Completado",
            error: null,
            startedAt,
          });
          return true;
        } catch (error) {
          updateMicrofrontendOperation("branch", projectId, microfrontend.id, {
            status: "error",
            branch,
            phase: "error",
            message: "No se pudo cambiar la rama",
            error: error.message,
            startedAt,
          });
          return false;
        }
      }),
    );
    const completedIds = microfrontends
      .filter((_, index) => results[index])
      .map((item) => item.id);
    updateMicrofrontendBranch({
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
      updateMicrofrontendBranch({
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

const shellRuntime = createShellRuntimeService({ emitState });

function browserSettings(config = readConfig()) {
  const mode = config.chrome.browser;
  const isEdge = mode.startsWith("edge");
  const insecure = mode.endsWith("-insecure");
  return {
    name: isEdge ? "Edge" : "Chrome",
    path: isEdge ? config.chrome.edgePath : config.chrome.path,
    userDataDir: isEdge
      ? config.chrome.edgeUserDataDir
      : config.chrome.userDataDir,
    insecure,
  };
}

async function openChrome(project, { newWindow = true, url = null } = {}) {
  const config = readConfig();
  const browser = browserSettings(config);
  if (!fs.existsSync(browser.path))
    throw new Error(`No se encontró ${browser.name}: ${browser.path}`);
  const chromeUrl = url
    ? new URL(url)
    : project
      ? new URL(project.url)
      : new URL("chrome://newtab/");
  if (!url && project) {
    chromeUrl.hostname = config.chrome.openHost;
    chromeUrl.port = String(config.shellDefaults.serverPort || 8080);
  }
  const args = [
    ...(browser.insecure
      ? [`--user-data-dir=${browser.userDataDir}`, "--disable-web-security"]
      : []),
    ...(newWindow ? ["--new-window"] : []),
    chromeUrl.toString(),
  ];
  await new Promise((resolve, reject) => {
    const chrome = spawn(browser.path, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    chrome.once("error", reject);
    chrome.once("spawn", () => {
      chrome.unref();
      resolve();
    });
  });
  addLog(
    browser.name,
    "system",
    `Ejecutando: "${browser.path}" ${args.join(" ")}`,
  );
}

async function openOrRequestBrowser(project) {
  const config = readConfig();
  const browser = browserSettings(config);
  if (!fs.existsSync(browser.path))
    throw new Error(`No se encontró ${browser.name}: ${browser.path}`);
  return openChrome(project, { newWindow: config.chrome.openMode === "window" });
}





async function cancelAndStopAll(reason = "Entorno detenido") {
  await stopEnvironmentInternals({
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

async function reopenChrome({ newWindow = true, url = null } = {}) {
  if (state.shell.status !== "running" || !state.shell.projectId)
    throw new Error("No hay una shell activa para abrir en Chrome.");
  // AÑADIDO: await
  const project = (await getProjects()).find(
    (item) => item.id === state.shell.projectId,
  );
  if (!project)
    throw new Error("No se encontró la configuración de la shell activa.");
  await openChrome(project, { newWindow, url });
}

async function openEmptyBrowser({ newWindow = true, url = null } = {}) {
  await openChrome(null, { newWindow, url });
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
    updateMicrofrontendBranch({ phase, message });
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
  updateMicrofrontendBranch({
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
      updateMicrofrontendBranch({
        status: "success",
        branch,
        phase: "done",
        message: `Rama ${branch} aplicada correctamente.`,
        error: null,
      }),
    )
    .catch((error) => {
      addLog("Microfronts", "error", error.message);
      updateMicrofrontendBranch({
        status: "error",
        phase: "error",
        message: "No se pudo cambiar la rama.",
        error: error.message,
      });
    })
    .finally(() => {
      if (branchOperation?.id === id) branchOperation = null;
      emitState();
    });
}

function selectLocalDirectory(description) {
  if (process.platform !== "win32")
    throw new Error("El selector de carpetas solo está disponible en Windows.");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual",
    "$owner.Location = New-Object System.Drawing.Point(-32000, -32000)",
    "$owner.Size = New-Object System.Drawing.Size(1, 1)",
    "$owner.ShowInTaskbar = $false",
    "$owner.Opacity = 0",
    "$owner.TopMost = $true",
    "$owner.Show()",
    "$owner.Activate()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${description}'`,
    "$dialog.ShowNewFolderButton = $false",
    "try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) } } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }",
  ].join("; ");
  return new Promise((resolve, reject) =>
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { windowsHide: false },
      (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout.trim());
      },
    ),
  );
}

const findProject = async (projectId) =>
  getIndexedProject(projectId) ||
  (await getProjects()).find((item) => item.id === projectId);
const vsCodeService = createVsCodeService({ findProject, addLog });
const projectGitService = createProjectGitService({
  findProject
});
const handleMicrofrontendRequest = createMicrofrontendHandler({
  openMicrofrontend: vsCodeService.openMicrofrontend,
  buildMicrofrontend,
  startBuildBatch: startMicrofrontendBuildBatch,
  startBranchSwitch: startMicrofrontendBranchSwitch,
  startBranchBatch: startMicrofrontendBranchBatch,
  startWatch: startMicrofrontend,
});
const handleProjectsRequest = createProjectsHandler({
  getProjectGitInfo: projectGitService.getProjectGitInfo,
  selectLocalDirectory,
  openScaffolding,
  openProjectWebapp: vsCodeService.openProjectWebapp
});
const handleBrowserRequest = createBrowserHandler({
  reopenChrome,
  openEmptyBrowser,
});
const handleStateRequest = createStateHandler({
  getRuntime
});
const handleMovaRequest = createMovaHandler({
  emitPreferences,
  compileVersion,
  cancelBuild,
  getLatestVersion: async (projectId) => {
    const project = getIndexedProject(projectId);
    if (!project) throw new Error("Shell no encontrada.");
    return latestVersion(project);
  },
});
const handleComponentsRequest = createComponentsHandler({
  state,
  startComponents: startComponentsStandalone,
  stopComponents,
  stopEnvironment: cancelAndStopAll,
});
const environmentService = createEnvironmentService({
  session: { updateSession, runTrackedStage },
  lifecycle: { cleanupStartedResources },
  operation: environmentOperation,
  componentsRuntime,
  shellRuntime,
  microfrontendRuntime,
  openOrRequestBrowser,
  emitState
});
const environmentModel = createEnvironmentModel({
  environmentService,
  cancelAndStopAll,
  addLog,
});
const environmentHandler = createEnvironmentHandler({
  environmentModel,
  readBody,
  json,
});
const routeEnvironment = createEnvironmentRouter(environmentHandler);
const handleVersionsAuditRequest = createVersionsAuditHandler();
const routeApi = createApiRouter([
  handleStateRequest,
  handleProjectsRequest,
  handleMovaRequest,
  handleComponentsRequest,
  handleBrowserRequest,
  handleMicrofrontendRequest,
  routeEnvironment,
  handleVersionsAuditRequest,
]);

async function handleApi(request, response, url) {
  if (await routeApi(request, response, url)) return;
  return json(response, 404, { error: "Ruta no encontrada" });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};
function serveInterface(response, pathname) {
  const requested =
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(distRoot, requested);
  const relation = path.relative(distRoot, filePath);
  if (relation.startsWith("..") || path.isAbsolute(relation))
    return json(response, 403, { error: "Acceso denegado" });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory())
    filePath = path.join(distRoot, "index.html");
  if (!fs.existsSync(filePath))
    return json(response, 503, { error: "Ejecuta npm run build." });
  response.writeHead(200, {
    "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || `${host}:${port}`}`,
  );
  try {
    if (url.pathname.startsWith("/api/"))
      await handleApi(request, response, url);
    else serveInterface(response, url.pathname);
  } catch (error) {
    addLog("Launcher", "error", error.message);
    json(response, 500, { error: error.message || "Error interno" });
  }
});

server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE" ? `El puerto ${port} ya está en uso.` : error,
  );
  process.exit(1);
});

if (process.argv.includes("--check")) {
  // Envolvemos en una función asíncrona autoejecutable
  (async () => {
    const versions = await getVersions();
    const projects = await getProjects();
    console.log(
      JSON.stringify(
        {
          ok: true,
          projectsDetected: projects.length,
          tagsDetected: versions.length,
          cachedVersions: versions.filter((item) => item.cached).length,
          preferredTag: readPreferences().preferredTag,
          interfaceBuilt: fs.existsSync(path.join(distRoot, "index.html")),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  })();
} else {
  server.listen(port, host, async () => {
    console.log(`Microfront Launcher V2 disponible en http://${host}:${port}`);
    if (process.env.NO_OPEN !== "1") {
      const browser = spawn(
        "cmd.exe",
        ["/c", "start", "", `http://${host}:${port}`],
        { detached: true, stdio: "ignore", windowsHide: true },
      );
      browser.unref();
    }
  });

  async function cleanupAndExit() {
    await cancelAndStopAll("Launcher cerrado");
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", cleanupAndExit);
  process.on("SIGTERM", cleanupAndExit);
}
