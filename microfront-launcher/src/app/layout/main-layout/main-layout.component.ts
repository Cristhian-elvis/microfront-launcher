import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { ProcessConsoleComponent } from '../../shared/components/process-console/process-console.component';
import { ThemeService } from '../../shared/services/theme.service';
import { LauncherEventsService } from '../../core/launcher-events.service';
import type { LauncherConfig, LauncherState, Project } from '../../core/launcher.models';
import { ApiService } from '../../core/api.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  imports: [
    Button,
    ButtonDirective,
    Dialog,
    ProcessConsoleComponent,
    SidebarComponent,
    RouterOutlet,
  ],
})
export class MainLayoutComponent {
  protected readonly bootstrap = inject(AppBootstrapService);
  protected readonly theme = inject(ThemeService);
  protected readonly consoleVisible = signal(false);
  protected readonly settingsVisible = signal(false);
  protected readonly settings = signal<LauncherConfig>({});
  protected readonly collapsed = signal(false);
  protected readonly projects = this.bootstrap.projects.value;
  protected readonly state = this.bootstrap.state.value;
  protected readonly favoriteShells = computed(() => {
    const ids = new Set(this.state()?.preferences.favoriteShellIds ?? []);
    return this.projects().filter((project) => ids.has(project.id));
  });
  protected readonly favoriteMicrofronts = computed(() => {
    const ids = new Set(this.state()?.preferences.favoriteMicrofrontIds ?? []);
    return this.projects().flatMap((project) => (project.microfrontends ?? [])
      .filter((microfront) => ids.has(this.microfrontKey(project, microfront)))
      .map((microfront) => ({ project, microfront })));
  });
  protected readonly microfrontCount = computed(() => this.projects().reduce(
    (total, project) => total + (project.microfrontends?.length ?? 0), 0,
  ));
  protected readonly avatarLetters = computed(() => (this.state()?.preferences.avatarLetters ?? 'ML').slice(0, 2).toUpperCase());
  private readonly events = inject(LauncherEventsService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.events.events().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => { if (event.type === 'state' && this.isState(event.payload)) this.state.set(event.payload); },
      error: () => undefined,
    });
  }

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected openSettings(): void {
    this.api.get<LauncherConfig>('/api/config').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => { this.settings.set(config); this.settingsVisible.set(true); },
    });
  }

  protected updateSetting(section: 'rootPath' | 'mova' | 'shellDefaults' | 'chrome' | 'preferences', key: string, value: string): void {
    this.settings.update((config) => section === 'rootPath'
      ? { ...config, rootPath: value }
      : { ...config, [section]: { ...config[section], [key]: value } });
  }

  protected saveSettings(): void {
    this.api.put<unknown>('/api/config', this.settings()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.settingsVisible.set(false),
    });
  }

  protected openBrowser(professional = false): void {
    this.api.post<unknown>(professional ? '/api/chrome/open-professional' : '/api/chrome/open', { mode: 'tab' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected microfrontKey(project: Project, microfront: NonNullable<Project['microfrontends']>[number]): string {
    return `${project.id}:${microfront.id}`;
  }

  private isState(value: unknown): value is LauncherState {
    return typeof value === 'object' && value !== null && 'shell' in value && 'preferences' in value;
  }
}
