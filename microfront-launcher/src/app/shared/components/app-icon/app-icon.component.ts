import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type AppIconName = 'console';

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
    }
  `,
  host: {
    class: 'inline-flex items-center',
    'aria-hidden': 'true',
  },
})
export class AppIconComponent {
  readonly name = input.required<AppIconName>();
  readonly size = input(16);
}
