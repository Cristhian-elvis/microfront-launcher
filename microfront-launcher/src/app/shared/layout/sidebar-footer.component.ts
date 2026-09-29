import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

/** Fixed footer action for the application sidebar. */
@Component({
  selector: 'app-sidebar-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `<div class="mt-auto border-t border-surface-200 pt-3 dark:border-surface-700"><p-button icon="pi pi-cog" [label]="collapsed() ? undefined : 'Configuración'" styleClass="p-button-text w-full justify-start" ariaLabel="Configuración" (onClick)="settingsRequested.emit()" /></div>`,
})
export class SidebarFooterComponent {
  readonly collapsed = input.required<boolean>();
  readonly settingsRequested = output<void>();
}
