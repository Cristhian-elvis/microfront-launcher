export const microfrontKey = (projectId, microfrontendId) => `${projectId}:${microfrontendId}`;

export const flattenMicrofronts = (projects) => projects.flatMap((project) => (project.microfrontends || [])
  .map((microfrontend) => ({ ...microfrontend, project })));
