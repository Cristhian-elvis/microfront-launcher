import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import type { LauncherLog } from '../../../core/launcher.models';

@Component({
  selector: 'app-process-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, DatePipe],
  templateUrl: './process-console.component.html',
  styleUrl: './process-console.component.css',
})
export class ProcessConsoleComponent {
  readonly logs = input.required<LauncherLog[]>();

  private readonly clearedAt = signal(0);
  protected readonly visibleLogs = computed(() => {
    const clearedAt = this.clearedAt();
    return this.logs().filter((log) => Date.parse(log.at) > clearedAt);
  });

  protected clearView(): void {
    this.clearedAt.set(Date.now());
  }
}
