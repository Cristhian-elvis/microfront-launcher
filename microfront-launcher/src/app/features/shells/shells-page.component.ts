import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { Subscription, forkJoin } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ApiMessage, LauncherState, Project } from '../../core/launcher.models';
import { LauncherEvent, LauncherEventsService } from '../../core/launcher-events.service';
import { FormsModule } from '@angular/forms';
import { Bind } from 'primeng/bind';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { NgIf } from '@angular/common';
import { ProgressSpinner } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';

@Component({
    selector: 'app-shells-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shells-page.component.html',
    styleUrls: ['./shells-page.component.css'],
    imports: [FormsModule, Bind, InputText, Button, NgIf, ProgressSpinner, TableModule, PrimeTemplate, Tag]
})
export class ShellsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);

  projects: Project[] = [];
  state: LauncherState | null = null;
  filter = '';
  loading = true;
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

  get filteredProjects(): Project[] {
    const query = this.filter.trim().toLocaleLowerCase();
    if (!query) return this.projects;
    return this.projects.filter((project) => {
      const microfronts = project.microfrontends?.map((item) => item.name).join(' ') ?? '';
      return `${project.name} ${project.configFolder ?? ''} ${microfronts}`.toLocaleLowerCase().includes(query);
    });
  }

  isFavorite(project: Project): boolean {
    return this.state?.preferences.favoriteShellIds?.includes(project.id) ?? false;
  }

  status(project: Project): 'active' | 'starting' | 'stopped' {
    if (this.state?.execution?.status === 'running' && this.state.execution.kind === 'start' && this.state.execution.projectId === project.id) return 'starting';
    if (this.state?.shell.status === 'running' && this.state.shell.projectId === project.id) return 'active';
    return 'stopped';
  }

  statusLabel(project: Project): string {
    const status = this.status(project);
    return status === 'active' ? 'Activa' : status === 'starting' ? 'Iniciando' : 'Detenida';
  }

  projectDisplayName(name: string | null | undefined): string {
    const value = String(name ?? '');
    const match = /^([a-z0-9]{4})_webapp_/i.exec(value);
    return ((match?.[1] ?? value) || 'Ninguna').toUpperCase();
  }

  load(force = false): void {
    this.loading = true;
    const projects = force ? this.api.post<Project[]>('/api/projects/refresh') : this.api.get<Project[]>('/api/projects');
    this.subscriptions.add(forkJoin({ projects, state: this.api.get<LauncherState>('/api/state') }).pipe(
      tap(({ projects: nextProjects, state }) => {
        this.projects = nextProjects;
        this.state = state;
      }),
      finalize(() => this.loading = false)
    ).subscribe({ error: (error: unknown) => this.notifyError(error) }));
  }

  toggleFavorite(project: Project): void {
    if (!this.state) return;
    const currentState = this.state;
    const previous = currentState.preferences.favoriteShellIds ?? [];
    const favoriteShellIds = previous.includes(project.id)
      ? previous.filter((id) => id !== project.id)
      : [...previous, project.id];
    this.pending = true;
    this.subscriptions.add(this.api.put<ApiMessage>('/api/mova/preferences', { favoriteShellIds }).pipe(
      finalize(() => this.pending = false)
    ).subscribe({
      next: () => {
        this.state = { ...currentState, preferences: { ...currentState.preferences, favoriteShellIds } };
      },
      error: (error: unknown) => this.notifyError(error)
    }));
  }

  openDetail(project: Project): void {
    void this.router.navigate(['/shells', project.id]);
  }

  private receiveEvent(event: LauncherEvent): void {
    if (event.type === 'state' && this.isState(event.payload)) this.state = event.payload;
  }

  private isState(value: unknown): value is LauncherState {
    return typeof value === 'object' && value !== null && 'shell' in value && 'preferences' in value;
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo completar la operación.'
    });
  }
}
