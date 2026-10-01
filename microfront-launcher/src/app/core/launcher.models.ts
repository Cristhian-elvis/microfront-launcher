export interface Project {
  id: string;
  name: string;
  appName?: string;
  configFolder?: string;
  path?: string;
  webappPath?: string;
  gitInfo?: ProjectGitInfo;
  microfrontends?: Array<{
    id: string;
    name: string;
    path?: string;
    branch?: string | null;
    branches?: string[];
    outOfSync?: boolean;
    localBuildAvailable?: boolean;
    buildAvailable?: boolean;
    version?: string;
  }>;
}

export interface RepositoryGitInfo {
  branch?: string | null;
  branches?: string[];
  exactTag?: string | null;
}

export interface ProjectGitInfo {
  projectId?: string;
  loadedAt?: string;
  shell?: RepositoryGitInfo;
  webapp?: RepositoryGitInfo;
  microfrontends?: Array<RepositoryGitInfo & { id: string }>;
}

export interface LatestMovaVersion {
  tag: string;
  version?: string;
  cached: boolean;
  date?: string;
  packageUrl: string;
  source: 'latest';
}

export interface LauncherState {
  session: {
    status: string;
    stage?: string;
    message?: string;
    projectId?: string | null;
    projectName?: string | null;
  };
  components: { status: string; external?: boolean; version?: string | null };
  shell: { status: string; projectId?: string | null; name?: string | null };
  build?: { status: string; tag?: string | null; message?: string | null };
  microfrontendBranch?: MicrofrontendOperation;
  microfrontendBuild?: MicrofrontendOperation;
  microfrontendOperations?: Record<string, MicrofrontendOperation>;
}

export interface LauncherPreferences {
  favoriteShellIds?: string[];
  favoriteMicrofrontIds?: string[];
  avatarLetters?: string;
}

export interface BootstrapErrors {
  projects?: string;
  logs?: string;
  setup?: string;
  latestVersion?: string;
}

export interface BootstrapPayload {
  runtime: LauncherState;
  preferences: LauncherPreferences;
  projects: Project[];
  latestVersion: LatestMovaVersion | null;
  logs: LauncherLog[];
  setup: SetupStatus;
  errors: BootstrapErrors;
}

/** Respuesta mínima mientras falta completar la configuración inicial. */
export interface SetupBootstrapPayload {
  setup: SetupStatus;
}

export type BootstrapResponse = BootstrapPayload | SetupBootstrapPayload;

export interface MicrofrontendOperation {
  status: 'idle' | 'running' | 'success' | 'error';
  projectId?: string | null;
  microfrontendId?: string | null;
  batchIds?: string[];
  completedIds?: string[];
  message?: string | null;
  error?: string | null;
  startedAt?: string | null;
}

export interface LauncherLog {
  id: string;
  at: string;
  source: string;
  level: 'success' | 'error' | 'stage' | 'info';
  message: string;
}

export interface ApiMessage {
  ok?: boolean;
  message?: string;
}

export interface SetupStatus {
  required: boolean;
}

export interface LauncherConfig {
  rootPath?: string;
  mova?: {
    sourcePath?: string;
    cdnHost?: string;
    stencilComponentsFolderName?: string;
  };
  shellDefaults?: { serverPort?: number };
  browser?: {
    selected?: string;
    openMode?: string;
    openHost?: string;
    chrome?: { path?: string; userDataDir?: string };
    edge?: { path?: string; userDataDir?: string };
  };
  preferences?: { avatarLetters?: string };
}
