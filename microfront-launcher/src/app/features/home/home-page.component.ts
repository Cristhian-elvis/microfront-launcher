import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { FloatLabel } from 'primeng/floatlabel';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import type {
  ApiMessage,
  ComponentsVersionPreference,
  LatestMovaVersion,
  MovaVersion,
} from '../../core/launcher.models';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { LauncherService } from '../../core/launcher.service';
import { ProcessConsoleComponent } from '../../shared/components/process-console/process-console.component';

interface VersionOption {
  label: string;
  value: string;
}

interface VersionGroup {
  label: string;
  items: VersionOption[];
}

interface ProjectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  imports: [FloatLabel, Select, FormsModule, Button, Tag, ProcessConsoleComponent],
})
export class HomePageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly launcher = inject(LauncherService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = this.bootstrap.state;
  protected readonly preferences = this.bootstrap.preferences;
  protected readonly projects = this.bootstrap.projects;
  protected readonly versions = this.bootstrap.versions;
  protected readonly logs = this.bootstrap.logs;
  protected readonly selectedVersionTag = signal('');
  protected readonly latestVersion = signal<LatestMovaVersion | null>(null);
  protected readonly latestLoading = signal(false);
  protected readonly latestError = signal('');
  protected readonly selectedProjectId = signal(
    localStorage.getItem('microfront-last-shell-id') ?? '',
  );
  protected readonly actionPending = signal(false);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  protected readonly versionPreference = computed<ComponentsVersionPreference>(() =>
    this.preferences().componentsVersion ?? { mode: 'latest', selectedTag: null },
  );
  protected readonly componentsActive = computed(
    () => this.state()?.components.status === 'running',
  );
  protected readonly shellReady = computed(() => {
    console.log('shellReady', this.state());
    return this.state()?.shell.status === 'running';
  });
  protected readonly shellStarting = computed(() => {
    const status = this.state()?.shell.status;
    return status === 'preparing' || status === 'starting';
  });
  protected readonly shellRunning = computed(() => {
    const currentState = this.state();
    return currentState !== null && currentState.shell.status !== 'stopped';
  });
  protected readonly versionSelectionDisabled = computed(
    () => this.sessionBusy(),
  );
  protected readonly sessionBusy = computed(() =>
    ['starting', 'building', 'stopping'].includes(this.state()?.session.status ?? ''),
  );
  protected readonly versionLocked = computed(() => this.componentsActive() || this.shellRunning());
  protected readonly activeVersion = computed(
    () => this.state()?.components.version ?? this.latestVersion()?.tag ?? this.selectedVersionTag() ?? 'No disponible',
  );
  protected readonly versionReady = computed(() =>
    this.versionPreference().mode === 'latest'
      ? Boolean(this.latestVersion())
      : Boolean(this.selectedVersionTag()),
  );
  protected readonly projectOptions = computed<ProjectOption[]>(() =>
    this.projects().map((project) => ({
      label: this.projectDisplayName(project.name),
      value: project.id,
    })),
  );
  protected readonly environmentLabel = computed(() => {
    const currentState = this.state();
    if (currentState?.session.status === 'error') return 'Error';
    if (currentState?.session.status === 'ready') return 'Listo';
    if (currentState?.session.status === 'stopping') return 'Deteniendo';
    if (currentState?.session.status === 'starting') return 'Iniciando';
    return 'Detenido';
  });
  protected readonly activeShellName = computed(() =>
    this.projectDisplayName(this.state()?.shell.name),
  );
  protected readonly versionGroups = computed<VersionGroup[]>(() => {
    const compiled = this.toVersionOptions(this.versions().filter((version) => version.cached));
    const pending = this.toVersionOptions(this.versions().filter((version) => !version.cached));
    return [
      ...(compiled.length ? [{ label: 'Versiones compiladas', items: compiled }] : []),
      ...(pending.length ? [{ label: 'Versiones por compilar', items: pending }] : []),
    ];
  });

  constructor() {
    effect(() => {
      const state = this.state();
      if (!state) return;

      if (this.versionPreference().mode === 'manual') {
        this.selectedVersionTag.set(this.versionPreference().selectedTag ?? '');
      }
      if (state.shell.projectId) this.selectedProjectId.set(state.shell.projectId);
    });
    effect((onCleanup) => {
      const project = this.selectedProject();
      if (this.versionPreference().mode !== 'latest' || !project) {
        this.latestVersion.set(null);
        this.latestError.set('');
        this.latestLoading.set(false);
        return;
      }
      this.latestLoading.set(true);
      this.latestError.set('');
      const subscription = this.launcher.getLatestVersion(project.id).subscribe({
        next: (version) => this.latestVersion.set(version),
        error: (error: unknown) => {
          this.latestVersion.set(null);
          this.latestError.set(this.errorDetail(error));
          this.latestLoading.set(false);
        },
        complete: () => this.latestLoading.set(false),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected saveVersion(): void {
    const tag = this.selectedVersionTag();
    if (!tag) return;
    this.run(
      this.launcher.saveComponentsVersion({ mode: 'manual', selectedTag: tag }),
      'Versión preferida actualizada.',
    );
  }

  protected changeVersionMode(mode: 'latest' | 'manual'): void {
    if (mode === 'manual') this.loadVersions();
    this.run(
      this.launcher.saveComponentsVersion({
        mode,
        selectedTag: mode === 'manual' ? this.selectedVersionTag() || null : null,
      }),
      mode === 'latest' ? 'Se usará la última versión publicada.' : 'Selecciona una versión manual.',
    );
  }

  protected startComponents(): void {
    const project = this.selectedProject();
    if (!project) return;
    this.run(this.launcher.startComponents(project.id), 'MOVA Components se está iniciando.');
  }

  protected stopComponents(): void {
    this.run(this.launcher.stopComponents(), 'Components detenido.');
  }

  protected startShell(): void {
    const project = this.selectedProject();
    if (!project) return;
    localStorage.setItem('microfront-last-shell-id', project.id);
    this.run(this.launcher.startEnvironment(project.id), 'La shell se está iniciando.');
  }

  protected stopEnvironment(): void {
    this.run(this.launcher.stopEnvironment(), 'El entorno se está deteniendo.');
  }

  protected openBrowser(mode: 'tab' | 'window'): void {
    this.run(this.launcher.openBrowser(mode), 'Navegador abierto.');
  }

  private run(request: Observable<ApiMessage>, success: string): void {
    this.actionPending.set(true);
    request
      .pipe(
        finalize(() => this.actionPending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.messages.add({
            severity: 'success',
            summary: 'Operación enviada',
            detail: result.message ?? success,
          });
        },
        error: (error: unknown) => this.notifyError(error),
      });
  }

  private toVersionOptions(versions: MovaVersion[]): VersionOption[] {
    return versions.map((version) => ({ label: version.tag, value: version.tag }));
  }

  private loadVersions(): void {
    this.launcher.getVersions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (versions) => this.bootstrap.setVersions(versions),
      error: (error: unknown) => this.notifyError(error),
    });
  }

  private notifyError(error: unknown): void {
    const detail = error instanceof Error ? error.message : 'No se pudo completar la operación.';
    this.messages.add({ severity: 'error', summary: 'Error', detail });
  }

  private errorDetail(error: unknown): string {
    if (typeof error === 'object' && error && 'error' in error) {
      const body = (error as { error?: { error?: string } }).error;
      if (body?.error) return body.error;
    }
    return error instanceof Error ? error.message : 'No se pudo consultar la última versión.';
  }

  private projectDisplayName(name: string | null | undefined): string {
    const value = String(name ?? '');
    if (!value) return 'Ninguna';
    return (/^[a-z0-9]{4}/i.exec(value)?.[0] ?? value.slice(0, 4)).toLowerCase();
  }
}
