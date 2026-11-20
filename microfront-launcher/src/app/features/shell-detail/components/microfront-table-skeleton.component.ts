import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-microfront-table-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton, TableModule],
  template: `
    <section
      class="rounded-xl border border-slate-700 p-4"
      aria-busy="true"
      aria-label="Cargando microfronts locales"
    >
      <header class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="space-y-2">
          <p-skeleton width="11rem" height="1.25rem" />
          <p-skeleton width="8rem" height="0.9rem" />
        </div>
        <p-skeleton width="14rem" height="2.5rem" />
      </header>

      <div class="overflow-hidden rounded-lg border border-slate-700">
        <div class="grid grid-cols-[2rem_minmax(12rem,2fr)_minmax(8rem,1fr)_minmax(7rem,1fr)_minmax(9rem,1fr)_6rem] gap-4 border-b border-slate-700 bg-slate-900/60 px-4 py-3">
          <p-skeleton width="1rem" height="0.75rem" />
          <p-skeleton width="5rem" height="0.75rem" />
          <p-skeleton width="4rem" height="0.75rem" />
          <p-skeleton width="4rem" height="0.75rem" />
          <p-skeleton width="7rem" height="0.75rem" />
          <p-skeleton width="4rem" height="0.75rem" />
        </div>

        @for (row of rows; track row.id) {
          <div class="grid grid-cols-[2rem_minmax(12rem,2fr)_minmax(8rem,1fr)_minmax(7rem,1fr)_minmax(9rem,1fr)_6rem] items-center gap-4 border-b border-slate-800 px-4 py-4 last:border-b-0">
            <p-skeleton shape="circle" size="1.6rem" />
            <div>
              <p-skeleton width="75%" height="1rem" />
              <p-skeleton class="mt-2 block" width="55%" height="0.75rem" />
            </div>
            <p-skeleton width="60%" height="1rem" />
            <p-skeleton width="5rem" height="1.5rem" />
            <p-skeleton width="6rem" height="1.5rem" />
            <div class="flex gap-2">
              <p-skeleton shape="circle" size="2rem" />
              <p-skeleton shape="circle" size="2rem" />
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class MicrofrontTableSkeletonComponent {
  protected readonly rows = Array.from({ length: 4 }, (_, index) => ({ id: index }));
}
