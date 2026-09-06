import { useCallback } from "react";
import { api } from "../../../lib/api.js";

export function useShellDetailActions(flash, refreshProjects, refreshState) {
  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        void refreshState();
        return result;
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshState],
  );

  const action = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        await Promise.all([refreshProjects(), refreshState()]);
        return result;
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshProjects, refreshState],
  );

  const onOpenWebapp = useCallback(
    (project) => action("/api/projects/open-webapp", { projectId: project.id }),
    [action],
  );

  const onStart = useCallback(
    (project) => action("/api/environment/start", { projectId: project.id }),
    [action],
  );

  const onStop = useCallback(
    () => action("/api/environment/stop"),
    [action],
  );

  const onRebuild = useCallback(
    (project) => action("/api/shell/rebuild", { projectId: project.id }),
    [action],
  );

  const onChangeMicrofrontBranch = useCallback(
    (project, microfrontend, branch) =>
      startMicrofrontendAction("/api/microfrontends/branch", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
        branch,
      }),
    [startMicrofrontendAction],
  );

  const onChangeMicrofrontBranchBatch = useCallback(
    (project, microfronts, branch) =>
      startMicrofrontendAction("/api/microfrontends/branch-batch", {
        projectId: project.id,
        microfrontendIds: microfronts.map((microfront) => microfront.id),
        branch,
      }),
    [startMicrofrontendAction],
  );

  const onBuildMicrofront = useCallback(
    (project, microfrontend) =>
      startMicrofrontendAction("/api/microfrontends/build", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    [startMicrofrontendAction],
  );

  const onBuildMicrofrontBatch = useCallback(
    (project, microfronts) =>
      startMicrofrontendAction("/api/microfrontends/build-batch", {
        projectId: project.id,
        microfrontendIds: microfronts.map((microfront) => microfront.id),
      }),
    [startMicrofrontendAction],
  );

  const onRefresh = useCallback(
    async (shellDetailId, projects, setProjectsState) => {
      try {
        const updated = await api(`/api/projects/${encodeURIComponent(shellDetailId)}/refresh`);
        setProjectsState(projects.map((p) =>
          p.id === updated.id ? updated : p
        ));
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash],
  );

  return {
    onOpenWebapp,
    onStart,
    onStop,
    onRebuild,
    onChangeMicrofrontBranch,
    onChangeMicrofrontBranchBatch,
    onBuildMicrofront,
    onBuildMicrofrontBatch,
    onRefresh,
  };
}
