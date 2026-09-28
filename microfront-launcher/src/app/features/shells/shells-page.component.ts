import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MenuItem, MessageService, PrimeTemplate } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import type { LauncherState, Project } from '../../core/launcher.models';
import type { LauncherEvent } from '../../core/launcher-events.service';
import { LauncherEventsService } from '../../core/launcher-events.service';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { LauncherService } from '../../core/launcher.service';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { BreadcrumbModule } from 'primeng/breadcrumb';

@Component({
  selector: 'app-shells-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shells-page.component.html',
  styleUrls: ['./shells-page.component.css'],
  imports: [FormsModule, InputText, Button, TableModule, PrimeTemplate, Tag, IconFieldModule, InputIconModule, BreadcrumbModule],
})
export class ShellsPageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly launcher = inject(LauncherService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly projects = this.bootstrap.projects.value;
  readonly state = this.bootstrap.state.value;
  filter = '';
  pending = false;

  breadCrumbItems: MenuItem[] = [
    { label: 'Shells' }
  ];

  constructor() {
    this.events
      .events()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.receiveEvent(event),
        error: () => undefined,
      });
  }

  get filteredProjects(): Project[] {
    const query = this.filter.trim().toLocaleLowerCase();
    if (!query) return this.projects();
    return this.projects().filter((project) => {
      const microfronts = project.microfrontends?.map((item) => item.name).join(' ') ?? '';
      return `${project.name} ${project.configFolder ?? ''} ${microfronts}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }

  isFavorite(project: Project): boolean {
    return this.state()?.preferences.favoriteShellIds?.includes(project.id) ?? false;
  }

  status(project: Project): 'active' | 'starting' | 'stopped' {
    const state = this.state();
    if (
      state?.execution?.status === 'running' &&
      state.execution.kind === 'start' &&
      state.execution.projectId === project.id
    )
      return 'starting';
    if (state?.shell.status === 'running' && state.shell.projectId === project.id) return 'active';
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

  refreshProjects(): void {
    this.pending = true;
    this.launcher
      .refreshProjects()
      .pipe(
        finalize(() => (this.pending = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (projects) => this.projects.set(projects),
        error: (error: unknown) => this.notifyError(error),
      });
  }

  toggleFavorite(project: Project): void {
    const currentState = this.state();
    if (!currentState) return;
    const previous = currentState.preferences.favoriteShellIds ?? [];
    const favoriteShellIds = previous.includes(project.id)
      ? previous.filter((id) => id !== project.id)
      : [...previous, project.id];
    this.pending = true;
    this.launcher
      .saveFavoriteShells(favoriteShellIds)
      .pipe(
        finalize(() => (this.pending = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.state.set({
            ...currentState,
            preferences: { ...currentState.preferences, favoriteShellIds },
          });
        },
        error: (error: unknown) => this.notifyError(error),
      });
  }

  openDetail(project: Project): void {
    void this.router.navigate(['/shells', project.id]);
  }

  private receiveEvent(event: LauncherEvent): void {
    if (event.type === 'state' && this.isState(event.payload)) this.state.set(event.payload);
  }

  private isState(value: unknown): value is LauncherState {
    return (
      typeof value === 'object' && value !== null && 'shell' in value && 'preferences' in value
    );
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo completar la operación.',
    });
  }
}
