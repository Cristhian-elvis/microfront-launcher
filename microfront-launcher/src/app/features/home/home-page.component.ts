import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { FloatLabel } from 'primeng/floatlabel';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Observable, forkJoin } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import type { ApiMessage, LauncherLog, LauncherState, MovaVersion, Project } from '../../core/launcher.models';
import type { LauncherEvent } from '../../core/launcher-events.service';
import { LauncherEventsService } from '../../core/launcher-events.service';

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
  imports: [Bind, ProgressSpinner, FloatLabel, Select, FormsModule, Button, DatePipe]
})
export class HomePageComponent {
  private readonly api = inject(ApiService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LauncherState | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly versions = signal<MovaVersion[]>([]);
  protected readonly logs = signal<LauncherLog[]>([]);
  protected readonly selectedVersionTag = signal('');
  protected readonly selectedProjectId = signal(localStorage.getItem('microfront-last-shell-id') ?? '');
  protected readonly loading = signal(true);
  protected readonly actionPending = signal(false);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId())
  );
  protected readonly componentsActive = computed(() => this.state()?.components.status === 'running');
  protected readonly shellReady = computed(() => this.state()?.shell.status === 'running');
  protected readonly shellStarting = computed(() => this.state()?.shell.status === 'starting');
  protected readonly shellRunning = computed(() => {
    const currentState = this.state();
    return currentState !== null && currentState.shell.status !== 'stopped';
  });
  protected readonly versionSelectionDisabled = computed(() =>
    !this.versions().length || Boolean(this.state()?.busy) || this.componentsActive() || this.shellRunning()
  );
  protected readonly environmentLabel = computed(() => {
    const currentState = this.state();
    if (currentState?.execution?.status === 'error') return 'Error';
    if (currentState?.session.status === 'ready') return 'Listo';
    if (currentState?.session.status === 'stopping') return 'Deteniendo';
    if (currentState?.session.status === 'starting') return 'Iniciando';
    return 'Detenido';
  });
  protected readonly activeShellName = computed(() => this.projectDisplayName(this.state()?.shell.name));
  protected readonly versionGroups = computed<VersionGroup[]>(() => {
    const compiled = this.toVersionOptions(this.versions().filter((version) => version.cached));
    const pending = this.toVersionOptions(this.versions().filter((version) => !version.cached));
    return [
      ...(compiled.length ? [{ label: 'Versiones compiladas', items: compiled }] : []),
      ...(pending.length ? [{ label: 'Versiones por compilar', items: pending }] : [])
    ];
  });

  constructor() {
    this.load();
    this.events.events()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.receiveEvent(event),
        error: () => this.messages.add({ severity: 'warn', summary: 'Conexión', detail: 'No se pudo mantener la conexión de eventos.' })
      });
  }

  protected load(): void {
    this.loading.set(true);
    this.snapshot()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: (error: unknown) => this.notifyError(error)
      });
  }

  protected saveVersion(): void {
    const tag = this.selectedVersionTag();
    if (!tag) return;
    this.run(this.api.put<ApiMessage>('/api/mova/preferences', { preferredTag: tag }), 'Versión preferida actualizada.');
  }

  protected startComponents(): void {
    this.run(this.api.post<ApiMessage>('/api/components/start'), 'MOVA Components se está iniciando.');
  }

  protected stopComponents(): void {
    this.run(this.api.post<ApiMessage>('/api/components/stop'), 'Components detenido.');
  }

  protected startShell(): void {
    const project = this.selectedProject();
    if (!project) return;
    localStorage.setItem('microfront-last-shell-id', project.id);
    this.run(this.api.post<ApiMessage>('/api/environment/start', { projectId: project.id }), 'La shell se está iniciando.');
  }

  protected stopEnvironment(): void {
    this.run(this.api.post<ApiMessage>('/api/environment/stop'), 'El entorno se está deteniendo.');
  }

  protected openBrowser(mode: 'tab' | 'window'): void {
    this.run(this.api.post<ApiMessage>('/api/chrome/open', { mode }), 'Navegador abierto.');
  }

  private snapshot(): Observable<void> {
    return forkJoin({
      state: this.api.get<LauncherState>('/api/state'),
      projects: this.api.get<Project[]>('/api/projects'),
      versions: this.api.get<MovaVersion[]>('/api/mova/versions'),
      logs: this.api.get<LauncherLog[]>('/api/logs')
    }).pipe(
      tap(({ state, projects, versions, logs }) => {
        this.state.set(state);
        this.projects.set(projects);
        this.versions.set(versions);
        this.logs.set(logs);
        this.selectedVersionTag.set(state.preferences.preferredTag ?? this.selectedVersionTag());
        if (state.shell.projectId) this.selectedProjectId.set(state.shell.projectId);
      }),
      map(() => undefined)
    );
  }

  private run(request: Observable<ApiMessage>, success: string): void {
    this.actionPending.set(true);
    request
      .pipe(
        finalize(() => this.actionPending.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.messages.add({ severity: 'success', summary: 'Operación enviada', detail: result.message ?? success });
          this.load();
        },
        error: (error: unknown) => this.notifyError(error)
      });
  }

  private receiveEvent(event: LauncherEvent): void {
    if (event.type === 'state' && this.isState(event.payload)) this.state.set(event.payload);
    const log = event.payload;
    if (event.type === 'log' && this.isLog(log)) {
      this.logs.update((logs) => [...logs, log].slice(-250));
    }
  }

  private toVersionOptions(versions: MovaVersion[]): VersionOption[] {
    return versions.map((version) => ({ label: version.tag, value: version.tag }));
  }

  private isState(value: unknown): value is LauncherState {
    return typeof value === 'object' && value !== null && 'session' in value && 'shell' in value && 'components' in value;
  }

  private isLog(value: unknown): value is LauncherLog {
    return typeof value === 'object' && value !== null && 'id' in value && 'message' in value;
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
