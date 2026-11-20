import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import type { LauncherLog } from '../../../core/launcher.models';
import { AppIconComponent } from '../app-icon/app-icon.component';
import type { ConsoleSegment } from './types/console-segment.type';
import { parseAnsi } from './utils/ansi-parser';

interface RenderedLog {
  log: LauncherLog;
  segments: ConsoleSegment[];
}

interface LogGroup {
  id: string;
  source: string;
  logs: RenderedLog[];
}

/** Muestra los eventos de proceso agrupados por fuente consecutiva. */
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

  protected readonly logGroups = computed<LogGroup[]>(() => {
    const groups: LogGroup[] = [];

    for (const log of this.visibleLogs().slice(-250)) {
      const renderedLog: RenderedLog = { log, segments: parseAnsi(log.message) };
      const previousGroup = groups.at(-1);

      if (previousGroup?.source === log.source) {
        previousGroup.logs.push(renderedLog);
      } else {
        groups.push({
          id: log.id,
          source: log.source,
          logs: [renderedLog],
        });
      }
    }

    return groups;
  });

  protected clearView(): void {
    this.clearRequested.emit();
  }
}
