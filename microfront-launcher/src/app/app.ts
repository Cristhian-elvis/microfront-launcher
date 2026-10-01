import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Toast } from 'primeng/toast';
import { AppBootstrapService } from './core/app-bootstrap.service';
import { BootstrapErrorPageComponent } from './shared/pages/bootstrap-error-page.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressSpinner, Toast, BootstrapErrorPageComponent, MainLayoutComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly bootstrap = inject(AppBootstrapService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.bootstrap.isBooting()) return;

      if (this.bootstrap.bootstrapError()) {
        if (this.router.url !== '/error') void this.router.navigateByUrl('/error');
        return;
      }

      if (this.bootstrap.setupRequired()) {
        if (this.router.url !== '/setup') void this.router.navigateByUrl('/setup');
        return;
      }

      if (this.router.url === '/setup' || this.router.url === '/error') {
        void this.router.navigateByUrl('/home');
      }
    });
  }
}
