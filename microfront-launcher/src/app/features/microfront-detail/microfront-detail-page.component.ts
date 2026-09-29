import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize, forkJoin, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { LauncherEventsService } from '../../core/launcher-events.service';
import type {
  ApiMessage,
  LauncherState,
  MicrofrontendOperation,
  Project,
} from '../../core/launcher.models';

type Microfront = NonNullable<Project['microfrontends']>[number];
type DetailAction = '' | 'build' | 'refresh' | 'branch';

@Component({
  selector: 'app-microfront-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './microfront-detail-page.component.html',
  styleUrls: ['./microfront-detail-page.component.css'],
  imports: [FormsModule, BreadcrumbModule, Button, Select, Tag, ProgressSpinner],
})
export class MicrofrontDetailPageComponent {
  

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly project = signal<Project | null>(null);
  readonly microfront = signal<Microfront | null>(null);
  readonly state = signal<LauncherState | null>(null);
  readonly loading = signal(true);
  readonly pending = signal(false);
  readonly shellId = signal('');
  readonly microfrontId = signal('');
  readonly action = signal<DetailAction>('');
  readonly branch = signal('');
  readonly actionOptions = computed(() => {
    const microfront = this.microfront();
    return [
      { label: 'Compilar', value: 'build' },
      { label: 'Sincronizar', value: 'refresh' },
      ...(microfront?.branches?.length ? [{ label: 'Cambiar rama', value: 'branch' }] : []),
    ];
  });
  readonly breadCrumbItems = computed<MenuItem[]>(() => [
    { label: 'Shells', routerLink: '/shells' },
    { label: this.project()?.name ?? 'Shell', routerLink: ['/shells', this.shellId()] },
    { label: this.microfront()?.name ?? 'Microfront' },
  ]);
  readonly operation = computed<MicrofrontendOperation | undefined>(() => {
    const microfront = this.microfront();
    if (!microfront) return undefined;
    const ops = this.state()?.microfrontendOperations ?? {};
    return [ops[`build:${microfront.id}`], ops[`branch:${microfront.id}`]]
      .filter((item): item is MicrofrontendOperation => !!item)
      .sort((a, b) => Date.parse(b.startedAt ?? '') - Date.parse(a.startedAt ?? ''))[0];
  });
  readonly busy = computed(() => this.pending() || this.operation()?.status === 'running');
  constructor() {
    this.route.paramMap
      .pipe(
        tap((params) => {
          this.shellId.set(params.get('shellId') ?? '');
          this.microfrontId.set(params.get('microfrontId') ?? '');
        }),
        switchMap(() => this.snapshot()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: (error: unknown) => this.fail(error) });
    this.events
      .events()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === 'state' && this.isState(event.payload)) this.state.set(event.payload);
        },
        error: () => undefined,
      });
  }
  selectAction(action: DetailAction): void {
    this.action.set(action);
    this.branch.set('');
  }
  apply(): void {
    const action = this.action();
    if (action === 'build') this.run('/api/microfrontends/build');
    else if (action === 'refresh') this.refresh();
    else if (action === 'branch' && this.branch())
      this.run('/api/microfrontends/branch', { branch: this.branch() });
  }
  run(path: string, body: object = {}): void {
    const microfront = this.microfront();
    if (!microfront) return;
    this.pending.set(true);
    this.api
      .post<ApiMessage>(path, {
        projectId: this.shellId(),
        microfrontendId: microfront.id,
        ...body,
      })
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
          this.load();
        },
        error: (error: unknown) => this.fail(error),
      });
  }
  refresh(): void {
    this.pending.set(true);
    this.api
      .get<Project>(`/api/projects/${encodeURIComponent(this.shellId())}/refresh`)
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => this.setProject(project),
        error: (error: unknown) => this.fail(error),
      });
  }
  back(): void {
    void this.router.navigate(['/shells', this.shellId()]);
  }
  operationSeverity(): 'success' | 'warn' | 'danger' | 'secondary' {
    const status = this.operation()?.status;
    return status === 'running'
      ? 'warn'
      : status === 'success'
        ? 'success'
        : status === 'error'
          ? 'danger'
          : 'secondary';
  }
  private load(): void {
    this.snapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (error: unknown) => this.fail(error) });
  }
  private snapshot() {
    this.loading.set(true);
    return forkJoin({
      project: this.api.get<Project>(`/api/projects/${encodeURIComponent(this.shellId())}`),
      state: this.api.get<LauncherState>('/api/state'),
    }).pipe(
      tap(({ project, state }) => {
        this.setProject(project);
        this.state.set(state);
      }),
      finalize(() => this.loading.set(false)),
    );
  }
  private setProject(project: Project): void {
    this.project.set(project);
    this.microfront.set(
      project.microfrontends?.find((item) => item.id === this.microfrontId()) ?? null,
    );
  }
  private isState(value: unknown): value is LauncherState {
    return (
      typeof value === 'object' && value !== null && 'shell' in value && 'preferences' in value
    );
  }
  private fail(error: unknown): void {
    this.loading.set(false);
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'No se pudo cargar el microfront.',
    });
  }
}
