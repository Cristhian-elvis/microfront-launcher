import { spawn } from 'node:child_process';

import { createComponentsUseCases } from '../application/components/components-use-cases.js';
import { createMicrofrontendBranchUseCases } from '../application/microfrontends/branch-use-cases.js';
import { EnvironmentLifecycleService } from '../api/environment/lifecycle.js';
import { createEnvironmentModel } from '../api/environment/model.js';
import { createEnvironmentService } from '../api/environment/service.js';
import {
  getIndexedProject,
  getProjects,
  readConfig,
} from '../lib/core.js';
import { addLog } from '../lib/runtime.js';
import { createBrowserService } from './browser-service.js';
import { createComponentsRuntimeService } from './components-runtime-service.js';
import { createGitService } from './git-service.js';
import { createLocalDirectoryPicker } from './local-directory-picker-service.js';
import { createMicrofrontendBuildService } from './microfrontend-build-service.js';
import { MicrofrontendRuntimeService } from './microfrontend-runtime-service.js';
import { selectMicrofrontends } from './microfrontend-selection-service.js';
import { createProjectGitService } from './project-git-service.js';
import { RuntimeStateService } from './runtime-state-service.js';
import { createShellRuntimeService } from './shell-runtime-service.js';
import { createVsCodeService } from './vscode-service.js';

let branchOperation = null;

const gitService = createGitService();
const branchUseCases = createMicrofrontendBranchUseCases({
  state: RuntimeStateService.getState(),
  runGit: gitService.runGit,
  isBranchOperationRunning: () => Boolean(branchOperation),
  setBranchOperation: (operation) => {
    branchOperation = operation;
  },
  clearBranchOperation: () => {
    branchOperation = null;
  },
  selectMicrofrontends,
});

const { buildComponents, startComponentsStandalone, stopComponents } =
  createComponentsUseCases();

const componentsRuntime = createComponentsRuntimeService({
  buildComponents,
});

const microfrontendBuildService = createMicrofrontendBuildService({
  isBranchOperationRunning: () => Boolean(branchOperation),
});

const shellRuntime = createShellRuntimeService();
const browserService = createBrowserService({ addLog, readConfig });
const selectLocalDirectory = createLocalDirectoryPicker();

async function findProject(projectId) {
  return getIndexedProject(projectId)
    || (await getProjects()).find((project) => project.id === projectId);
}

const vsCodeService = createVsCodeService({ findProject, addLog });
const projectGitService = createProjectGitService({ findProject });

async function openOrRequestBrowser(project) {
  const config = readConfig();
  return browserService.open(project, {
    newWindow: config.browser.openMode === 'window',
  });
}

export async function cancelAndStopAll(reason = 'Entorno detenido') {
  await EnvironmentLifecycleService.stopEnvironmentInternals({
    reason,
    emitFinalSession: true,
  });
}

async function openScaffolding(projectId) {
  const project = (await getProjects()).find((item) => item.id === projectId);
  if (!project) throw new Error('Shell no encontrada.');
  if (!project.workflow?.scaffolding) {
    throw new Error('Esta shell no define npm run scaffolding.');
  }

  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/k', 'npm run scaffolding'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    : spawn('npm', ['run', 'scaffolding'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
    });

  child.unref();
  addLog(
    project.name,
    'system',
    'Configuración inicial abierta en una terminal independiente.',
  );
}

async function reopenBrowser({
  newWindow = true,
  url = null,
  browserMode = null,
} = {}) {
  const state = RuntimeStateService.getState();
  const project = state.shell.status === 'running' && state.shell.projectId
    ? getIndexedProject(state.shell.projectId)
    : null;

  if (state.shell.projectId && !project) {
    throw new Error('No se encontró la configuración de la shell activa.');
  }

  await browserService.open(project, { newWindow, url, browserMode });
}

async function openEmptyBrowser({ newWindow = true, url = null } = {}) {
  await browserService.open(null, { newWindow, url });
}

const environmentService = createEnvironmentService({
  componentsRuntime,
  shellRuntime,
  openOrRequestBrowser,
});

export const environmentModel = createEnvironmentModel({
  environmentService,
  cancelAndStopAll,
});

export const launcherService = {
  buildMicrofrontend: microfrontendBuildService.buildMicrofrontend,
  getProjectGitInfo: projectGitService.getProjectGitInfo,
  openEmptyBrowser,
  openMicrofrontend: vsCodeService.openMicrofrontend,
  openProjectWebapp: vsCodeService.openProjectWebapp,
  openScaffolding,
  reopenBrowser,
  selectLocalDirectory,
  startBranchBatch: branchUseCases.startMicrofrontendBranchBatch,
  startBranchSwitch: branchUseCases.startMicrofrontendBranchSwitch,
  startBuildBatch: microfrontendBuildService.startBatch,
  startComponents: startComponentsStandalone,
  startWatch: MicrofrontendRuntimeService.startMicrofrontend,
  stopComponents,
  stopEnvironment: cancelAndStopAll,
};
