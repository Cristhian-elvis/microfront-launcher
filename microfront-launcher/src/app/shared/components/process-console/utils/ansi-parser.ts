import { ansiColorClasses } from "../constants/ansi-colors";
import type { ConsoleSegment } from "../types/console-segment.type";

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