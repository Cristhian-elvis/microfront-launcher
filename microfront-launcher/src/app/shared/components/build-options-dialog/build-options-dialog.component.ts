import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import type { MicrofrontendBuildOptions } from '../../../core/launcher.models';

/**
 * Modal reutilizable para elegir cómo se invoca `check-project` al preparar
 * uno o varios microfronts.
 *
 * Se divide en dos bloques:
 * - "Pasos de ejecución": qué fases de `check-project` correr (al menos una
 *   debe quedar marcada).
 * - "Comportamiento": características que modifican cómo corren esos pasos
 *   (forzar recompilación, enlazar librerías mova3 localmente).
 */
@Component({
  selector: 'app-build-options-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Checkbox, Button],
  template: `
    <p-dialog
      [header]="title()"
      [modal]="true"
      [visible]="visible()"
      [draggable]="false"
      [style]="{ width: 'min(420px, calc(100vw - 2rem))' }"
      (visibleChange)="onVisibleChange($event)"
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
        <p-button label="Cancelar" styleClass="p-button-outlined" (onClick)="cancel()" />
        <p-button label="Confirmar" [disabled]="!hasAnyStepSelected()" (onClick)="confirm()" />
      </div>
    </p-dialog>
  `,
})
export class BuildOptionsDialogComponent {
  readonly title = input('Preparar microfront');

  readonly visible = signal(false);
  readonly syncGit = signal(true);
  readonly checkDependencies = signal(true);
  readonly build = signal(true);
  readonly forceBuild = signal(false);
  readonly localMode = signal(false);

  readonly confirmed = output<MicrofrontendBuildOptions>();

  hasAnyStepSelected(): boolean {
    return this.syncGit() || this.checkDependencies() || this.build();
  }

  open(): void {
    this.syncGit.set(true);
    this.checkDependencies.set(true);
    this.build.set(true);
    this.forceBuild.set(false);
    this.localMode.set(false);
    this.visible.set(true);
  }

  cancel(): void {
    this.visible.set(false);
  }

  onVisibleChange(value: boolean): void {
    this.visible.set(value);
  }

  confirm(): void {
    if (!this.hasAnyStepSelected()) return;
    const options: MicrofrontendBuildOptions = {
      syncGit: this.syncGit(),
      skipCheck: !this.checkDependencies(),
      skipBuild: !this.build(),
      forceBuild: this.build() ? this.forceBuild() : false,
      localMode: this.localMode(),
    };
    this.visible.set(false);
    this.confirmed.emit(options);
  }
}
