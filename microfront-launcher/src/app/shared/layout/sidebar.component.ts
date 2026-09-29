import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Badge } from 'primeng/badge';
import { Button, ButtonDirective } from 'primeng/button';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import type { Project } from '../../core/launcher.models';

@Component({ selector: 'app-sidebar', changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './sidebar.component.html', styleUrl: './sidebar.component.css', imports: [RouterLink, RouterLinkActive, Button, ButtonDirective, Badge] })
export class SidebarComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  readonly settingsRequested = output<void>();
  readonly collapsed = signal(false);
  readonly projects = this.bootstrap.projects.value;
  readonly state = this.bootstrap.state.value;
  readonly favoriteShells = computed(() => { const ids = new Set(this.state()?.preferences.favoriteShellIds ?? []); return this.projects().filter((project) => ids.has(project.id)); });
  readonly favoriteMicrofronts = computed(() => { const ids = new Set(this.state()?.preferences.favoriteMicrofrontIds ?? []); return this.projects().flatMap((project) => (project.microfrontends ?? []).filter((microfront) => ids.has(this.microfrontKey(project, microfront))).map((microfront) => ({ project, microfront }))); });
  readonly microfrontCount = computed(() => this.projects().reduce((total, project) => total + (project.microfrontends?.length ?? 0), 0));
  toggle(): void { this.collapsed.update((value) => !value); }
  microfrontKey(project: Project, microfront: NonNullable<Project['microfrontends']>[number]): string { return `${project.id}:${microfront.id}`; }
}
