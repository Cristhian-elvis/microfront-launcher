import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'tags',
    loadComponent: () =>
      import('./features/tags/tags-page.component').then((m) => m.TagsPageComponent),
  },
  {
    path: 'microfronts',
    loadComponent: () =>
      import('./features/microfronts/microfronts-page.component').then((m) => m.MicrofrontsPageComponent),
  },
  {
    path: 'shells/:shellId/versions',
    loadComponent: () =>
      import('./shared/pages/placeholder-page.component').then((m) => m.PlaceholderPageComponent),
    data: {
      title: 'Auditoría de versiones',
      description: 'Comparación de versiones por microfrontend.',
    },
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
      import('./shared/pages/placeholder-page.component').then((m) => m.PlaceholderPageComponent),
    data: { title: 'Configuración inicial', description: 'Configuración local del launcher.' },
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
