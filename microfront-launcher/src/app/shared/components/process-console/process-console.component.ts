import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import type { LauncherLog } from '../../../core/launcher.models';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { parseAnsi } from './utils/ansi-parser';

/** Convierte códigos SGR ANSI en fragmentos de texto seguros para interpolación Angular. */

@Component({
  selector: 'app-process-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, DatePipe, AppIconComponent],
  templateUrl: './process-console.component.html',
  styleUrl: './process-console.component.css',
})
export class ProcessConsoleComponent {
  readonly logs = input.required<LauncherLog[]>();
  readonly clearedAt = input(0);
  readonly clearRequested = output<void>();

  protected readonly visibleLogs = computed(() => {
    const clearedAt = this.clearedAt();
    return this.logs().filter((log) => Date.parse(log.at) > clearedAt);
  });
  protected readonly renderedLogs = computed(() =>
    this.visibleLogs().slice(-250).map((log) => ({ log, segments: parseAnsi(log.message) })),
  );

  protected clearView(): void {
    this.clearRequested.emit();
  }
}
