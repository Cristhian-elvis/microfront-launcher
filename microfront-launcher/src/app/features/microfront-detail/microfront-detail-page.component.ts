import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ApiMessage, Project } from '../../core/launcher.models';
import { NgIf } from '@angular/common';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ProgressSpinner } from 'primeng/progressspinner';
@Component({
    selector: 'app-microfront-detail', changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './microfront-detail-page.component.html', styleUrls: ['./microfront-detail-page.component.css'],
    imports: [NgIf, Bind, Button, Select, FormsModule, ProgressSpinner]
})
export class MicrofrontDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private messages = inject(MessageService);

  project: Project | null = null; microfront: NonNullable<Project['microfrontends']>[number] | null = null; loading = true; pending = false; actionName = ''; branch = ''; shellId = '';
  ngOnInit(): void { this.shellId = this.route.snapshot.paramMap.get('shellId') ?? ''; const id = this.route.snapshot.paramMap.get('microfrontId') ?? ''; forkJoin({ project: this.api.get<Project>(`/api/projects/${encodeURIComponent(this.shellId)}`) }).subscribe({ next: ({ project }) => { this.project = project; this.microfront = project.microfrontends?.find(item => item.id === id) ?? null; this.loading = false; }, error: () => this.loading = false }); }
  run(path: string, body: object = {}): void { if (!this.microfront) return; this.pending = true; this.api.post<ApiMessage>(path, { projectId: this.shellId, microfrontendId: this.microfront.id, ...body }).subscribe({ next: result => { this.pending = false; this.messages.add({ severity: 'success', summary: 'Operación enviada', detail: result.message ?? 'Operación iniciada.' }); }, error: () => this.pending = false }); }
  apply(): void { if (this.actionName === 'build') this.run('/api/microfrontends/build'); else if (this.actionName === 'refresh') this.run('/api/projects/' + encodeURIComponent(this.shellId) + '/refresh'); else if (this.actionName === 'branch' && this.branch) this.run('/api/microfrontends/branch', { branch: this.branch }); }
  back(): void { void this.router.navigate(['/shells', this.shellId]); }
}
