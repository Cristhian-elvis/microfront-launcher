import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-shell-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.css',
  imports: [RouterLink, RouterLinkActive, ButtonDirective, RouterOutlet]
})
export class ShellLayoutComponent {
  protected readonly theme = inject(ThemeService);
}
