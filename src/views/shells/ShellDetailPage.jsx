import { useCallback, useState } from 'react';
import { ShellDetailView } from './components/ShellDetailView.jsx';
import { useShellDetailActions } from './hooks/useShellDetailActions.js';

export function ShellDetailPage({
  project,
  state,
  favorite,
  onFavorite,
  flash,
  refreshProjects,
  refreshState,
  onMicrofrontDetail,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [projectsState, setProjectsState] = useState(null);

  const {
    onOpenWebapp,
    onStart,
    onStop,
    onRebuild,
    onChangeMicrofrontBranch,
    onChangeMicrofrontBranchBatch,
    onBuildMicrofront,
    onBuildMicrofrontBatch,
    onRefresh: onRefreshAction,
  } = useShellDetailActions(flash, refreshProjects, refreshState);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await onRefreshAction(project.id, [project], setProjectsState);
    } finally {
      setRefreshing(false);
    }
  }, [project.id, onRefreshAction]);

  return (
    <ShellDetailView
      project={project}
      state={state}
      refreshing={refreshing}
      onOpenWebapp={onOpenWebapp}
      onStart={onStart}
      onStop={onStop}
      onRebuild={onRebuild}
      onChangeMicrofrontBranch={onChangeMicrofrontBranch}
      onChangeMicrofrontBranchBatch={onChangeMicrofrontBranchBatch}
      onBuildMicrofront={onBuildMicrofront}
      onBuildMicrofrontBatch={onBuildMicrofrontBatch}
      onRefresh={onRefresh}
      onMicrofrontDetail={onMicrofrontDetail}
      favorite={favorite}
      onFavorite={onFavorite}
    />
  );
}
