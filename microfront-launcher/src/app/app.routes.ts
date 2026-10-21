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
    path: 'tokens/profiles',
    loadComponent: () =>
      import('./features/auth-profiles/auth-profiles-page.component').then(
        (m) => m.AuthProfilesPageComponent,
      ),
  },
  {
    path: 'tokens',
    loadComponent: () =>
      import('./features/auth-tokens/auth-tokens-page.component').then(
        (m) => m.AuthTokensPageComponent,
      ),
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
