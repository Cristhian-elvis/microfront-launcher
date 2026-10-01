import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import type { LauncherConfig } from '../../core/launcher.models';

@Component({
  selector: 'app-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, InputText],
  template: `
    <section class="setup-page">
      <main class="setup-panel">
        <div class="setup-intro">
          <div class="brand">
            <i class="pi pi-box"></i>
            Microfront Launcher
          </div>
          <p class="eyebrow">CONFIGURACIÓN INICIAL</p>
          <h1>Prepara tu entorno local.</h1>
          <p>
            Completa estos datos una sola vez para compilar MOVA Components y detectar tus shells.
          </p>
        </div>
        <form class="setup-form" (submit)="$event.preventDefault(); save()">
          <div>
            <h2>Datos del entorno</h2>
            <p>Todos los campos son obligatorios.</p>
          </div>
          <label>
            Raíz de shells
            <input
              pInputText
              required
              [value]="config().rootPath || ''"
              (input)="updateRoot($any($event.target).value)"
            />
          </label>
          <label>
            Repositorio MOVA UI Components
            <input
              pInputText
              required
              [value]="config().mova?.sourcePath || ''"
              (input)="updateMova('sourcePath', $any($event.target).value)"
            />
          </label>
          <label>
            CDN base de MOVA Components
            <input
              pInputText
              required
              [value]="config().mova?.cdnHost || ''"
              (input)="updateMova('cdnHost', $any($event.target).value)"
            />
          </label>
          <label>
            Carpeta Stencil
            <input
              pInputText
              required
              [value]="config().mova?.stencilComponentsFolderName || ''"
              (input)="updateMova('stencilComponentsFolderName', $any($event.target).value)"
            />
          </label>
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
          <p-button
            type="submit"
            label="Guardar y continuar"
            icon="pi pi-arrow-right"
            [disabled]="!valid()"
            [loading]="saving()"
          />
        </form>
      </main>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: #091725;
        color: #edf5fc;
      }
      .setup-page {
        display: grid;
        min-height: 100dvh;
        place-items: center;
        padding: 32px;
        background: radial-gradient(circle at 15% 10%, #153856 0, transparent 34%), #091725;
      }
      .setup-panel {
        display: grid;
        grid-template-columns: minmax(250px, 0.9fr) minmax(360px, 1.1fr);
        width: min(920px, 100%);
        overflow: hidden;
        border: 1px solid #31516c;
        border-radius: 18px;
        background: #101f2e;
        box-shadow: 0 24px 70px #03080dcc;
      }
      .setup-intro {
        display: grid;
        align-content: center;
        gap: 18px;
        padding: 48px 42px;
        background: linear-gradient(145deg, #123a58, #102536);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #74e6df;
        font-weight: 700;
      }
      .eyebrow {
        margin: 20px 0 0;
        color: #74e6df;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      h1 {
        margin: 0;
        font-size: clamp(30px, 4vw, 44px);
        line-height: 1.05;
      }
      .setup-intro p:last-child {
        margin: 0;
        color: #b5cadb;
        line-height: 1.6;
      }
      .setup-form {
        display: grid;
        gap: 18px;
        padding: 42px;
        background: #111a24;
      }
      h2,
      .setup-form p {
        margin: 0;
      }
      h2 {
        font-size: 20px;
      }
      .setup-form > div p {
        margin-top: 5px;
        color: #9eb2c3;
      }
      label {
        display: grid;
        gap: 7px;
        color: #d9e5ef;
        font-size: 13px;
        font-weight: 700;
      }
      input {
        width: 100%;
      }
      .error {
        margin: 0;
        color: #ffb4ab;
        font-size: 13px;
      }
      @media (max-width: 720px) {
        .setup-page {
          padding: 16px;
        }
        .setup-panel {
          grid-template-columns: 1fr;
        }
        .setup-intro,
        .setup-form {
          padding: 30px 24px;
        }
        .setup-intro {
          gap: 12px;
        }
        .eyebrow {
          margin: 8px 0 0;
        }
      }
    `,
  ],
})
export class SetupPageComponent {
  private readonly api = inject(ApiService);
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
    this.api
      .post('/api/setup', this.config())
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
