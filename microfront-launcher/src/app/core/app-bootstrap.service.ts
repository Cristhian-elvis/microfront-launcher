import { httpResource } from '@angular/common/http';
import { computed, effect, Injectable, signal } from '@angular/core';
import type {
  BootstrapErrors,
  BootstrapPayload,
  BootstrapResponse,
  LauncherLog,
  LauncherPreferences,
  LauncherState,
  Project,
  SetupStatus,
} from './launcher.models';

const defaultPreferences: LauncherPreferences = {
  favoriteShellIds: [],
  favoriteMicrofrontIds: [],
  avatarLetters: 'ML',
};

/** Hydrates shared stores from one bootstrap response and keeps them independently updated. */
@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly booting = signal(true);
  private readonly startupError = signal<Error | null>(null);

  readonly bootstrap = httpResource<BootstrapResponse>(() => '/api/bootstrap');
  readonly state = signal<LauncherState | null>(null);
  readonly preferences = signal<LauncherPreferences>(defaultPreferences);
  readonly projects = signal<Project[]>([]);
  readonly latestVersion = signal<BootstrapPayload['latestVersion']>(null);
  readonly logs = signal<LauncherLog[]>([]);
  readonly setup = signal<SetupStatus>({ required: false });
  readonly errors = signal<BootstrapErrors>({});

  readonly isBooting = this.booting.asReadonly();
  readonly setupRequired = computed(() => this.setup().required);
  readonly bootstrapError = computed(() => {
    const transportError = this.bootstrap.error();
    if (transportError) return transportError;
    const errors = this.errors();
    return errors.projects || errors.setup || errors.latestVersion
      ? new Error(errors.projects ?? errors.setup ?? errors.latestVersion)
      : this.startupError();
  });

  constructor() {
    effect(() => {
      const status = this.bootstrap.status();
      if (status === 'idle' || status === 'loading' || status === 'reloading') return;

      const payload = this.bootstrap.value();
      if (payload) {
        this.applyBootstrap(payload);
        this.booting.set(false);
      } else if (status === 'error') {
        this.booting.set(false);
      }
    });
  }

  setRuntime(runtime: LauncherState): void {
    this.state.set(runtime);
  }

  setPreferences(preferences: LauncherPreferences): void {
    this.preferences.set(preferences);
  }

  appendLog(log: LauncherLog): void {
    this.logs.update((logs) =>
      logs.some((entry) => entry.id === log.id) ? logs : [...logs.slice(-499), log],
    );
  }

  reload(): void {
    this.booting.set(true);
    this.bootstrap.reload();
  }

  retry(): void {
    this.booting.set(true);
    this.startupError.set(null);
    this.bootstrap.reload();
  }

  setStartupError(message: string): void {
    this.startupError.set(new Error(message));
  }

  private applyBootstrap(payload: BootstrapResponse): void {
    if (!('runtime' in payload)) {
      this.setup.set(payload.setup);
      this.state.set(null);
      this.preferences.set(defaultPreferences);
      this.projects.set([]);
      this.latestVersion.set(null);
      this.logs.set([]);
      this.errors.set({});
      return;
    }
    this.state.set(payload.runtime);
    this.preferences.set(payload.preferences);
    this.projects.set(payload.projects);
    this.latestVersion.set(payload.latestVersion);
    this.logs.set(payload.logs);
    this.errors.set(payload.errors);
    this.setup.set(payload.setup);
  }
}
