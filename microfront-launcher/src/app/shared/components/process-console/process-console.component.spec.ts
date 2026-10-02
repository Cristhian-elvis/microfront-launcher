import { parseAnsi } from './process-console.component';

describe('parseAnsi', () => {
  it('preserves text and maps ANSI colors to safe CSS classes', () => {
    expect(parseAnsi('Listo \u001b[32mcorrectamente\u001b[0m.')).toEqual([
      { text: 'Listo ', colorClass: '' },
      { text: 'correctamente', colorClass: 'ansi-green' },
      { text: '.', colorClass: '' },
    ]);
  });

  it('does not treat plain text as HTML', () => {
    expect(parseAnsi('<script>alert(1)</script>')).toEqual([
      { text: '<script>alert(1)</script>', colorClass: '' },
    ]);
  });
});
