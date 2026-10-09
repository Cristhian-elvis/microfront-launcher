import { json, Router } from 'express';

import { projectsController } from './controller.js';

export function createProjectsRouter() {
  const router = Router();
  const parseJson = json();

  router.post('/setup', parseJson, projectsController.setup);
  router.put('/config', parseJson, projectsController.updateConfig);
  router.get('/projects', projectsController.listProjects);
  router.post('/projects/refresh', projectsController.refreshProjectList);
  router.get(
    '/projects/:projectId/git-info',
    projectsController.getProjectGitInfo,
  );
  router.get('/projects/:projectId/refresh', projectsController.refreshProject);
  router.get('/projects/:projectId', projectsController.getProject);
  router.post(
    '/projects/scaffolding',
    parseJson,
    projectsController.openScaffolding,
  );
  router.post(
    '/projects/open-webapp',
    parseJson,
    projectsController.openProjectWebapp,
  );
  router.post(
    '/dialogs/select-directory',
    parseJson,
    projectsController.selectDirectory,
  );

  return router;
}
