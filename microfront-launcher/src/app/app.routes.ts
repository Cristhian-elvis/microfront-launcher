import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'microfronts',
    loadComponent: () =>
      import('./features/microfronts/microfronts-page.component').then((m) => m.MicrofrontsPageComponent),
  },
  {
    path: 'releases',
    loadComponent: () =>
      import('./features/releases/release-page.component').then((m) => m.ReleasePageComponent),
  },
  {
    path: 'shells/:shellId',
    loadComponent: () =>
      import('./features/shell-detail/shell-detail-page.component').then(
        (m) => m.ShellDetailPageComponent,
      ),
  },
  {
    path: 'shells',
    loadComponent: () =>
      import('./features/shells/shells-page.component').then((m) => m.ShellsPageComponent),
  },
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup').then((m) => m.SetupPageComponent),
  },
  {
    path: 'error',
    loadComponent: () =>
      import('./shared/pages/bootstrap-error-page.component').then(
        (m) => m.BootstrapErrorPageComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
