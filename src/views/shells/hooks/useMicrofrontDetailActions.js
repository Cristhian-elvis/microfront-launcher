import { useCallback } from "react";
import { api } from "../../../lib/api.js";
import { useProjects } from "../../../shared/hooks/useProjects.js";

export function useMicrofrontDetailActions(flash, refreshProjects, refreshState) {
  const { updateProject } = useProjects();

  const action = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        return result;
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash],
  );

  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        await refreshState();
        return result;
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshState],
  );

  const onOpenFolder = useCallback(
    (projectId, microfrontendId) =>
      action("/api/microfrontends/open-folder", {
        projectId,
        microfrontendId,
      }),
    [action],
  );

  const onOpenVsCode = useCallback(
    (projectId, microfrontendId) =>
      action("/api/microfrontends/open", {
        projectId,
        microfrontendId,
      }),
    [action],
  );

  const onBuild = useCallback(
    (projectId, microfrontendId) =>
      startMicrofrontendAction("/api/microfrontends/build", {
        projectId,
        microfrontendId,
      }),
    [startMicrofrontendAction],
  );

  const onChangeBranch = useCallback(
    (projectId, microfrontendId, branch) =>
      startMicrofrontendAction("/api/microfrontends/branch", {
        projectId,
        microfrontendId,
        branch,
      }),
    [startMicrofrontendAction],
  );

  const onRefresh = useCallback(
    async (projectId, microfrontendId) => {
      try {
        await api(
          `/api/projects/${encodeURIComponent(projectId)}/refresh`,
        );
        // Actualizar solo el proyecto específico en lugar de recargar todo
        await updateProject(projectId, false);
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, updateProject],
  );

  const onFetchBranch = useCallback(
    (projectId, microfrontendId) =>
      startMicrofrontendAction("/api/microfrontends/fetch", {
        projectId,
        microfrontendId,
      }),
    [startMicrofrontendAction],
  );

  return {
    onOpenFolder,
    onOpenVsCode,
    onBuild,
    onChangeBranch,
    onRefresh,
    onFetchBranch,
  };
}
