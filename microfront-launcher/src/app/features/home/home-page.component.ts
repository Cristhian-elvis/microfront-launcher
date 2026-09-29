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
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import type {
  ApiMessage,
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

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  imports: [FloatLabel, Select, FormsModule, Button, ProcessConsoleComponent],
})
export class HomePageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly launcher = inject(LauncherService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = this.bootstrap.state.value;
  protected readonly projects = this.bootstrap.projects.value;
  protected readonly versions = this.bootstrap.versions.value;
  protected readonly logs = this.bootstrap.logs.value;
  protected readonly selectedVersionTag = signal('');
  protected readonly selectedProjectId = signal(
    localStorage.getItem('microfront-last-shell-id') ?? '',
  );
  protected readonly actionPending = signal(false);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  protected readonly componentsActive = computed(
    () => this.state()?.components.status === 'running',
  );
  protected readonly shellReady = computed(() => {
    console.log('shellReady', this.state());
    return this.state()?.shell.status === 'running';
  });
  protected readonly shellStarting = computed(() => {
    console.log('shellStarting', this.state());
    return this.state()?.shell.status === 'starting';
  });
  protected readonly shellRunning = computed(() => {
    const currentState = this.state();
    return currentState !== undefined && currentState.shell.status !== 'stopped';
  });
  protected readonly versionSelectionDisabled = computed(
    () =>
      !this.versions().length ||
      Boolean(this.state()?.busy) ||
      this.componentsActive() ||
      this.shellRunning(),
  );
  protected readonly environmentLabel = computed(() => {
    const currentState = this.state();
    if (currentState?.execution?.status === 'error') return 'Error';
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

      this.selectedVersionTag.set(state.preferences.preferredTag ?? this.selectedVersionTag());
      if (state.shell.projectId) this.selectedProjectId.set(state.shell.projectId);
    });
  }

  protected saveVersion(): void {
    const tag = this.selectedVersionTag();
    if (!tag) return;
    this.run(
      this.launcher.savePreferredVersion(tag).pipe(tap(() => this.bootstrap.reloadState())),
      'Versión preferida actualizada.',
    );
  }

  protected startComponents(): void {
    this.run(this.launcher.startComponents(), 'MOVA Components se está iniciando.');
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

  private notifyError(error: unknown): void {
    const detail = error instanceof Error ? error.message : 'No se pudo completar la operación.';
    this.messages.add({ severity: 'error', summary: 'Error', detail });
  }

  private projectDisplayName(name: string | null | undefined): string {
    const value = String(name ?? '');
    const match = /^([a-z0-9]{4})_webapp_/i.exec(value);
    return ((match?.[1] ?? value) || 'Ninguna').toUpperCase();
  }
}
