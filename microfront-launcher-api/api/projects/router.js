import { json, Router } from 'express';

import { projectsController } from './controller.js';

export function createProjectsRouter() {
  const router = Router();
  const parseJson = json();

  router.post('/setup', parseJson, projectsController.setup);
  router.put('/config', parseJson, projectsController.updateConfig);
  router.get('/projects', projectsController.listProjects);
  router.post('/projects/refresh', projectsController.refreshProjectList);
  router.get('/projects/:projectId/microfrontends', projectsController.getProjectMicrofrontends);
  router.get('/projects/:projectId', projectsController.getProject);
  router.post(
    '/projects/scaffolding',
    parseJson,
    projectsController.openScaffolding,
  );
  router.post(
    '/projects/:projectId/open-target',
    parseJson,
    projectsController.openProjectTarget,
  );
  router.post(
    '/dialogs/select-directory',
    parseJson,
    projectsController.selectDirectory,
  );

  return router;
}
