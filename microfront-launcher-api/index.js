import { createBrowserRouter } from './api/browser/router.js';
import { createComponentsRouter } from './api/components/router.js';
import { createEnvironmentRouter } from './api/environment/router.js';
import { createMicrofrontendsRouter } from './api/microfrontends/router.js';
import { createMovaRouter } from './api/mova/router.js';
import { createProjectsRouter } from './api/projects/router.js';
import { createStateRouter } from './api/state/router.js';

export { cancelAndStopAll } from './services/launcher-service.js';

export const stateRouter = createStateRouter();
export const projectsRouter = createProjectsRouter();
export const environmentRouter = createEnvironmentRouter();
export const movaRouter = createMovaRouter();
export const componentsRouter = createComponentsRouter();
export const browserRouter = createBrowserRouter();
export const microfrontendsRouter = createMicrofrontendsRouter();
