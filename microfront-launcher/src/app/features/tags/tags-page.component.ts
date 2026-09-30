import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { MessageService, PrimeTemplate } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { finalize, tap } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import type { ApiMessage, LauncherState, MovaVersion } from '../../core/launcher.models';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { BreadcrumbModule } from 'primeng/breadcrumb';

@Component({
    selector: 'app-tags-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tags-page.component.html',
    styleUrls: ['./tags-page.component.css'],
    imports: [Button, TableModule, PrimeTemplate, Tag, BreadcrumbModule]
})
export class TagsPageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly versions = this.bootstrap.versions.value;

  state: LauncherState | null = this.bootstrap.state.value() ?? null;
  refreshing = false;
  pending = false;

  breadCrumbItems: MenuItem[] = [
    { label: 'Tags de MOVA' }
  ];

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
    /*forkJoin({
      versions: this.api.get<MovaVersion[]>('/api/mova/versions'),
      state: this.api.get<LauncherState>('/api/state')
    }).pipe(
      tap(({ versions, state }) => {
        this.versions = versions;
        this.state = state;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({ error: (error: unknown) => this.notifyError(error) })*/
  }

  refreshTags(): void {
    this.refreshing = true;
    this.api.post<ApiMessage>('/api/mova/tags/refresh').pipe(
      finalize(() => this.refreshing = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.messages.add({ severity: 'success', summary: 'Tags actualizados', detail: result.message ?? 'Tags actualizados.' });
        this.load();
      },
      error: (error: unknown) => this.notifyError(error)
    })
  }

  build(version: MovaVersion): void {
    this.pending = true;
    this.api.post<ApiMessage>('/api/mova/build', { tag: version.tag }).pipe(
      finalize(() => this.pending = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.messages.add({ severity: 'success', summary: 'Compilación iniciada', detail: result.message ?? `Compilación de ${version.tag} iniciada.` });
        this.load();
      },
      error: (error: unknown) => this.notifyError(error)
    })
  }

  private isBuilding(version: MovaVersion): boolean {
    return this.state?.build?.tag === version.tag && this.state.build.status === 'building';
  }

  private isBuildError(version: MovaVersion): boolean {
    return this.state?.build?.tag === version.tag && this.state.build.status === 'error';
  }

  private buildStepLabel(): string {
    return this.state?.build?.message || 'Preparando compilación';
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo completar la operación.'
    });
  }
}
