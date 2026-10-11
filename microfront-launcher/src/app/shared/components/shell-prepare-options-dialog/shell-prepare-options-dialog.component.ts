import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import type { ShellPrepareOptions } from '../../../core/launcher.models';

/**
 * Modal para elegir las acciones y los pasos de `npm run prepare-server` al
 * preparar el servidor local de la shell.
 *
 * Se divide en dos secciones:
 * - "Acciones a ejecutar" (configuración): qué categorías procesa el script
 *   (`--libs`, `--remotes`, `--link`). El script está fijado en el
 *   `package.json` de la shell como
 *   `node scripts/prepare-server.mjs --remotes --link` (sin `--libs`), por lo
 *   que replicamos ese default: "Remotes" y "Enlazar en el servidor" vienen
 *   marcados, "Librerías mova3" viene desmarcado.
 * - "Opciones de ejecución para microfront": los mismos pasos y
 *   comportamiento de `check-project`, ya que `prepare-server` delega en las
 *   mismas clases `ProjectChecker` para cada librería/remote incluido.
 */
@Component({
  selector: 'app-shell-prepare-options-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Checkbox, Button],
  template: `
    <p-dialog
      header="Preparar servidor de la shell"
      [modal]="true"
      [visible]="visible()"
      [draggable]="false"
      [style]="{ width: 'min(440px, calc(100vw - 2rem))' }"
      (visibleChange)="onVisibleChange($event)"
    >
      <div class="grid gap-4">
        <section class="grid gap-2">
          <h3 class="m-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Acciones a ejecutar
          </h3>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="libs" />
            Librerías mova3
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="remotes" />
            Remotes (microfronts)
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="link" />
            Enlazar en el servidor
          </label>
          <label class="flex items-center gap-2 text-sm">
            <p-checkbox [binary]="true" [(ngModel)]="buildLocal" />
            Construir servidor local
          </label>
          @if (!hasAnyActionSelected()) {
            <p class="m-0 text-xs text-amber-400">
              Selecciona al menos una acción para continuar.
            </p>
          }
        </section>

        @if (remotes()) {
          <h3 class="m-0 text-sm font-semibold text-slate-200">
            Opciones de ejecución para microfronts
          </h3>
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
        }
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <p-button label="Cancelar" styleClass="p-button-outlined" (onClick)="cancel()" />
        <p-button label="Confirmar" [disabled]="!hasAnyActionSelected()" (onClick)="confirm()" />
      </div>
    </p-dialog>
  `,
})
export class ShellPrepareOptionsDialogComponent {
  readonly visible = signal(false);
  readonly libs = signal(false);
  readonly remotes = signal(true);
  readonly link = signal(true);
  readonly buildLocal = signal(false);
  readonly syncGit = signal(true);
  readonly checkDependencies = signal(true);
  readonly build = signal(true);
  readonly forceBuild = signal(false);
  readonly localMode = signal(false);

  readonly confirmed = output<ShellPrepareOptions>();

  hasAnyActionSelected(): boolean {
    return this.libs() || this.remotes() || this.link();
  }

  open(): void {
    this.libs.set(false);
    this.remotes.set(true);
    this.link.set(true);
    this.buildLocal.set(false);
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
    if (!this.hasAnyActionSelected()) return;
    const options: ShellPrepareOptions = {
      libs: this.libs(),
      remotes: this.remotes(),
      link: this.link(),
      buildLocal: this.buildLocal(),
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
