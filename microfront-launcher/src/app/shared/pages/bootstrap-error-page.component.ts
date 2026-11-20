import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { AppBootstrapService } from '../../core/app-bootstrap.service';

@Component({
  selector: 'app-bootstrap-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <section class="error-page" aria-labelledby="error-title">
      <main class="error-panel">
        <div class="error-intro">
          <div class="brand">
            <i class="pi pi-box"></i>
            Microfront Launcher
          </div>
          <div class="error-icon">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          </div>
          <p class="eyebrow">ERROR DE INICIO</p>
          <h1 id="error-title">No se pudo iniciar el entorno.</h1>
          <p>
            La aplicación no puede continuar hasta resolver la configuración o dependencia indicada.
          </p>
        </div>
        <div class="error-content">
          <div>
            <h2>Revisa el detalle</h2>
            <p>Corrige la causa y vuelve a ejecutar la validación de inicio.</p>
          </div>
          @if (bootstrap.bootstrapError(); as error) {
            <pre class="error-detail"><code>{{ error.message }}</code></pre>
          }
          <p-button
            label="Reintentar"
            icon="pi pi-refresh"
            styleClass="p-button-danger"
            (onClick)="retry()"
          />
        </div>
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
      .error-page {
        display: grid;
        min-height: 100dvh;
        place-items: center;
        padding: 32px;
        background: radial-gradient(circle at 15% 10%, #47202d 0, transparent 34%), #091725;
      }
      .error-panel {
        display: grid;
        grid-template-columns: minmax(250px, 0.9fr) minmax(360px, 1.1fr);
        width: min(920px, 100%);
        overflow: hidden;
        border: 1px solid #714553;
        border-radius: 18px;
        background: #101f2e;
        box-shadow: 0 24px 70px #03080dcc;
      }
      .error-intro {
        display: grid;
        align-content: center;
        gap: 18px;
        padding: 48px 42px;
        background: linear-gradient(145deg, #481d2b, #291520);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #ffafb6;
        font-weight: 700;
      }
      .error-icon {
        display: grid;
        width: 54px;
        height: 54px;
        place-items: center;
        border: 1px solid #ff8792;
        border-radius: 50%;
        color: #ff9ca5;
        font-size: 26px;
      }
      .eyebrow {
        margin: 4px 0 0;
        color: #ffabb2;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      h1,
      h2,
      p {
        margin: 0;
      }
      h1 {
        font-size: clamp(30px, 4vw, 44px);
        line-height: 1.05;
      }
      .error-intro p:last-child {
        color: #f1c8cc;
        line-height: 1.6;
      }
      .error-content {
        display: grid;
        align-content: center;
        gap: 20px;
        padding: 42px;
        background: #111a24;
      }
      h2 {
        font-size: 20px;
      }
      .error-content > div p {
        margin-top: 5px;
        color: #9eb2c3;
      }
      .error-detail {
        max-height: 180px;
        margin: 0;
        overflow: auto;
        padding: 16px;
        border: 1px solid #583844;
        border-radius: 10px;
        background: #21151c;
        color: #ffd5d9;
        font:
          13px/1.45 ui-monospace,
          SFMono-Regular,
          Consolas,
          monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      @media (max-width: 720px) {
        .error-page {
          padding: 16px;
        }
        .error-panel {
          grid-template-columns: 1fr;
        }
        .error-intro,
        .error-content {
          padding: 30px 24px;
        }
        .error-intro {
          gap: 12px;
        }
      }
    `,
  ],
})
export class BootstrapErrorPageComponent {
  protected readonly bootstrap = inject(AppBootstrapService);

  protected retry(): void {
    this.bootstrap.retry();
  }
}
