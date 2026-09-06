import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import {
  appRoot,
  distRoot,
  configPath,
  preferencesPath,
  versionsRoot,
  workRoot,
  readConfig,
  readPreferences,
  writePreferences,
  writeJson,
  getProjects,
  saveProject,
  hideProject,
  getVersions,
  getTags,
  refreshTags,
  versionPaths,
  safeTagName,
  assertInside,
  needsInitialSetup,
  completeInitialSetup,
  getIndexedProject,
  gitBranchInfo,
} from "./lib/core.js";
import {
  childProcesses,
  eventClients,
  logs,
  emit,
  addLog,
  processStatus,
  spawnManaged,
  stopProcess,
  waitForUrl,
  inspectHttp,
  startStaticServer,
  stopStaticServer,
  stopAllStaticServers,
  serverStatus,
} from "./lib/runtime.js";
import { createMicrofrontendHandler } from "./handlers/microfrontend-handler.js";
import { createProjectsHandler } from "./handlers/projects-handler.js";
import { createBrowserHandler } from "./handlers/browser-handler.js";
import { createStateHandler } from "./handlers/state-handler.js";
import { createMovaHandler } from "./handlers/mova-handler.js";
import { createComponentsHandler } from "./handlers/components-handler.js";
import { createEnvironmentHandler } from "./handlers/environment-handler.js";
import { createApiRouter } from "./routes/api-router.js";
import { createVsCodeService } from "./services/vscode-service.js";
import { json, readBody } from "./lib/http.js";
import { state } from "./state.js";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 3187);

let environmentOperation = null;
let buildOperation = null;
let branchOperation = null;
let microfrontendBatchOperation = null;

function emitState() {
  emit("state", getState());
}

function getState() {
  return {
    ...state,
    processes: processStatus(),
    servers: serverStatus(),
    preferences: readPreferences(),
    busy: Boolean(environmentOperation),
    buildBusy: Boolean(buildOperation),
  };
}

function updateSession(patch) {
  state.session = { ...state.session, ...patch };
  emitState();
}

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

function beginExecution(project, steps, kind = "start") {
  state.execution = {
    status: "running",
    kind,
    projectId: project.id,
    projectName: project.name,
    steps: steps.map((step) => ({
      ...step,
      status: "pending",
      message: null,
      startedAt: null,
      endedAt: null,
    })),
    error: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  emitState();
}

function updateExecution(patch) {
  state.execution = { ...state.execution, ...patch };
  emitState();
}

function updateExecutionStep(id, patch) {
  state.execution = {
    ...state.execution,
    steps: state.execution.steps.map((step) =>
      step.id === id ? { ...step, ...patch } : step,
    ),
  };
  emitState();
}

function recordStartValidationError(project, error) {
  const now = new Date().toISOString();
  state.execution = {
    status: "error",
    kind: "start",
    projectId: project.id,
    projectName: project.name,
    steps: [
      {
        id: "validation",
        label: "Validar inicio",
        command: "Validar shell y MOVA Components",
        status: "error",
        message: error.message,
        startedAt: now,
        endedAt: now,
      },
    ],
    error: error.message,
    startedAt: now,
    endedAt: now,
  };
  emitState();
}

async function runTrackedStage({ id, message, task }) {
  const startedAt = new Date().toISOString();
  const index = state.execution.steps.findIndex((step) => step.id === id);
  const step = state.execution.steps[index];
  const label = step?.label || id;
  const action = step?.command || message;
  addLog(action, "stage", step?.detail || message);
  updateSession({ stage: id, message: action });
  updateExecutionStep(id, { status: "running", startedAt, message: null });
  try {
    const result = await task();
    updateExecutionStep(id, {
      status: "success",
      endedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    updateExecutionStep(id, {
      status: "error",
      message: error.message,
      endedAt: new Date().toISOString(),
    });
    addLog(label, "error", error.message);
    throw error;
  }
}

function resetRuntimeState() {
  state.components = {
    status: "stopped",
    url: null,
    version: null,
    tag: null,
    external: false,
  };
  state.shell = {
    status: "stopped",
    url: null,
    projectId: null,
    name: null,
    appName: null,
    external: false,
  };
  state.microfrontend = {
    status: "stopped",
    projectId: null,
    id: null,
    name: null,
    version: null,
  };
}

async function cleanupStartedResources() {
  if (state.shell.status !== "stopped")
    addLog("Shell", "info", "Deteniendo servidor HTTP de la shell.");
  await stopEnvironmentProcesses();
  await stopAllStaticServers();
  resetRuntimeState();
  emitState();
}

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

function selectedVersion() {
  const preferences = readPreferences();
  const versions = getVersions();
  return (
    versions.find((item) => item.tag === preferences.preferredTag) ||
    versions.find((item) => item.cached) ||
    versions[0] ||
    null
  );
}

function beginOperation(type, details = {}) {
  const key = type === "build" ? "buildOperation" : "environmentOperation";
  if (key === "buildOperation" ? buildOperation : environmentOperation)
    throw new Error(
      type === "build"
        ? "Ya hay una compilación en curso."
        : "Ya hay una operación de entorno en curso.",
    );
  const controller = new AbortController();
  const next = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    controller,
    ...details,
  };
  if (key === "buildOperation") buildOperation = next;
  else environmentOperation = next;
  return next;
}

function endOperation(id) {
  if (environmentOperation?.id === id) environmentOperation = null;
  if (buildOperation?.id === id) buildOperation = null;
  emitState();
}

function assertNotCancelled(signal) {
  if (signal?.aborted) throw new Error("Operación cancelada");
}

async function runProcessStep({ key, label, file, args, cwd, signal }) {
  assertNotCancelled(signal);
  const record = spawnManaged({
    key,
    label,
    file,
    args,
    cwd,
    longRunning: false,
  });
  const abort = () => stopProcess(key);
  signal?.addEventListener("abort", abort, { once: true });
  const result = await record.done;
  signal?.removeEventListener("abort", abort);
  assertNotCancelled(signal);
  if (result.code !== 0)
    throw new Error(`${label} terminó con código ${result.code}.`);
}

async function buildComponents(version, signal, { force = false } = {}) {
  const tag = version.tag;
  const available = getTags();
  if (!available.some((item) => item.tag === tag))
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
  const version = getVersions().find((item) => item.tag === tag);
  if (!version) throw new Error("La versión seleccionada no existe.");
  const current = beginOperation("build", { tag });
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
    endOperation(current.id);
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

async function ensureComponents(project, version, signal) {
  assertNotCancelled(signal);
  if (!version)
    throw new Error(
      "Selecciona una versión de MOVA Components antes de iniciar la shell.",
    );
  const paths = await buildComponents(version, signal);
  const link = path.join(
    project.serverPath,
    "cudc-lib-componentes-stencil-VAL",
  );
  assertInside(project.serverPath, link);
  addLog(
    "MOVA Components",
    "stage",
    `Verificando asociación para ${version.tag}.`,
  );
  if (fs.existsSync(link)) {
    const info = fs.lstatSync(link);
    if (info.isSymbolicLink() || info.isDirectory())
      fs.rmSync(link, { recursive: true, force: true });
  }
  assertNotCancelled(signal);
  addLog(
    "MOVA Components",
    "stage",
    "Creando asociación de Components en server.",
  );
  fs.symlinkSync(paths.dist, link, "junction");
  // La librería queda activa como parte del entorno de la shell.
  state.components = {
    status: "running",
    url: project.url,
    version: version.version,
    tag: version.tag,
    external: false,
  };
  addLog("MOVA Components", "success", "Asociación creada correctamente.");
  emitState();
}

async function startComponentsStandalone() {
  const version = selectedVersion();
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

function startMicrofrontend(project, microfrontend, signal) {
  assertNotCancelled(signal);
  if (!microfrontend?.watchAvailable)
    throw new Error(
      `El microfrontend ${microfrontend?.name || ""} no define npm run watch.`,
    );
  const key = `microfrontend:${project.id}:${microfrontend.id}`;
  state.microfrontend = {
    status: "starting",
    projectId: project.id,
    id: microfrontend.id,
    name: microfrontend.name,
    version: microfrontend.version,
  };
  emitState();
  const record = spawnManaged({
    key,
    label: microfrontend.name,
    file: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "watch"],
    cwd: microfrontend.path,
  });
  record.done.then(() => {
    if (state.microfrontend.id === microfrontend.id) {
      state.microfrontend = {
        status: "stopped",
        projectId: null,
        id: null,
        name: null,
        version: null,
      };
      emitState();
    }
  });
  state.microfrontend = { ...state.microfrontend, status: "running" };
  emitState();
}

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

async function startShell(project, signal) {
  assertNotCancelled(signal);
  if (state.shell.status !== "stopped")
    throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
  if (!project.configured || !project.appName)
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
  const appIndex = path.join(project.serverPath, project.appName, "index.html");
  addLog(project.name, "system", `Validando build local: ${appIndex}`);
  if (!fs.existsSync(appIndex)) {
    const message = `No existe el build local de ${project.appName}. Usa “Reconstruir antes de iniciar”.`;
    addLog(project.name, "error", message);
    throw new Error(message);
  }
  addLog(project.name, "system", "Build local encontrado. Iniciando la shell.");
  state.shell = {
    status: "starting",
    url: shellUrl.toString(),
    projectId: project.id,
    name: project.name,
    appName: project.appName,
    external: false,
  };
  emitState();
  await startStaticServer({
    key: "shell",
    label: project.name,
    root: project.serverPath,
    port: configuredPort,
    fallbackIndex: false,
    fallbackFile: path.join(project.appName, "index.html"),
    cors: true,
  });
  await waitForUrl(shellUrl.toString(), { signal });
  state.shell = {
    status: "running",
    url: shellUrl.toString(),
    projectId: project.id,
    name: project.name,
    appName: project.appName,
    external: false,
  };
  emitState();
}

function shellBuildIndex(project) {
  return path.join(project.serverPath, project.appName || "", "index.html");
}

function needsShellBuild(project) {
  return !project.appName || !fs.existsSync(shellBuildIndex(project));
}

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

function hasBrowserProfileOpen(browser) {
  if (process.platform !== "win32" || !browser.insecure)
    return Promise.resolve(false);
  const profile = browser.userDataDir.replace(/'/g, "''");
  const executable = path.basename(browser.path).replace(/'/g, "''");
  const script = `$profile = [Regex]::Escape('${profile}'); @(Get-CimInstance Win32_Process -Filter \"Name='${executable}'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match \"--user-data-dir=$profile(?:\\s|$)\" }).Count -gt 0`;
  return new Promise((resolve) =>
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
      (error, stdout) => resolve(!error && /^true\s*$/i.test(stdout)),
    ),
  );
}

async function openChrome(project, { newWindow = true } = {}) {
  const config = readConfig();
  const browser = browserSettings(config);
  if (!fs.existsSync(browser.path))
    throw new Error(`No se encontró ${browser.name}: ${browser.path}`);
  const chromeUrl = project
    ? new URL(project.url)
    : new URL("chrome://newtab/");
  if (project) {
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
  const alreadyOpen = await hasBrowserProfileOpen(browser);
  if (!alreadyOpen) return openChrome(project, { newWindow: true });
  if (config.chrome.openMode)
    return openChrome(project, {
      newWindow: config.chrome.openMode === "window",
    });
  state.browserPrompt = {
    projectId: project.id,
    browser: browser.name,
    insecure: browser.insecure,
  };
  addLog(
    browser.name,
    "system",
    "Ya hay una ventana con esta configuración. Esperando la elección de apertura.",
  );
  emitState();
}

async function runEnvironment(projectId, options = {}) {
  addLog(
    "Entorno",
    "stage",
    "Iniciando proceso. Validando la shell y MOVA Components…",
  );
  // AÑADIDO: await
  const project = (await getProjects()).find((item) => item.id === projectId);
  if (!project) throw new Error("Shell no encontrada.");
  const validationStartedAt = new Date().toISOString();
  beginExecution(project, [
    {
      id: "validation",
      label: "Validar inicio",
      command: "Validar shell y MOVA Components",
      detail: "Comprobando el build local y la configuración requerida.",
    },
  ]);
  updateExecutionStep("validation", {
    status: "running",
    startedAt: validationStartedAt,
  });
  let includeComponents;
  let version;
  let microfrontend;
  let automaticBuild;
  try {
    if (state.shell.status !== "stopped")
      throw new Error(`Ya hay una shell activa: ${state.shell.name}`);
    includeComponents = true;
    version = includeComponents ? selectedVersion() : null;
    if (includeComponents && !version)
      throw new Error("No hay versiones de MOVA UI Components disponibles.");
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
  } catch (error) {
    recordStartValidationError(project, error);
    throw error;
  }
  if (state.components.status === "running") {
    addLog(
      "MOVA Components",
      "stage",
      "Deteniendo Components independiente para iniciar la shell en el mismo puerto.",
    );
    await stopComponents();
    addLog("MOVA Components", "success", "Components independiente detenido.");
  }
  const current = beginOperation("environment", {
    projectId,
    microfrontendId: microfrontend?.id || null,
  });
  const signal = current.controller.signal;
  const plan = [
    ...(includeComponents ? ["components"] : []),
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
    ...(includeComponents
      ? [
          {
            id: "components",
            label: "MOVA Components",
            command: "Compilar Components en la shell",
            detail:
              "Instalando la librería dentro de server/cudc-lib-componentes-stencil-VAL",
          },
        ]
      : []),
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
  beginExecution(project, steps);
  updateExecutionStep("validation", {
    status: "success",
    startedAt: validationStartedAt,
    endedAt: new Date().toISOString(),
  });
  updateSession({
    status: "starting",
    stage: includeComponents ? "components" : "shell",
    plan,
    message: includeComponents
      ? `Iniciando MOVA Components ${version.version}`
      : `Iniciando ${project.name} sin MOVA Components`,
    projectId,
    projectName: project.name,
    startedAt: new Date().toISOString(),
  });

  try {
    if (includeComponents)
      await runTrackedStage({
        id: "components",
        message: `Compilando MOVA Components ${version.version}`,
        task: async () => {
          assertNotCancelled(signal);
          await ensureComponents(project, version, signal);
          assertNotCancelled(signal);
        },
      });
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
    await cleanupStartedResources();
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
    endOperation(current.id);
  }
}

async function rebuildShellServer(projectId) {
  // AÑADIDO: await
  const project = (await getProjects()).find((item) => item.id === projectId);
  if (!project) throw new Error("Shell no encontrada.");
  if (state.shell.status !== "stopped")
    throw new Error("Detén la shell antes de reconstruir su servidor.");
  if (!project.workflow?.prepareServer || !project.workflow?.buildLocal)
    throw new Error(
      "Esta shell no define npm run prepare-server y npm run build:local.",
    );

  const current = beginOperation("environment", {
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
    endOperation(current.id);
  }
}

async function cancelAndStopAll(reason = "Entorno detenido") {
  if (environmentOperation) environmentOperation.controller.abort();
  const projectName = state.shell.name || "Shell";
  const stopSteps = [
    ...(state.shell.status !== "stopped"
      ? [
          {
            id: "stopShell",
            label: projectName,
            command: "Detener shell",
            detail: "Cerrar servidor HTTP interno",
          },
        ]
      : []),
  ];
  state.execution = {
    status: "running",
    kind: "stop",
    projectId: state.shell.projectId,
    projectName,
    steps: stopSteps.map((step) => ({
      ...step,
      status: "pending",
      startedAt: null,
      endedAt: null,
    })),
    error: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  updateSession({ status: "stopping", stage: "stopping", message: reason });
  const stopStep = async (id, label, message, task) => {
    const index = state.execution.steps.findIndex((step) => step.id === id);
    const action = state.execution.steps[index]?.command || message;
    updateExecutionStep(id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    addLog(action, "stage", message);
    await task();
    updateExecutionStep(id, {
      status: "success",
      endedAt: new Date().toISOString(),
    });
  };
  try {
    if (state.shell.status !== "stopped")
      await stopStep(
        "stopShell",
        projectName,
        "Deteniendo servidor HTTP de la shell.",
        async () => {
          await stopStaticServer("shell");
          state.shell = {
            status: "stopped",
            url: null,
            projectId: null,
            name: null,
            appName: null,
            external: false,
          };
          emitState();
        },
      );
    if (state.components.status !== "stopped") {
      await stopStaticServer("components");
      state.components = {
        status: "stopped",
        url: null,
        version: null,
        tag: null,
        external: false,
      };
      addLog(
        "MOVA Components",
        "success",
        "Components detenido junto con la shell.",
      );
      emitState();
    }
    await stopEnvironmentProcesses();
    state.microfrontend = {
      status: "stopped",
      projectId: null,
      id: null,
      name: null,
      version: null,
    };
    updateExecution({ status: "success", endedAt: new Date().toISOString() });
  } catch (error) {
    updateExecution({
      status: "error",
      error: error.message,
      endedAt: new Date().toISOString(),
    });
    throw error;
  }
  environmentOperation = null;
  updateSession({
    status: "idle",
    stage: "idle",
    plan: null,
    message: reason,
    projectId: null,
    projectName: null,
    startedAt: null,
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

async function reopenChrome({ newWindow = true } = {}) {
  if (state.shell.status !== "running" || !state.shell.projectId)
    throw new Error("No hay una shell activa para abrir en Chrome.");
  // AÑADIDO: await
  const project = (await getProjects()).find(
    (item) => item.id === state.shell.projectId,
  );
  if (!project)
    throw new Error("No se encontró la configuración de la shell activa.");
  await openChrome(project, { newWindow });
}

async function openEmptyBrowser() {
  await openChrome(null, { newWindow: true });
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
  updateMicrofrontendCache(projectId, microfrontendId, newGitInfo);

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
const handleMicrofrontendRequest = createMicrofrontendHandler({
  openMicrofrontend: vsCodeService.openMicrofrontend,
  buildMicrofrontend,
  startBuildBatch: startMicrofrontendBuildBatch,
  startBranchSwitch: startMicrofrontendBranchSwitch,
  startBranchBatch: startMicrofrontendBranchBatch,
  startWatch: startMicrofrontend,
});
const handleProjectsRequest = createProjectsHandler({
  getState,
  getProjects,
  readConfig,
  saveProject,
  hideProject,
  needsInitialSetup,
  completeInitialSetup,
  writeJson,
  configPath,
  selectLocalDirectory,
  openScaffolding,
  openProjectWebapp: vsCodeService.openProjectWebapp,
  gitBranchInfo,
  readBody,
  json,
});
const handleBrowserRequest = createBrowserHandler({
  state,
  getProjects,
  openOrRequestBrowser,
  reopenChrome,
  openEmptyBrowser,
  readConfig,
  writeJson,
  configPath,
  emitState,
  readBody,
  json,
});
const handleStateRequest = createStateHandler({
  getState,
  readConfig,
  needsInitialSetup,
  getProjects,
  logs,
  eventClients,
  json,
});
const handleMovaRequest = createMovaHandler({
  getVersions,
  getTags,
  refreshTags,
  writePreferences,
  emitState,
  addLog,
  compileVersion,
  cancelBuild,
  readBody,
  json,
});
const handleComponentsRequest = createComponentsHandler({
  state,
  startComponents: startComponentsStandalone,
  stopComponents,
  stopEnvironment: cancelAndStopAll,
  json,
});
const handleEnvironmentRequest = createEnvironmentHandler({
  runEnvironment,
  rebuildShellServer,
  cancelAndStopAll,
  addLog,
  readBody,
  json,
});
const routeApi = createApiRouter([
  handleStateRequest,
  handleProjectsRequest,
  handleMovaRequest,
  handleComponentsRequest,
  handleBrowserRequest,
  handleMicrofrontendRequest,
  handleEnvironmentRequest,
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
    const versions = getVersions();
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

export function updateMicrofrontendCache(
  projectId,
  microfrontendId,
  gitBranchData,
) {
  // Si el caché está vacío, no hacemos nada
  if (!scanCache || !scanCache.projects) return;

  const project = scanCache.projects.find((p) => p.id === projectId);
  if (!project || !project.microfrontends) return;

  const mf = project.microfrontends.find((m) => m.id === microfrontendId);
  if (!mf) return;

  // Actualizamos solo los datos de Git de este microfrontend específico
  mf.branch = gitBranchData.branch;
  mf.branches = gitBranchData.branches;
}
