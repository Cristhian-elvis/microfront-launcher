import { httpResource } from '@angular/common/http';
import { computed, effect, Injectable, signal } from '@angular/core';
import type {
  LauncherLog,
  LauncherState,
  MovaVersion,
  Project,
  SetupStatus,
} from './launcher.models';

/** Tracks only the first shared-data load needed before rendering the application shell. */
@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly booting = signal(true);

  readonly state = httpResource<LauncherState>(() => '/api/state');
  readonly projects = httpResource<Project[]>(() => '/api/projects', { defaultValue: [] });
  readonly versions = httpResource<MovaVersion[]>(() => '/api/mova/versions', { defaultValue: [] });
  readonly logs = httpResource<LauncherLog[]>(() => '/api/logs', { defaultValue: [] });
  readonly setup = httpResource<SetupStatus>(() => '/api/setup');

  private readonly initialResourcesSettled = computed(
    () =>
      this.state.status() !== 'idle' &&
      !this.state.isLoading() &&
      this.projects.status() !== 'idle' &&
      !this.projects.isLoading() &&
      this.versions.status() !== 'idle' &&
      !this.versions.isLoading() &&
      this.logs.status() !== 'idle' &&
      !this.logs.isLoading() &&
      this.setup.status() !== 'idle' &&
      !this.setup.isLoading(),
  );

  readonly isBooting = this.booting.asReadonly();
  readonly setupRequired = computed(() => this.setup.value()?.required ?? false);
  readonly bootstrapError = computed(
    () => this.state.error() ?? this.projects.error() ?? this.setup.error(),
  );

  constructor() {
    effect(() => {
      if (this.initialResourcesSettled()) this.booting.set(false);
    });
  }

  reloadState(): void {
    this.state.reload();
  }

  retry(): void {
    this.booting.set(true);
    this.state.reload();
    this.projects.reload();
    this.setup.reload();
  }
}
