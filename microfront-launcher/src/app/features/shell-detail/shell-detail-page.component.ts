import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { Subscription, forkJoin } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { ApiMessage, LauncherState, Project } from '../../core/launcher.models';
import { LauncherEvent, LauncherEventsService } from '../../core/launcher-events.service';
import { NgIf } from '@angular/common';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
    selector: 'app-shell-detail-page', changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './shell-detail-page.component.html', styleUrls: ['./shell-detail-page.component.css'],
    imports: [NgIf, Bind, Button, TableModule, PrimeTemplate, Tag, ProgressSpinner]
})
export class ShellDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly events = inject(LauncherEventsService);
  private readonly messages = inject(MessageService);

  project: Project | null = null; state: LauncherState | null = null; loading = true; pending = false;
  private shellId = ''; private readonly subscriptions = new Subscription();
  ngOnInit(): void { this.subscriptions.add(this.route.paramMap.pipe(switchMap(params => { this.shellId = params.get('shellId') ?? ''; return this.snapshot(); })).subscribe({ error: error => this.fail(error) })); this.subscriptions.add(this.events.events().subscribe({ next: event => this.receive(event), error: () => undefined })); }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
  get active(): boolean { return this.state?.shell.projectId === this.project?.id && this.state?.shell.status === 'running'; }
  get operating(): boolean { return this.pending || (this.state?.execution?.status === 'running' && this.state.execution.projectId === this.project?.id); }
  get displayName(): string { const value = this.project?.name ?? ''; const match = /^([a-z0-9]{4})_webapp_/i.exec(value); return ((match?.[1] ?? value) || 'Ninguna').toUpperCase(); }
  refresh(): void { this.pending = true; this.subscriptions.add(this.api.get<Project>(`/api/projects/${encodeURIComponent(this.shellId)}/refresh`).pipe(finalize(() => this.pending = false)).subscribe({ next: project => this.project = project, error: error => this.fail(error) })); }
  action(url: string, body: object = {}): void { this.pending = true; this.subscriptions.add(this.api.post<ApiMessage>(url, body).pipe(finalize(() => this.pending = false)).subscribe({ next: result => { this.messages.add({ severity: 'success', summary: 'Operación enviada', detail: result.message ?? 'Operación iniciada.' }); this.load(); }, error: error => this.fail(error) })); }
  openMicrofront(id: string): void { void this.router.navigate(['/shells', this.shellId, id]); }
  viewVersions(): void { void this.router.navigate(['/shells', this.shellId, 'versions']); }
  back(): void { void this.router.navigate(['/shells']); }
  private load(): void { this.subscriptions.add(this.snapshot().subscribe({ error: error => this.fail(error) })); }
  private snapshot() { this.loading = true; return forkJoin({ project: this.api.get<Project>(`/api/projects/${encodeURIComponent(this.shellId)}`), state: this.api.get<LauncherState>('/api/state') }).pipe(tap(({ project, state }) => { this.project = project; this.state = state; }), finalize(() => this.loading = false)); }
  private receive(event: LauncherEvent): void { if (event.type === 'state' && typeof event.payload === 'object' && event.payload !== null && 'shell' in event.payload) this.state = event.payload as LauncherState; }
  private fail(error: unknown): void { this.loading = false; this.messages.add({ severity: 'error', summary: 'Error', detail: error instanceof Error ? error.message : 'No se pudo cargar la shell.' }); }
}
