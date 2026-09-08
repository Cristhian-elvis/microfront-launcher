import { useCallback, useState } from "react";
import { api } from "../../../lib/api.js";

export function useShellDetailActions(flash, refreshProjects, refreshState) {
  const [isStartingShell, setIsStartingShell] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
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
        void refreshState();
        return result;
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshState],
  );

  const onOpenWebapp = useCallback(
    (project) => action("/api/projects/open-webapp", { projectId: project.id }),
    [action],
  );

  const startAction = useCallback(
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
      }
    },
    [flash, refreshState],
  );

  const onStart = useCallback(
    async (project) => {
      if (isStartingShell) return;
      setIsStartingShell(true);
      try {
        return await startAction("/api/environment/start", { projectId: project.id });
      } finally {
        setIsStartingShell(false);
      }
    },
    [isStartingShell, startAction],
  );

  const onStop = useCallback(
    () => startAction("/api/environment/stop"),
    [startAction],
  );

  const onRebuild = useCallback(
    async (project) => {
      if (isRebuilding) return;
      setIsRebuilding(true);
      try {
        return await startAction("/api/shell/rebuild", { projectId: project.id });
      } finally {
        setIsRebuilding(false);
      }
    },
    [isRebuilding, startAction],
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
    async (shellDetailId, replaceProject) => {
      try {
        const updated = await api(
          `/api/projects/${encodeURIComponent(shellDetailId)}/refresh`,
        );
        replaceProject(updated);
        return updated;
      } catch (e) {
        flash(e.message, "error");
        throw e;
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
    isStartingShell,
    isRebuilding,
  };
}
