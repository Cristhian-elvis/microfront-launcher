import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';

/** Selecciona la rama destino de los microfronts elegidos. */
@Component({
  selector: 'app-branch-select-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Button, Select],
  template: `
    <p-dialog
      header="Cambiar rama"
      [modal]="true"
      [visible]="true"
      [draggable]="false"
      [style]="{ width: 'min(380px, calc(100vw - 2rem))' }"
      (visibleChange)="close()"
    >
      <div class="grid gap-3">
        <label class="grid gap-1 text-sm">
          Rama destino
          <p-select
            [options]="branches()"
            [ngModel]="selectedBranch()"
            (ngModelChange)="selectedBranch.set($event)"
            [placeholder]="branches().length ? 'Seleccionar rama…' : 'Sin ramas comunes'"
            [disabled]="!branches().length"
            [appendTo]="'body'"
          />
        </label>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <p-button label="Cancelar" styleClass="p-button-outlined" (onClick)="close()" />
        <p-button label="Confirmar" [disabled]="!selectedBranch()" (onClick)="confirm()" />
      </div>
    </p-dialog>
  `,
})
export class BranchSelectDialogComponent {
  readonly branches = input<string[]>([]);

  readonly closed = output<void>();
  readonly confirmed = output<string>();
  readonly selectedBranch = signal('');

  close(): void {
    this.closed.emit();
  }

  confirm(): void {
    const branch = this.selectedBranch();
    if (!branch) return;
    this.confirmed.emit(branch);
  }
}
