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
import type { ApiMessage } from '../../core/launcher.models';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { LauncherService } from '../../core/launcher.service';
import { ProcessConsoleComponent } from '../../shared/components/process-console/process-console.component';

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
  protected readonly logs = this.bootstrap.logs;
  protected readonly latestVersion = this.bootstrap.latestVersion;
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
    const status = this.state()?.shell.status;
    return status === 'preparing' || status === 'starting';
  });
  protected readonly shellRunning = computed(() => {
    const currentState = this.state();
    return currentState !== null && currentState.shell.status !== 'stopped';
  });
  protected readonly sessionBusy = computed(() =>
    ['starting', 'building', 'stopping'].includes(this.state()?.session.status ?? ''),
  );
  protected readonly activeVersion = computed(
    () => this.state()?.components.version ?? this.latestVersion()?.tag ?? 'No disponible',
  );
  protected readonly versionReady = computed(() => Boolean(this.latestVersion()));
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

  constructor() {
    effect(() => {
      const state = this.state();
      if (!state) return;

      if (state.shell.projectId) this.selectedProjectId.set(state.shell.projectId);
      else if (!this.selectedProjectId() && this.projects().length) this.selectedProjectId.set(this.projects()[0].id);
    });
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

  private notifyError(error: unknown): void {
    const detail = error instanceof Error ? error.message : 'No se pudo completar la operación.';
    this.messages.add({ severity: 'error', summary: 'Error', detail });
  }


  private projectDisplayName(name: string | null | undefined): string {
    const value = String(name ?? '');
    if (!value) return 'Ninguna';
    return (/^[a-z0-9]{4}/i.exec(value)?.[0] ?? value.slice(0, 4)).toLowerCase();
  }
}
