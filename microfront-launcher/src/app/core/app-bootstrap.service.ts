import { httpResource } from '@angular/common/http';
import { computed, effect, Injectable, signal } from '@angular/core';
import type {
  BootstrapErrors,
  BootstrapPayload,
  LauncherLog,
  LauncherPreferences,
  LauncherState,
  MovaVersion,
  Project,
  SetupStatus,
} from './launcher.models';

const defaultPreferences: LauncherPreferences = {
  componentsVersion: { mode: 'latest', selectedTag: null },
  favoriteShellIds: [],
  favoriteMicrofrontIds: [],
  avatarLetters: 'ML',
};

/** Hydrates shared stores from one bootstrap response and keeps them independently updated. */
@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly booting = signal(true);
  private readonly startupError = signal<Error | null>(null);

  readonly bootstrap = httpResource<BootstrapPayload>(() => '/api/bootstrap');
  readonly state = signal<LauncherState | null>(null);
  readonly preferences = signal<LauncherPreferences>(defaultPreferences);
  readonly projects = signal<Project[]>([]);
  readonly versions = signal<MovaVersion[]>([]);
  readonly logs = signal<LauncherLog[]>([]);
  readonly setup = signal<SetupStatus>({ required: false });
  readonly errors = signal<BootstrapErrors>({});

  readonly isBooting = this.booting.asReadonly();
  readonly setupRequired = computed(() => this.setup().required);
  readonly bootstrapError = computed(() => {
    const transportError = this.bootstrap.error();
    if (transportError) return transportError;
    const errors = this.errors();
    return errors.projects || errors.setup
      ? new Error(errors.projects ?? errors.setup)
      : this.startupError();
  });

  constructor() {
    effect(() => {
      const payload = this.bootstrap.value();
      if (payload) {
        this.applyBootstrap(payload);
        this.booting.set(false);
      } else if (this.bootstrap.error()) {
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

  setVersions(versions: MovaVersion[]): void {
    this.versions.set(versions);
  }

  appendLog(log: LauncherLog): void {
    this.logs.update((logs) =>
      logs.some((entry) => entry.id === log.id) ? logs : [...logs.slice(-499), log],
    );
  }

  reload(): void {
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

  private applyBootstrap(payload: BootstrapPayload): void {
    this.state.set(payload.runtime);
    this.preferences.set(payload.preferences);
    this.projects.set(payload.projects);
    // El bootstrap no transporta tags: se cargan bajo demanda desde Inicio
    // (modo manual) o la página de Versiones. No sobrescribimos una carga
    // diferida que haya terminado antes que el bootstrap.
    this.logs.set(payload.logs);
    this.setup.set(payload.setup);
    this.errors.set(payload.errors);
  }
}
