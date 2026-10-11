import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';

/**
 * Modal reutilizable para seleccionar la rama destino al cambiar de rama
 * uno o varios microfronts.
 */
@Component({
  selector: 'app-branch-select-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Button],
  template: `
    <p-dialog
      header="Cambiar rama"
      [modal]="true"
      [visible]="visible()"
      [draggable]="false"
      [style]="{ width: 'min(380px, calc(100vw - 2rem))' }"
      (visibleChange)="onVisibleChange($event)"
    >
      <div class="grid gap-3">
        <label class="grid gap-1 text-sm">
          Rama destino
          <select
            class="p-inputtext w-full"
            [ngModel]="selectedBranch()"
            (ngModelChange)="selectedBranch.set($event)"
          >
            <option value="">
              {{ branches().length ? 'Seleccionar rama…' : 'Sin ramas comunes' }}
            </option>
            @for (branch of branches(); track branch) {
              <option [value]="branch">{{ branch }}</option>
            }
          </select>
        </label>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <p-button label="Cancelar" styleClass="p-button-outlined" (onClick)="cancel()" />
        <p-button
          label="Confirmar"
          [disabled]="!selectedBranch()"
          (onClick)="confirm()"
        />
      </div>
    </p-dialog>
  `,
})
export class BranchSelectDialogComponent {
  readonly branches = input<string[]>([]);

  readonly visible = signal(false);
  readonly selectedBranch = signal('');

  readonly confirmed = output<string>();

  open(): void {
    this.selectedBranch.set('');
    this.visible.set(true);
  }

  cancel(): void {
    this.visible.set(false);
  }

  onVisibleChange(value: boolean): void {
    this.visible.set(value);
  }

  confirm(): void {
    const branch = this.selectedBranch();
    if (!branch) return;
    this.visible.set(false);
    this.confirmed.emit(branch);
  }
}
