export interface Project {
  id: string;
  name: string;
  appName?: string;
  configFolder?: string;
  path?: string;
  webappPath?: string;
  gitInfo?: { shell?: { branch?: string; exactTag?: string }; webapp?: { branch?: string } };
  microfrontends?: Array<{ id: string; name: string; path?: string; branch?: string; branches?: string[]; outOfSync?: boolean; localBuildAvailable?: boolean }>;
}

export interface MovaVersion {
  tag: string;
  cached: boolean;
  date?: string;
  preferred?: boolean;
}

export interface LauncherState {
  busy: boolean;
  buildBusy: boolean;
  preferences: { preferredTag?: string; favoriteShellIds?: string[] };
  session: { status: string; message?: string };
  components: { status: string; external?: boolean; version?: string | null };
  shell: { status: string; projectId?: string | null; name?: string | null };
  build?: { status: string; tag?: string | null; message?: string | null };
  processes?: Array<{ key: string }>;
  execution?: { status: string; kind?: string; error?: string | null; projectId?: string | null };
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
