import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { AppBootstrapService } from '../../core/app-bootstrap.service';

@Component({
  selector: 'app-bootstrap-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  template: `
    <section class="error-page" aria-labelledby="error-title">
      <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
      <p class="eyebrow">ERROR DE INICIO</p>
      <h1 id="error-title">No se pudo iniciar Microfront Launcher</h1>
      <p>Comprueba que el servicio local esté disponible y vuelve a intentarlo.</p>
      @if (bootstrap.bootstrapError(); as error) {
        <code>{{ error.message }}</code>
      }
      <button
        pButton
        type="button"
        label="Reintentar"
        icon="pi pi-refresh"
        (click)="retry()"
      ></button>
    </section>
  `,
  styles: `
    .error-page {
      display: grid;
      max-width: 620px;
      gap: 14px;
      padding: 36px;
      border: 1px solid #74414b;
      border-radius: 12px;
      background: #24131a;
      color: #f5d9dd;
    }
    .error-page > i {
      color: #ff858c;
      font-size: 32px;
    }
    .error-page h1,
    .error-page p {
      margin: 0;
    }
    .error-page .eyebrow {
      color: #ff9ba1;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
    }
    .error-page code {
      overflow-wrap: anywhere;
      color: #d9b8bd;
    }
    .error-page button {
      justify-self: start;
      margin-top: 6px;
    }
  `,
})
export class BootstrapErrorPageComponent {
  protected readonly bootstrap = inject(AppBootstrapService);

  protected retry(): void {
    this.bootstrap.retry();
  }
}
