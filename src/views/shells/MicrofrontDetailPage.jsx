import { useCallback, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { MicrofrontDetailView } from "./components/MicrofrontDetailView.jsx";
import { useMicrofrontDetailActions } from "./hooks/useMicrofrontDetailActions.js";
import { useFlash } from "../../shared/hooks/useFlash.js";
import { useProjects } from "../../shared/hooks/useProjects.js";

export function MicrofrontDetailPage({
  state,
}) {
  const { shellId, microfrontId } = useParams();
  const decodedShellId = decodeURIComponent(shellId || "");
  const decodedMicrofrontId = decodeURIComponent(microfrontId || "");
  const { flash } = useFlash();
  const { projects, refreshProjects } = useProjects();
  const project = projects.find((p) => p.id === decodedShellId);
  const microfront = project?.microfrontends?.find(
    (mf) => mf.id === decodedMicrofrontId,
  );
  const refreshState = useCallback(async () => {}, []);
  const [refreshing, setRefreshing] = useState(false);

  const {
    onOpenFolder,
    onOpenVsCode,
    onBuild,
    onChangeBranch,
    onRefresh: onRefreshAction,
    onFetchBranch,
  } = useMicrofrontDetailActions(flash, refreshProjects, refreshState);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await onRefreshAction(project.id, microfront.id);
    } finally {
      setRefreshing(false);
    }
  }, [project?.id, microfront?.id, onRefreshAction]);

  if (!project || !microfront) {
    if (projects.length === 0) {
      return (
        <div className="boot-screen">
          <div className="loader" />
          <p>Cargando microfront...</p>
        </div>
      );
    }
    return (
      <Navigate
        to={project ? `/shells/${encodeURIComponent(project.id)}` : "/shells"}
        replace
      />
    );
  }

  return (
    <MicrofrontDetailView
      project={project}
      microfront={microfront}
      state={state}
      refreshing={refreshing}
      onOpenFolder={onOpenFolder}
      onOpenVsCode={onOpenVsCode}
      onBuild={onBuild}
      onChangeBranch={onChangeBranch}
      onRefresh={onRefresh}
      onFetchBranch={onFetchBranch}
    />
  );
}
