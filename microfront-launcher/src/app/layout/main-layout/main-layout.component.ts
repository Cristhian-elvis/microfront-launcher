import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { concatMap, finalize, of } from 'rxjs';
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
    InputText,
    Tooltip,
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
  protected readonly settingsError = signal<string | null>(null);
  protected readonly settingsSaving = signal(false);
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
  private initialAvatarLetters = 'ML';

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
      next: (config) => {
        const avatarLetters = this.state()?.preferences.avatarLetters ?? 'ML';
        this.initialAvatarLetters = avatarLetters;
        this.settings.set({
          ...config,
          preferences: { ...config.preferences, ...this.state()?.preferences, avatarLetters },
        });
        this.settingsError.set(null);
        this.settingsVisible.set(true);
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudo cargar la configuración.'),
    });
  }

  protected updateSetting(section: 'rootPath' | 'mova' | 'shellDefaults' | 'chrome' | 'preferences', key: string, value: string): void {
    this.settings.update((config) => section === 'rootPath'
      ? { ...config, rootPath: value }
      : { ...config, [section]: { ...config[section], [key]: value } });
  }

  protected updateAvatarLetters(value: string): void {
    this.updateSetting(
      'preferences',
      'avatarLetters',
      value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
    );
  }

  protected saveSettings(): void {
    const settings = this.settings();
    const avatarLetters = settings.preferences?.avatarLetters ?? 'ML';
    this.settingsError.set(null);
    this.settingsSaving.set(true);

    this.api.put<unknown>('/api/config', settings).pipe(
      concatMap(() => avatarLetters !== this.initialAvatarLetters
        ? this.api.put<unknown>('/api/mova/preferences', { avatarLetters })
        : of(null)),
      finalize(() => this.settingsSaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.settingsVisible.set(false);
        this.bootstrap.state.reload();
        this.bootstrap.projects.reload();
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudieron guardar los cambios.'),
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
