import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import type { MicrofrontendBuildOptions } from '../../../core/launcher.models';

/** Configura la ejecución de `check-project` para uno o varios microfronts. */
@Component({
  selector: 'app-build-options-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Checkbox, Button],
  template: `
    <p-dialog
      [header]="title()"
      [modal]="true"
      [visible]="true"
      [draggable]="false"
      [style]="{ width: 'min(420px, calc(100vw - 2rem))' }"
      (visibleChange)="close()"
    >
      <div class="grid gap-4">
        <section class="grid gap-2">
          <h4 class="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pasos de ejecución
          </h4>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="syncGit" />
            Sincronizar Git
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="checkDependencies" />
            Verificar e instalar dependencias
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="build" />
            Compilar
          </label>
          @if (!hasAnyStepSelected()) {
            <p class="m-0 text-xs text-amber-400">
              Selecciona al menos un paso para continuar.
            </p>
          }
        </section>
        <section class="grid gap-2">
          <h4 class="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comportamiento
          </h4>
          <label class="flex items-center gap-2 text-sm" [class.opacity-50]="!build()">
            <p-checkbox [binary]="true" [(ngModel)]="forceBuild" [disabled]="!build()" />
            Forzar recompilación
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="localMode" />
            Enlazar librerías mova3 localmente
          </label>
        </section>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <p-button label="Cancelar" styleClass="p-button-outlined" (onClick)="close()" />
        <p-button label="Confirmar" [disabled]="!hasAnyStepSelected()" (onClick)="confirm()" />
      </div>
    </p-dialog>
  `,
})
export class BuildOptionsDialogComponent {
  readonly title = input('Preparar microfront');

  readonly closed = output<void>();
  readonly confirmed = output<MicrofrontendBuildOptions>();

  readonly syncGit = signal(true);
  readonly checkDependencies = signal(true);
  readonly build = signal(true);
  readonly forceBuild = signal(false);
  readonly localMode = signal(false);

  hasAnyStepSelected(): boolean {
    return this.syncGit() || this.checkDependencies() || this.build();
  }

  close(): void {
    this.closed.emit();
  }

  confirm(): void {
    if (!this.hasAnyStepSelected()) return;
    this.confirmed.emit({
      syncGit: this.syncGit(),
      skipCheck: !this.checkDependencies(),
      skipBuild: !this.build(),
      forceBuild: this.build() ? this.forceBuild() : false,
      localMode: this.localMode(),
    });
  }
}
