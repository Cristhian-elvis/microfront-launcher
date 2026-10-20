import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import type { MenuItem } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { SplitButton } from 'primeng/splitbutton';
import { finalize } from 'rxjs';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { ProcessConsoleComponent } from '../../shared/components/process-console/process-console.component';
import { AppIconComponent } from '../../shared/components/app-icon/app-icon.component';
import { ThemeService } from '../../shared/services/theme.service';
import { LauncherEventsService } from '../../core/services/launcher-events.service';
import type { LauncherConfig, LauncherLog, LauncherPreferences, LauncherState, Project } from '../../core/launcher.models';
import { EnvironmentService } from '../../core/services/environment.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import type { BrowserMode } from './types/browser.type';

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
    Select,
    FormsModule,
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
  protected readonly browserModeOptions = [
    { label: 'Chrome', value: 'chrome' },
    { label: 'Chrome sin seguridad', value: 'chrome-insecure' },
    { label: 'Edge', value: 'edge' },
    { label: 'Edge sin seguridad', value: 'edge-insecure' },
  ];
  protected readonly browserOpenModeOptions = [
    { label: 'Preguntar cada vez', value: null },
    { label: 'Abrir como nueva pestaña', value: 'tab' },
    { label: 'Abrir como nueva ventana', value: 'window' },
  ];
  protected readonly browserHostOptions = [
    { label: 'localhost (predeterminado)', value: 'localhost' },
    { label: '127.0.0.1', value: '127.0.0.1' },
  ];
  private readonly events = inject(LauncherEventsService);
  private readonly environment = inject(EnvironmentService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly browserActions: MenuItem[] = [
    { label: 'Chrome', icon: '', command: () => this.openBrowser('chrome') },
    { label: 'Chrome sin seguridad', icon: '', command: () => this.openBrowser('chrome-insecure') },
    { label: 'Edge', icon: '', command: () => this.openBrowser('edge') },
    { label: 'Edge sin seguridad', icon: '', command: () => this.openBrowser('edge-insecure') },
  ];
  constructor() {
    this.events.events().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === 'runtime' && this.isState(event.payload)) this.bootstrap.setRuntime(event.payload);
        if (event.type === 'preferences' && this.isPreferences(event.payload)) this.bootstrap.setPreferences(event.payload);
        if (event.type === 'log' && this.isLog(event.payload)) this.bootstrap.appendLog(event.payload);
      },
      error: () => undefined,
    });

    effect(() => {
      console.log('consoleVisible:', this.consoleVisible())
    });
  }

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected openSettings(): void {
    this.environment.getConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => {
        this.settings.set(config);
        this.settingsError.set(null);
        this.settingsVisible.set(true);
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudo cargar la configuración.'),
    });
  }

  protected updateSetting(section: 'rootPath' | 'mova' | 'shellDefaults' | 'browser', key: string, value: string | null): void {
    this.settings.update((config) => section === 'rootPath'
      ? { ...config, rootPath: value ?? '' }
      : { ...config, [section]: { ...config[section], [key]: value } });
  }

  protected saveSettings(): void {
    const settings = this.settings();
    this.settingsError.set(null);
    if (!this.publishedComponentsConfigured()) {
      this.settingsError.set('El CDN y la carpeta Stencil de MOVA Components son obligatorios.');
      return;
    }
    this.settingsSaving.set(true);

    this.environment.saveConfig(settings).pipe(
      finalize(() => this.settingsSaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.settingsVisible.set(false);
      },
      error: (error: { message?: string }) => this.settingsError.set(error.message ?? 'No se pudieron guardar los cambios.'),
    });
  }

  protected openBrowser(browser: BrowserMode = 'chrome-insecure'): void {
    this.environment.openBrowser('tab', browser)
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
