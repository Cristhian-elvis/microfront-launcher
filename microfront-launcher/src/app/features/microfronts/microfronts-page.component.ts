import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { PrimeTemplate } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { ApiService } from '../../core/api.service';
import { LauncherService } from '../../core/launcher.service';
import type { ApiMessage, Project } from '../../core/launcher.models';

type DirectoryItem = NonNullable<Project['microfrontends']>[number] & { project: Project };

@Component({
  selector: 'app-microfronts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './microfronts-page.component.html',
  styleUrls: ['./microfronts-page.component.css'],
  imports: [
    FormsModule,
    BreadcrumbModule,
    Button,
    InputText,
    IconFieldModule,
    InputIconModule,
    TableModule,
    PrimeTemplate,
    Tag,
  ],
})
export class MicrofrontsPageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly api = inject(ApiService);
  private readonly launcher = inject(LauncherService);
  private readonly route = inject(ActivatedRoute);
  readonly projects = this.bootstrap.projects.value;
  readonly state = this.bootstrap.state.value;
  readonly search = signal('');
  readonly pending = signal(false);
  readonly selectedId = signal(this.route.snapshot.queryParamMap.get('microfront') ?? '');
  readonly projectId = signal(this.route.snapshot.queryParamMap.get('project') ?? '');
  readonly items = computed<DirectoryItem[]>(() =>
    this.projects().flatMap((project) =>
      (project.microfrontends ?? []).map((microfront) => ({ ...microfront, project })),
    ),
  );
  readonly visibleItems = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.items().filter(
      (item) =>
        (!this.selectedId() || this.key(item) === this.selectedId()) &&
        (!this.projectId() || item.project.id === this.projectId()) &&
        (!query ||
          `${item.name} ${item.project.name} ${item.path ?? ''}`
            .toLocaleLowerCase()
            .includes(query)),
    );
  });
  readonly subtitle = computed(() => {
    const item = this.items().find((value) => this.key(value) === this.selectedId());
    const project = this.projects().find((value) => value.id === this.projectId());
    return item
      ? `Mostrando: ${item.name} · ${item.project.name}`
      : project
        ? `Microfronts de la shell: ${project.name}`
        : 'Todos los microfronts locales detectados, agrupados por shell.';
  });
  readonly hasFilter = computed(() => !!this.selectedId() || !!this.projectId());
  readonly breadCrumbItems: MenuItem[] = [{ label: 'Microfronts' }];

  key(item: DirectoryItem): string {
    return `${item.project.id}:${item.id}`;
  }
  isFavorite(item: DirectoryItem): boolean {
    return (this.state()?.preferences.favoriteMicrofrontIds ?? []).includes(this.key(item));
  }
  clearSelection(): void {
    this.selectedId.set('');
    this.projectId.set('');
  }
  toggleFavorite(item: DirectoryItem): void {
    const state = this.state();
    if (!state) return;
    const key = this.key(item);
    const previous = state.preferences.favoriteMicrofrontIds ?? [];
    const favoriteMicrofrontIds = previous.includes(key)
      ? previous.filter((id) => id !== key)
      : [...previous, key];
    this.pending.set(true);
    this.launcher
      .savePreferences({ favoriteMicrofrontIds })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () =>
          this.state.set({
            ...state,
            preferences: { ...state.preferences, favoriteMicrofrontIds },
          }),
      });
  }
  run(url: string, item: DirectoryItem): void {
    this.pending.set(true);
    this.api
      .post<ApiMessage>(url, { projectId: item.project.id, microfrontendId: item.id })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe();
  }
}
