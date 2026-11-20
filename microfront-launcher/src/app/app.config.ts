import { provideHttpClient } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import Noir from './core/themes/noir.theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideRouter(
      routes,
      withComponentInputBinding()
    ),
    MessageService,
    providePrimeNG({
      theme: Noir,
      ripple: true
    })
  ]
};
