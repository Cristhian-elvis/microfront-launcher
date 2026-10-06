import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MessageService, PrimeTemplate } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import type {
  ApiMessage,
  MicrofrontendOperation,
  Project,
} from '../../core/launcher.models';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { MovaService } from '../../core/services/mova.service';
import { ProjectService } from '../../core/services/project.service';

type Microfront = NonNullable<Project['microfrontends']>[number];
type BulkAction = '' | 'build' | 'branch';

@Component({
  selector: 'app-shell-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-detail-page.component.html',
  styleUrls: ['./shell-detail-page.component.css'],
  imports: [
    BreadcrumbModule,
    Button,
    TableModule,
    PrimeTemplate,
    Tag,
    Select,
    FormsModule
  ],
})
export class ShellDetailPageComponent {
  readonly shellId = input<string>('');

  private readonly router = inject(Router);
  private readonly mova = inject(MovaService);
  private readonly projectsApi = inject(ProjectService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bootstrap = inject(AppBootstrapService);
  
  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly favoriteSaving = signal(false);
  readonly search = signal('');
  readonly selectedIds = signal<string[]>([]);
  readonly bulkAction = signal<BulkAction>('');
  readonly targetBranch = signal('');

  readonly state = this.bootstrap.state;
  readonly preferences = this.bootstrap.preferences;
  readonly infoBranches = this.projectsApi.getInfoBranchesByShellId(this.shellId);
  protected readonly projects = this.bootstrap.projects;
  
  readonly microfronts = computed(() => {
    const gitByMicrofrontId = new Map(
      this.infoBranches.value()?.microfrontends?.map((item) => [item.id, item]) ?? [],
    );
    return (this.project()?.microfrontends ?? []).map((microfront) => {
      const gitInfo = gitByMicrofrontId.get(microfront.id);
      return gitInfo
        ? { ...microfront, branch: gitInfo.branch, branches: gitInfo.branches ?? [] }
        : microfront;
    });
  });
  readonly visibleMicrofronts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return query
      ? this.microfronts().filter((item) =>
        `${item.name} ${item.path ?? ''} ${item.branch ?? ''}`
          .toLocaleLowerCase()
          .includes(query),
      )
      : this.microfronts();
  });
  
  readonly project = computed(() => {
    return this.projects().find((item) => item.id === this.shellId());
  });
  readonly selectedMicrofronts = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.microfronts().filter((item) => ids.has(item.id));
  });
  readonly allVisibleSelected = computed(() => {
    const visible = this.visibleMicrofronts();
    const ids = new Set(this.selectedIds());
    return visible.length > 0 && visible.every((item) => ids.has(item.id));
  });
  readonly commonBranches = computed(() => {
    const selected = this.selectedMicrofronts();
    return selected.length
      ? [...new Set(selected[0].branches ?? [])]
        .filter((branch) => selected.every((item) => item.branches?.includes(branch)))
        .sort()
      : [];
  });
  readonly hasBuildableSelection = computed(() =>
    this.selectedMicrofronts().some((item) => !!item.localBuildAvailable),
  );
  readonly operating = computed(() => {
    const state = this.state();
    const projectId = this.project()?.id;
    return this.pending() ||
      (state?.shell.status !== 'stopped' && state?.shell.projectId === projectId) ||
      (
        ['starting', 'building', 'stopping'].includes(state?.session.status ?? '') &&
        state?.session.projectId === projectId
      );
  });
  readonly active = computed(() => {
    const state = this.state();
    return state?.shell.status === 'running' && state.shell.projectId === this.project()?.id;
  });
  readonly displayName = computed(() => this.projectDisplayName(this.project()?.name));
  readonly favorite = computed(() => {
    const project = this.project();
    return !!project && (this.preferences().favoriteShellIds ?? []).includes(project.id);
  });
  readonly breadCrumbItems: MenuItem[] = [
    { label: 'Shells', routerLink: '/shells' },
    { label: 'Detalle de shell' },
  ];
  readonly bulkActionOptions = [
    { label: 'Compilar seleccionados', value: 'build' },
    { label: 'Cambiar a rama…', value: 'branch' },
  ];

  refresh(): void {
    this.pending.set(true);
    this.projectsApi
      .refresh(this.shellId())
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.infoBranches.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Git actualizado',
            detail: `Se actualizaron los repositorios de ${project.name}.`,
          });
        },
        error: (error: unknown) => this.fail(error),
      });
  }
  
  openWebapp(): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.openWebapp(project.id), false);
  }

  rebuild(): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.rebuildShell(project.id));
  }

  toggleFavorite(): void {
    const project = this.project();
    if (!project) return;
    const current = this.preferences().favoriteShellIds ?? [];
    const favoriteShellIds = current.includes(project.id)
      ? current.filter((id) => id !== project.id)
      : [...current, project.id];
    this.favoriteSaving.set(true);
    this.mova
      .savePreferences({ favoriteShellIds })
      .pipe(
        finalize(() => this.favoriteSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: unknown) => this.fail(error),
      });
  }

  toggleMicrofront(id: string): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  setSelectedMicrofronts(microfronts: Microfront[]): void {
    this.selectedIds.set(microfronts.map((microfront) => microfront.id));
  }

  toggleVisible(): void {
    const visibleIds = new Set(this.visibleMicrofronts().map((item) => item.id));
    this.selectedIds.update((ids) =>
      this.allVisibleSelected()
        ? ids.filter((id) => !visibleIds.has(id))
        : [...new Set([...ids, ...visibleIds])],
    );
  }

  chooseBulkAction(value: string): void {
    this.bulkAction.set(value === 'build' || value === 'branch' ? value : '');
    this.targetBranch.set('');
  }

  applyBulkAction(): void {
    const project = this.project();
    const selected = this.selectedMicrofronts();
    if (!project || !selected.length) return;
    if (this.bulkAction() === 'build') {
      const ids = selected.filter((item) => item.localBuildAvailable).map((item) => item.id);
      if (ids.length)
        this.run(this.projectsApi.buildMicrofronts(project.id, ids));
    }
    if (this.bulkAction() === 'branch' && this.targetBranch())
      this.run(this.projectsApi.changeMicrofrontBranches(
        project.id,
        selected.map((item) => item.id),
        this.targetBranch(),
      ));
  }

  operationFor(microfront: Microfront): MicrofrontendOperation | undefined {
    const operations = this.state()?.microfrontendOperations ?? {};
    return [operations[`branch:${microfront.id}`], operations[`build:${microfront.id}`]]
      .filter((operation): operation is MicrofrontendOperation => !!operation)
      .sort(
        (left, right) => Date.parse(right.startedAt ?? '') - Date.parse(left.startedAt ?? ''),
      )[0];
  }

  operationLabel(microfront: Microfront): string {
    const operation = this.operationFor(microfront);
    return !operation || operation.status === 'idle'
      ? 'Sin proceso activo'
      : operation.status === 'error'
        ? (operation.error ?? 'Error')
        : (operation.message ?? 'En curso');
  }

  operationClass(microfront: Microfront): string {
    const status = this.operationFor(microfront)?.status;
    return status === 'running'
      ? 'is-running'
      : status === 'success'
        ? 'is-success'
        : status === 'error'
          ? 'is-error'
          : 'is-idle';
  }

  operationSeverity(microfront: Microfront): 'success' | 'warn' | 'danger' | 'secondary' {
    const status = this.operationFor(microfront)?.status;
    return status === 'running'
      ? 'warn'
      : status === 'success'
        ? 'success'
        : status === 'error'
          ? 'danger'
          : 'secondary';
  }

  branchChanging(microfront: Microfront): boolean {
    return this.state()?.microfrontendOperations?.[`branch:${microfront.id}`]?.status === 'running';
  }

  buildRunning(microfront: Microfront): boolean {
    return this.state()?.microfrontendOperations?.[`build:${microfront.id}`]?.status === 'running';
  }

  openMicrofrontFolder(microfront: Microfront): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.openMicrofrontFolder(project.id, microfront.id), false);
  }

  openMicrofrontInVsCode(microfront: Microfront): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.openMicrofrontInVsCode(project.id, microfront.id), false);
  }

  buildMicrofront(microfront: Microfront): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.buildMicrofront(project.id, microfront.id));
  }

  back(): void {
    void this.router.navigate(['/shells']);
  }

  private run(request: Observable<ApiMessage>, reload = true): void {
    this.pending.set(true);
    request
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.messages.add({
            severity: 'success',
            summary: 'Operación enviada',
            detail: result.message ?? 'Operación iniciada.',
          });
          void reload;
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private projectDisplayName(name: string | null | undefined): string {
    const value = String(name ?? '');
    const match = /^([a-z0-9]{4})_webapp_/i.exec(value);
    return ((match?.[1] ?? value) || 'Ninguna').toUpperCase();
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo cargar la shell.',
    });
  }
}
