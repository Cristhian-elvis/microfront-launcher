import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

@Component({
  selector: 'app-shell-summary-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    <article
      class="grid min-w-0 content-start rounded-xl border border-slate-700 p-4"
      aria-busy="true"
    >
      <p-skeleton width="35%" height="0.9rem" />
      <p-skeleton class="mt-2 block" width="55%" height="1.25rem" />
      <p-skeleton class="mt-4 block" width="30%" height="0.9rem" />
      <p-skeleton class="mt-1 block" width="45%" height="1.25rem" />
      <p-skeleton class="mt-4 block" width="25%" height="0.9rem" />
      <p-skeleton class="mt-1 block" width="85%" height="1.5rem" />
    </article>
  `,
})
export class ShellSummarySkeletonComponent {}
