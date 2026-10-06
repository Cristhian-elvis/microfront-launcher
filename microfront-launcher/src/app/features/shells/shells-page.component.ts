import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService, PrimeTemplate } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import type { Project } from '../../core/launcher.models';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { MovaService } from '../../core/services/mova.service';
import { ProjectService } from '../../core/services/project.service';
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
  private readonly mova = inject(MovaService);
  private readonly projectsApi = inject(ProjectService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly projects = this.bootstrap.projects;
  readonly state = this.bootstrap.state;
  readonly preferences = this.bootstrap.preferences;
  filter = '';
  readonly pending = signal(false);

  breadCrumbItems: MenuItem[] = [
    { label: 'Shells' }
  ];

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
    return this.preferences().favoriteShellIds?.includes(project.id) ?? false;
  }

  status(project: Project): 'active' | 'starting' | 'stopped' {
    const state = this.state();
    if (state?.shell.status === 'running' && state.shell.projectId === project.id) return 'active';
    if (
      (state?.shell.status === 'preparing' || state?.shell.status === 'starting') &&
      state.shell.projectId === project.id
    ) return 'starting';
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
    this.pending.set(true);
    this.projectsApi
      .refreshAll()
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (projects) => this.projects.set(projects),
        error: (error: unknown) => this.notifyError(error),
      });
  }

  toggleFavorite(project: Project): void {
    const previous = this.preferences().favoriteShellIds ?? [];
    const favoriteShellIds = previous.includes(project.id)
      ? previous.filter((id) => id !== project.id)
      : [...previous, project.id];
    this.pending.set(true);
    this.mova
      .savePreferences({ favoriteShellIds })
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: unknown) => this.notifyError(error),
      });
  }

  openDetail(project: Project): void {
    void this.router.navigate(['/shells', project.id]);
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo completar la operación.',
    });
  }
}
