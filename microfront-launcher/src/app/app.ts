import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Toast } from 'primeng/toast';
import { ShellLayoutComponent } from './shared/layout/shell-layout.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Toast, ShellLayoutComponent],
  templateUrl: './app.html'
})
export class App {
}
