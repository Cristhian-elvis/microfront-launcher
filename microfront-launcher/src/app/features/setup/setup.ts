import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { finalize } from 'rxjs';
import { EnvironmentService } from '../../core/services/environment.service';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import type { LauncherConfig } from '../../core/launcher.models';

@Component({
  selector: 'app-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup.html',
  styleUrls: ['./setup.css'],
  imports: [FormsModule, Button, Card, InputText, Message, ToggleSwitch],
})
export class SetupPageComponent {
  private readonly environment = inject(EnvironmentService);
  private readonly bootstrap = inject(AppBootstrapService);

  protected readonly config = signal<LauncherConfig>({ mova: {
    include: true,
    config: {
      automaticUpdate: true,
      sourcePath: 'C:\\gitlab\\mova\\mova3\\mova3_lib_ui_components',
      stencil: 'https://d1ugy3v77gzx7h.cloudfront.net/uploads/mova3/cudc-lib-componentes-stencil-VAL',
    },
  } });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly valid = computed(() => {
    const mova = this.config().mova;
    const movaConfig = mova?.config;
    const hasLocalMovaConfiguration = mova?.include !== true || Boolean(
      movaConfig?.sourcePath?.trim()
      && movaConfig.stencil?.trim(),
    );

    return Boolean(this.config().environment?.rootPath?.trim() && hasLocalMovaConfiguration);
  });

  protected updateRoot(rootPath: string): void {
    this.config.update((config) => ({
      ...config,
      environment: { ...config.environment, rootPath },
    }));
  }

  protected updateMovaInclude(include: boolean): void {
    this.config.update((config) => ({
      ...config,
      mova: { ...config.mova, include },
    }));
  }

  protected updateMovaConfig(
    key: 'sourcePath' | 'stencil',
    value: string,
  ): void {
    this.config.update((config) => ({
      ...config,
      mova: {
        ...config.mova,
        config: { ...config.mova?.config, [key]: value },
      },
    }));
  }

  protected save(): void {
    if (!this.valid()) return;
    this.error.set(null);
    this.saving.set(true);
    this.environment
      .completeSetup(this.config())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.bootstrap.reload();
        },
        error: (error: { message?: string }) =>
          this.error.set(error.message ?? 'No se pudo guardar la configuración.'),
      });
  }
}
