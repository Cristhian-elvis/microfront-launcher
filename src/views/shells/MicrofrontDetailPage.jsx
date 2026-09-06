import { useCallback, useState } from "react";
import { MicrofrontDetailView } from "./components/MicrofrontDetailView.jsx";
import { useMicrofrontDetailActions } from "./hooks/useMicrofrontDetailActions.js";

export function MicrofrontDetailPage({
  project,
  microfront,
  state,
  flash,
  refreshProjects,
  refreshState,
}) {
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
  }, [project.id, microfront.id, onRefreshAction]);

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
