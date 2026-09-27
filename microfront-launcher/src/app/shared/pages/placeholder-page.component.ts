import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-placeholder-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<section class="page-card"><p class="eyebrow">Migración en progreso</p><h1>{{ title }}</h1><p>{{ description }}</p></section>`,
    styles: ['.page-card { max-width: 760px; padding: 28px; border: 1px solid #28445e; border-radius: 10px; background: #0e2034; } h1 { margin: 6px 0 12px; } p { color: #a9bbcf; } .eyebrow { color: #4fd1c5; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }']
})
export class PlaceholderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  title = '';
  description = '';

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.title = typeof data['title'] === 'string' ? data['title'] : '';
    this.description = typeof data['description'] === 'string' ? data['description'] : '';
  }
}
