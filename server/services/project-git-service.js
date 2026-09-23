async function repositoryGitInfo(
  repositoryPath,
  gitBranchInfo,
  exactGitTag,
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

// Servicio de solo lectura: concentra las consultas Git de un proyecto ya
// detectado y no modifica su árbol de trabajo ni sus referencias remotas.
export function createProjectGitService({
  findProject,
  gitBranchInfo,
  exactGitTag,
}) {
  async function getProjectGitInfo(projectId) {
    const project = await findProject(projectId);
    if (!project) throw new Error("Shell no encontrada.");

    const repositories = [
      repositoryGitInfo(project.path, gitBranchInfo, exactGitTag, {
        includeExactTag: true,
      }),
      project.webappPath
        ? repositoryGitInfo(project.webappPath, gitBranchInfo, exactGitTag)
        : Promise.resolve(null),
      Promise.all(
        (project.microfrontends || []).map(async (microfrontend) => {
          const git = await repositoryGitInfo(
            microfrontend.path,
            gitBranchInfo,
            exactGitTag,
          );
          return { id: microfrontend.id, ...git };
        }),
      ),
    ];

    const [shell, webapp, microfrontends] = await Promise.all(repositories);
    return {
      projectId,
      loadedAt: new Date().toISOString(),
      shell,
      webapp,
      microfrontends,
    };
  }

  return { getProjectGitInfo };
}
