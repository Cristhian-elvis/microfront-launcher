import { getIndexedProject } from '../lib/core.js';

export function selectMicrofrontends(projectId, microfrontendIds) {
  const project = getIndexedProject(projectId);
  if (!project) throw new Error('No se encontró la shell solicitada.');

  const requested = new Set(
    Array.isArray(microfrontendIds) ? microfrontendIds : [],
  );
  const microfrontends = (project.microfrontends || []).filter((item) =>
    requested.has(item.id),
  );
  if (!microfrontends.length || microfrontends.length !== requested.size) {
    throw new Error('La selección de microfronts no es válida.');
  }

  return { project, microfrontends };
}
