import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MessageService, PrimeTemplate, type MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button, ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { finalize, Observable } from 'rxjs';
import type {
  ApiMessage,
  Microfrontend,
  MicrofrontendBuildOptions,
  MicrofrontendOperation,
  Project,
  ShellPrepareOptions,
} from '../../core/launcher.models';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { MovaService } from '../../core/services/mova.service';
import { ProjectService } from '../../core/services/project.service';
import { AppIconComponent } from '../../shared/components/app-icon/app-icon.component';
import { BuildOptionsDialogComponent } from '../../shared/components/build-options-dialog/build-options-dialog.component';
import { MicrofrontTableSkeletonComponent } from './components/microfront-table-skeleton.component';
import { ShellPrepareOptionsDialogComponent } from './components/shell-prepare-options-dialog.component';
import { ShellSummarySkeletonComponent } from './components/shell-summary-skeleton.component';

type Microfront = Microfrontend;

@Component({
  selector: 'app-shell-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-detail-page.component.html',
  styleUrls: ['./shell-detail-page.component.css'],
  imports: [
    BreadcrumbModule,
    Button,
    AppIconComponent,
    TableModule,
    PrimeTemplate,
    Tag,
    Tooltip,
    BuildOptionsDialogComponent,
    MicrofrontTableSkeletonComponent,
    ShellPrepareOptionsDialogComponent,
    ShellSummarySkeletonComponent,
    ButtonDirective
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

  readonly buildOptionsVisible = signal(false);
  readonly shellPrepareOptionsVisible = signal(false);

  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly favoriteSaving = signal(false);
  readonly search = signal('');
  readonly selectedIds = signal<string[]>([]);

  readonly state = this.bootstrap.state;
  readonly preferences = this.bootstrap.preferences;
  protected readonly projects = this.bootstrap.projects;

  readonly isShellAvailable = computed(() => !!this.projectDetailsRequest.value());
  readonly microfrontsRequest = this.projectsApi.getMicrofrontendsByShellId(
    this.shellId,
    this.isShellAvailable,
  );
  readonly microfronts = computed(() => this.microfrontsRequest.value() ?? []);
  readonly visibleMicrofronts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return query
      ? this.microfronts().filter((item) =>
        `${item.name} ${item.path ?? ''} ${item.git?.name ?? ''}`
          .toLocaleLowerCase()
          .includes(query),
      )
      : this.microfronts();
  });

  readonly project = computed(() => {
    return this.projects().find((item) => item.id === this.shellId());
  });
  readonly projectDetailsRequest = this.projectsApi.getProjectDetailsByShellId(this.shellId);
  readonly detailProject = computed(() => this.projectDetailsRequest.value());
  readonly isDetailPending = computed(() =>
    !this.project() && !this.projectDetailsRequest.value() && !this.projectDetailsRequest.error(),
  );
  readonly isShellDetailPending = computed(() =>
    !this.projectDetailsRequest.hasValue() || this.projectDetailsRequest.isLoading(),
  );
  readonly isMicrofrontsPending = computed(() =>
    !this.microfrontsRequest.value() && !this.microfrontsRequest.error(),
  );
  readonly isDetailReady = computed(() =>
    this.projectDetailsRequest.hasValue()
    && this.microfrontsRequest.hasValue()
    && !this.projectDetailsRequest.isLoading()
    && !this.microfrontsRequest.isLoading(),
  );
  private readonly missingProjectHandled = signal(false);

  constructor() {
    effect(() => {
      const error = this.projectDetailsRequest.error() ?? this.microfrontsRequest.error();
      if (!(error instanceof HttpErrorResponse) || error.status !== 404 || this.missingProjectHandled()) return;

      this.missingProjectHandled.set(true);
      this.refreshProjectsAndReturnToList();
    });
  }

  readonly selectedMicrofronts = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.microfronts().filter((item) => ids.has(item.id));
  });
  readonly allVisibleSelected = computed(() => {
    const visible = this.visibleMicrofronts();
    const ids = new Set(this.selectedIds());
    return visible.length > 0 && visible.every((item) => ids.has(item.id));
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

   openWebapp(): void {
    this.openProjectTarget('vscode', 'webapp');
  }

  openWebappFolder(): void {
    this.openProjectTarget('folder', 'webapp');
  }

  openWebappTerminal(): void {
    this.openProjectTarget('terminal', 'webapp');
  }

  openShell(): void {
    this.openProjectTarget('vscode', 'shell');
  }

  openShellFolder(): void {
    this.openProjectTarget('folder', 'shell');
  }

  openShellTerminal(): void {
    this.openProjectTarget('terminal', 'shell');
  }

  private openProjectTarget(action: 'folder' | 'terminal' | 'vscode', type: 'shell' | 'webapp'): void {
    const project = this.project();
    if (!project) return;

    this.run(this.projectsApi.openProjectTarget(project.id, action, { type }), false);
  }

  prepareServer(): void {
    this.shellPrepareOptionsVisible.set(true);
  }

  closeShellPrepareOptions(): void {
    this.shellPrepareOptionsVisible.set(false);
  }

  onShellPrepareOptionsConfirmed(options: ShellPrepareOptions): void {
    this.closeShellPrepareOptions();
    const project = this.project();
    if (project) this.run(this.projectsApi.prepareShellServer(project.id, options));
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

  openBuildOptions(): void {
    this.buildOptionsVisible.set(true);
  }

  closeBuildOptions(): void {
    this.buildOptionsVisible.set(false);
  }

  onBuildOptionsConfirmed(options: MicrofrontendBuildOptions): void {
    this.closeBuildOptions();
    this.buildSelected(options);
  }

  private refreshProjectsAndReturnToList(): void {
    this.projectsApi
      .refreshAll()
      .pipe(
        finalize(() => {
          this.messages.add({
            severity: 'warn',
            summary: 'Shell no disponible',
            detail: 'La shell ya no existe o fue movida. Se actualizó el listado.',
          });
          void this.router.navigate(['/shells']);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (projects) => this.projects.set(projects),
        error: () => undefined,
      });
  }

  private buildableSelectedIds(): string[] {
    return this.selectedMicrofronts()
      .filter((item) => item.localBuildAvailable)
      .map((item) => item.id);
  }

  private buildSelected(options?: MicrofrontendBuildOptions): void {
    const project = this.project();
    const ids = this.buildableSelectedIds();
    if (project && ids.length) this.run(this.projectsApi.checkMicrofrontends(project.id, ids, options));
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
    if (project) this.run(this.projectsApi.openProjectTarget(project.id, 'vscode', { type: 'microfrontend', id: microfront.id }), false);
  }

  openMicrofrontTerminal(microfront: Microfront): void {
    const project = this.project();
    if (project) this.run(this.projectsApi.openProjectTarget(project.id, 'terminal', { type: 'microfrontend', id: microfront.id }), false);
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
