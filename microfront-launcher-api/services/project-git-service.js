import {
  exactGitTag,
  getIndexedProject,
  getProjects,
  gitBranchInfo,
} from '../lib/core.js';

async function findProject(projectId) {
  return getIndexedProject(projectId)
    || (await getProjects()).find((project) => project.id === projectId);
}

async function repositoryGitInfo(
  repositoryPath,
  { includeExactTag = false } = {},
) {
  const [branchInfo, exactTag] = await Promise.all([
    gitBranchInfo(repositoryPath),
    includeExactTag ? exactGitTag(repositoryPath) : Promise.resolve(null),
  ]);

  return {
    path: repositoryPath,
    branch: branchInfo.branch,
    branches: branchInfo.branches,
    exactTag,
  };
}

export async function getProjectGitInfo(projectId) {
  const project = await findProject(projectId);
  if (!project) throw new Error('Shell no encontrada.');

  const [shell, webapp, microfrontends] = await Promise.all([
    repositoryGitInfo(project.path, { includeExactTag: true }),
    project.webappPath
      ? repositoryGitInfo(project.webappPath)
      : Promise.resolve(null),
    Promise.all(
      (project.microfrontends || []).map(async (microfrontend) => ({
        id: microfrontend.id,
        ...(await repositoryGitInfo(microfrontend.path)),
      })),
    ),
  ]);

  return {
    projectId,
    loadedAt: new Date().toISOString(),
    shell,
    webapp,
    microfrontends,
  };
}
