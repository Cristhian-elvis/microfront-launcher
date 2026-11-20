import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type AppIconName = 'console' | 'terminal';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (name()) {
      @case ('console') {
        <svg
          viewBox="0 0 24 24"
          [attr.width]="size()"
          [attr.height]="size()"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      }
      @case ('terminal') {
        <svg
          viewBox="0 0 24 24"
          [attr.width]="size()"
          [attr.height]="size()"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 14h6v2h-6zM6.293 9.707 8.586 12l-2.293 2.293 1.414 1.414L11.414 12 7.707 8.293z" />
          <path d="M20 4H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zM4 18V6h16l.002 12H4z" />
        </svg>
      }
    }
  `,
  host: {
    class: 'inline-flex items-center', 'aria-hidden': 'true',
  },
})
export class AppIconComponent {
  readonly name = input.required<AppIconName>();
  readonly size = input(16);
}
