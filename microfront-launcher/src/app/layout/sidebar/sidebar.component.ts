import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Badge } from 'primeng/badge';
import { Button, ButtonDirective } from 'primeng/button';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { projectDisplayName } from '../../shared/utils/project-display-name.util';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  imports: [RouterLink, RouterLinkActive, Button, ButtonDirective, Badge],
})
export class SidebarComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  readonly settingsRequested = output<void>();
  readonly collapsed = signal(false);
  readonly projects = this.bootstrap.projects;
  readonly state = this.bootstrap.state;
  readonly preferences = this.bootstrap.preferences;
  readonly favoriteShells = computed(() => {
    const ids = new Set(this.preferences().favoriteShellIds ?? []);
    return this.projects().filter((project) => ids.has(project.id));
  });
  displayProjectName(name: string | null | undefined): string {
    return projectDisplayName(name);
  }

  toggle(): void {
    this.collapsed.update((value) => !value);
  }
}
