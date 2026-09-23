import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api.js";

function mergeGitInfo(project, gitInfo) {
  const microfrontendsById = new Map(
    gitInfo.microfrontends.map((microfrontend) => [microfrontend.id, microfrontend]),
  );
  return {
    ...project,
    gitInfo,
    shellTag: gitInfo.shell.exactTag,
    microfrontends: (project.microfrontends || []).map((microfrontend) => {
      const git = microfrontendsById.get(microfrontend.id);
      return git
        ? { ...microfrontend, branch: git.branch, branches: git.branches }
        : microfrontend;
    }),
  };
}

// Carga bajo demanda la información Git de una sola shell. El catálogo inicial
// permanece libre de Git; el resultado se conserva en el contexto del proyecto.
export function useProjectGitInfo(project, replaceProject, onError) {
  const loadedProjectId = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (project?.gitInfo?.loadedAt) {
      loadedProjectId.current = project.id;
      return undefined;
    }
    if (!project || loadedProjectId.current === project.id) return undefined;

    let cancelled = false;
    setLoading(true);
    api(`/api/projects/${encodeURIComponent(project.id)}/git-info`)
      .then((gitInfo) => {
        if (!cancelled) {
          loadedProjectId.current = project.id;
          replaceProject(mergeGitInfo(project, gitInfo));
        }
      })
      .catch((error) => {
        if (!cancelled) onError(error.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onError, project, replaceProject]);

  return { loading };
}
