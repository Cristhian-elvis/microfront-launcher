import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { Subscription, forkJoin } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { ApiMessage, LauncherState, MovaVersion } from '../../core/launcher.models';
import { LauncherEvent, LauncherEventsService } from '../../core/launcher-events.service';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { NgIf } from '@angular/common';
import { ProgressSpinner } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';

@Component({
    selector: 'app-tags-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tags-page.component.html',
    styleUrls: ['./tags-page.component.css'],
    imports: [Bind, Button, NgIf, ProgressSpinner, TableModule, PrimeTemplate, Tag]
})
export class TagsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);

  versions: MovaVersion[] = [];
  state: LauncherState | null = null;
  loading = true;
  refreshing = false;
  pending = false;
  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.load();
    this.subscriptions.add(this.events.events().subscribe({
      next: (event) => this.receiveEvent(event),
      error: () => undefined
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get preferredTag(): string {
    return this.state?.preferences.preferredTag ?? '';
  }

  buildLabel(version: MovaVersion): string {
    return version.cached ? 'Recompilar' : 'Compilar';
  }

  compilationSeverity(version: MovaVersion): 'success' | 'danger' | 'warn' | 'info' {
    if (this.isBuilding(version)) return 'warn';
    if (this.isBuildError(version)) return 'danger';
    return version.cached ? 'success' : 'info';
  }

  compilationLabel(version: MovaVersion): string {
    if (this.isBuilding(version)) return 'Compilando';
    if (this.isBuildError(version)) return 'Error';
    return version.cached ? 'Compilado' : 'Sin compilar';
  }

  processLabel(version: MovaVersion): string {
    if (this.isBuilding(version)) return this.buildStepLabel();
    if (this.isBuildError(version)) return this.state?.build?.message ?? 'La compilación falló';
    return '—';
  }

  formatDate(value: string | undefined): string {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  load(): void {
    this.loading = true;
    this.subscriptions.add(forkJoin({
      versions: this.api.get<MovaVersion[]>('/api/mova/versions'),
      state: this.api.get<LauncherState>('/api/state')
    }).pipe(
      tap(({ versions, state }) => {
        this.versions = versions;
        this.state = state;
      }),
      finalize(() => this.loading = false)
    ).subscribe({ error: (error: unknown) => this.notifyError(error) }));
  }

  refreshTags(): void {
    this.refreshing = true;
    this.subscriptions.add(this.api.post<ApiMessage>('/api/mova/tags/refresh').pipe(
      finalize(() => this.refreshing = false)
    ).subscribe({
      next: (result) => {
        this.messages.add({ severity: 'success', summary: 'Tags actualizados', detail: result.message ?? 'Tags actualizados.' });
        this.load();
      },
      error: (error: unknown) => this.notifyError(error)
    }));
  }

  build(version: MovaVersion): void {
    this.pending = true;
    this.subscriptions.add(this.api.post<ApiMessage>('/api/mova/build', { tag: version.tag }).pipe(
      finalize(() => this.pending = false)
    ).subscribe({
      next: (result) => {
        this.messages.add({ severity: 'success', summary: 'Compilación iniciada', detail: result.message ?? `Compilación de ${version.tag} iniciada.` });
        this.load();
      },
      error: (error: unknown) => this.notifyError(error)
    }));
  }

  private isBuilding(version: MovaVersion): boolean {
    return this.state?.build?.tag === version.tag && this.state.build.status === 'building';
  }

  private isBuildError(version: MovaVersion): boolean {
    return this.state?.build?.tag === version.tag && this.state.build.status === 'error';
  }

  private buildStepLabel(): string {
    const key = this.state?.processes?.find((process) => process.key.startsWith('build:'))?.key;
    const steps: Record<string, string> = {
      'build:clone': 'Clonando repositorio',
      'build:checkout': 'Obteniendo tag',
      'build:install': 'Instalando dependencias',
      'build:compile': 'Compilando librería'
    };
    return (key && steps[key]) || this.state?.build?.message || 'Preparando compilación';
  }

  private receiveEvent(event: LauncherEvent): void {
    if (event.type === 'state' && this.isState(event.payload)) this.state = event.payload;
  }

  private isState(value: unknown): value is LauncherState {
    return typeof value === 'object' && value !== null && 'preferences' in value && 'build' in value;
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo completar la operación.'
    });
  }
}
