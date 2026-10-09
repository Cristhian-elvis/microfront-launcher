import { createBrowserRouter } from '../api/browser/router.js';
import { createComponentsRouter } from '../api/components/router.js';
import { createEnvironmentRouter } from '../api/environment/router.js';
import { createMicrofrontendsRouter } from '../api/microfrontends/router.js';
import { createMovaRouter } from '../api/mova/router.js';
import { createProjectsRouter } from '../api/projects/router.js';
import { createStateRouter } from '../api/state/router.js';

export function createApiRouters() {
  return [
    createStateRouter(),
    createProjectsRouter(),
    createEnvironmentRouter(),
    createMovaRouter(),
    createComponentsRouter(),
    createBrowserRouter(),
    createMicrofrontendsRouter(),
  ];
}
