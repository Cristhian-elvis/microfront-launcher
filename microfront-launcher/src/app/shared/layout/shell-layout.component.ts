import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { ProcessConsoleComponent } from '../components/process-console/process-console.component';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-shell-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.css',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonDirective,
    Dialog,
    ProcessConsoleComponent,
    RouterOutlet,
  ],
})
export class ShellLayoutComponent {
  protected readonly bootstrap = inject(AppBootstrapService);
  protected readonly theme = inject(ThemeService);
  protected readonly consoleVisible = signal(false);
}
