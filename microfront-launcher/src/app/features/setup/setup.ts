import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { EnvironmentService } from '../../core/services/environment.service';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import type { LauncherConfig } from '../../core/launcher.models';

@Component({
  selector: 'app-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup.html',
  styleUrls: ['./setup.css'],
  imports: [Button, InputText],
})
export class SetupPageComponent {
  private readonly environment = inject(EnvironmentService);
  private readonly bootstrap = inject(AppBootstrapService);

  protected readonly config = signal<LauncherConfig>({ mova: {
    cdnHost: 'https://d1ugy3v77gzx7h.cloudfront.net/uploads/mova3',
    sourcePath: 'C:\\gitlab\\mova\\mova3\\mova3_lib_ui_components',
    stencilComponentsFolderName: 'cudc-lib-componentes-stencil-VAL',
  } });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly valid = computed(() => {
    const mova = this.config().mova;
    return Boolean(
      this.config().rootPath?.trim() &&
      mova?.sourcePath?.trim() &&
      mova?.cdnHost?.trim() &&
      mova?.stencilComponentsFolderName?.trim(),
    );
  });

  protected updateRoot(rootPath: string): void {
    this.config.update((config) => ({ ...config, rootPath }));
  }

  protected updateMova(
    key: 'sourcePath' | 'cdnHost' | 'stencilComponentsFolderName',
    value: string,
  ): void {
    this.config.update((config) => ({ ...config, mova: { ...config.mova, [key]: value } }));
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
