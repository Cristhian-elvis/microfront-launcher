import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import type { LauncherLog } from '../../../core/launcher.models';
import { AppIconComponent } from '../app-icon/app-icon.component';

export interface ConsoleSegment {
  text: string;
  colorClass: string;
}

const ansiColorClasses: Record<number, string> = {
  30: 'ansi-black', 31: 'ansi-red', 32: 'ansi-green', 33: 'ansi-yellow',
  34: 'ansi-blue', 35: 'ansi-magenta', 36: 'ansi-cyan', 37: 'ansi-white',
  90: 'ansi-gray', 91: 'ansi-bright-red', 92: 'ansi-bright-green', 93: 'ansi-bright-yellow',
  94: 'ansi-bright-blue', 95: 'ansi-bright-magenta', 96: 'ansi-bright-cyan', 97: 'ansi-bright-white',
};

/** Convierte códigos SGR ANSI en fragmentos de texto seguros para interpolación Angular. */
export function parseAnsi(message: string): ConsoleSegment[] {
  const segments: ConsoleSegment[] = [];
  const sgr = /\u001b\[([0-9;]*)m/g;
  let colorClass = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  const append = (text: string): void => {
    if (text) segments.push({ text, colorClass });
  };

  while ((match = sgr.exec(message)) !== null) {
    append(message.slice(cursor, match.index));
    const codes = match[1] ? match[1].split(';').map(Number) : [0];
    for (const code of codes) {
      if (code === 0 || code === 39) colorClass = '';
      else if (ansiColorClasses[code]) colorClass = ansiColorClasses[code];
    }
    cursor = sgr.lastIndex;
  }
  append(message.slice(cursor));
  return segments.length ? segments : [{ text: '', colorClass: '' }];
}

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
