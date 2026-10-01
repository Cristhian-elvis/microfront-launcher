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

export interface MovaVersion {
  tag: string;
  version?: string;
  cached: boolean;
  date?: string;
  preferred?: boolean;
}

export interface ComponentsVersionPreference {
  mode: 'latest' | 'manual';
  selectedTag: string | null;
}

export interface LatestMovaVersion extends MovaVersion {
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
  preferredTag?: string;
  componentsVersion?: ComponentsVersionPreference;
  favoriteShellIds?: string[];
  favoriteMicrofrontIds?: string[];
  avatarLetters?: string;
}

export interface BootstrapErrors {
  projects?: string;
  versions?: string;
  logs?: string;
  setup?: string;
}

export interface BootstrapPayload {
  runtime: LauncherState;
  preferences: LauncherPreferences;
  projects: Project[];
  versions: MovaVersion[];
  logs: LauncherLog[];
  setup: SetupStatus;
  errors: BootstrapErrors;
}

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
  mova?: { sourcePath?: string };
  shellDefaults?: { serverPort?: number };
  chrome?: { browser?: string; openMode?: string; openHost?: string };
  preferences?: { avatarLetters?: string };
}
