import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import type { MenuItem } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { SplitButton } from 'primeng/splitbutton';
import { concatMap, finalize, of } from 'rxjs';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { ProcessConsoleComponent } from '../../shared/components/process-console/process-console.component';
import { AppIconComponent } from '../../shared/components/app-icon/app-icon.component';
import { ThemeService } from '../../shared/services/theme.service';
import { LauncherEventsService } from '../../core/launcher-events.service';
import type { LauncherConfig, LauncherLog, LauncherPreferences, LauncherState, Project } from '../../core/launcher.models';
import { ApiService } from '../../core/api.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

type BrowserMode = 'chrome' | 'chrome-insecure' | 'edge' | 'edge-insecure';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  imports: [
    Button,
    ButtonDirective,
    SplitButton,
    Dialog,
    InputText,
    Tooltip,
    AppIconComponent,
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
  protected readonly settingsReadOnly = computed(() => {
    const currentState = this.state();
    return ['starting', 'building', 'stopping'].includes(currentState?.session?.status ?? '')
      || currentState?.shell?.status !== 'stopped';
  });
  protected readonly publishedComponentsConfigured = computed(() => {
    const mova = this.settings().mova;
    return Boolean(
      mova?.cdnHost?.trim()
      && mova?.stencilComponentsFolderName?.trim(),
    );
  });
  protected readonly collapsed = signal(false);
  protected readonly projects = this.bootstrap.projects;
  protected readonly state = this.bootstrap.state;
  protected readonly preferences = this.bootstrap.preferences;
  protected readonly favoriteShells = computed(() => {
    const ids = new Set(this.preferences().favoriteShellIds ?? []);
    return this.projects().filter((project) => ids.has(project.id));
  });
  protected readonly favoriteMicrofronts = computed(() => {
    const ids = new Set(this.preferences().favoriteMicrofrontIds ?? []);
    return this.projects().flatMap((project) => (project.microfrontends ?? [])
      .filter((microfront) => ids.has(this.microfrontKey(project, microfront)))
      .map((microfront) => ({ project, microfront })));
  });
  protected readonly microfrontCount = computed(() => this.projects().reduce(
    (total, project) => total + (project.microfrontends?.length ?? 0), 0,
  ));
  protected readonly avatarLetters = computed(() => (this.preferences().avatarLetters ?? 'ML').slice(0, 2).toUpperCase());
  private readonly events = inject(LauncherEventsService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly browserActions: MenuItem[] = [
    { label: 'Chrome', icon: 'pi pi-chrome', command: () => this.openBrowser('chrome') },
    { label: 'Chrome sin seguridad', icon: 'pi pi-chrome', command: () => this.openBrowser('chrome-insecure') },
    { label: 'Edge', icon: 'pi pi-desktop', command: () => this.openBrowser('edge') },
    { label: 'Edge sin seguridad', icon: 'pi pi-desktop', command: () => this.openBrowser('edge-insecure') },
  ];
  private initialAvatarLetters = 'ML';

  constructor() {
    this.events.events().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === 'runtime' && this.isState(event.payload)) this.bootstrap.setRuntime(event.payload);
        if (event.type === 'preferences' && this.isPreferences(event.payload)) this.bootstrap.setPreferences(event.payload);
        if (event.type === 'log' && this.isLog(event.payload)) this.bootstrap.appendLog(event.payload);
      },
      error: () => undefined,
    });
  }

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected openSettings(): void {
    this.api.get<LauncherConfig>('/api/config').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => {
        const avatarLetters = this.preferences().avatarLetters ?? 'ML';
        this.initialAvatarLetters = avatarLetters;
        this.settings.set({
          ...config,
          preferences: { ...config.preferences, ...this.preferences(), avatarLetters },
        });
        this.settingsError.set(null);
        this.settingsVisible.set(true);
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudo cargar la configuración.'),
    });
  }

  protected updateSetting(section: 'rootPath' | 'mova' | 'shellDefaults' | 'browser' | 'preferences', key: string, value: string): void {
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
    if (!this.publishedComponentsConfigured()) {
      this.settingsError.set('El CDN y la carpeta Stencil de MOVA Components son obligatorios.');
      return;
    }
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
        this.bootstrap.reload();
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudieron guardar los cambios.'),
    });
  }

  protected openBrowser(browser: BrowserMode = 'chrome-insecure'): void {
    this.api.post<unknown>('/api/chrome/open', { mode: 'tab', browser })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected microfrontKey(project: Project, microfront: NonNullable<Project['microfrontends']>[number]): string {
    return `${project.id}:${microfront.id}`;
  }

  private isState(value: unknown): value is LauncherState {
    return typeof value === 'object' && value !== null && 'shell' in value && 'components' in value;
  }

  private isPreferences(value: unknown): value is LauncherPreferences {
    return typeof value === 'object' && value !== null && 'favoriteShellIds' in value;
  }

  private isLog(value: unknown): value is LauncherLog {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'at' in value &&
      'source' in value &&
      'level' in value &&
      'message' in value
    );
  }
}
