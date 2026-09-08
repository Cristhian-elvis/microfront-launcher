import { useCallback, useState } from 'react';
import { ShellDetailView } from './components/ShellDetailView.jsx';
import { useShellDetailActions } from './hooks/useShellDetailActions.js';
import { useFlash } from '../../shared/hooks/useFlash.js';
import { useProjects } from '../../shared/hooks/useProjects.js';
import { useAppNavigation } from '../../shared/hooks/useAppNavigation.js';
import { useAppPreferences } from '../../shared/hooks/useAppPreferences.js';

export function ShellDetailPage({
  state,
  onMicrofrontDetail,
}) {
  const { shellDetailId } = useAppNavigation();
  const { projects, refreshProjects, replaceProject } = useProjects();
  const project = projects.find(p => p.id === decodeURIComponent(shellDetailId));
  
  const appState = state || { preferences: {} };
  const { favoriteIds, toggleFavorite } = useAppPreferences(appState, async () => {});
  const favorite = favoriteIds.includes(decodeURIComponent(shellDetailId));
  const onFavorite = () => toggleFavorite(decodeURIComponent(shellDetailId));
  const [refreshing, setRefreshing] = useState(false);

  const { flash } = useFlash();
  const refreshState = useCallback(async () => {
    await refreshProjects();
  }, [refreshProjects]);

  const {
    onStart,
    onStop,
    onRebuild,
    onChangeMicrofrontBranch,
    onChangeMicrofrontBranchBatch,
    onBuildMicrofront,
    onBuildMicrofrontBatch,
    onRefresh: onRefreshAction,
    isStartingShell,
    isRebuilding,
  } = useShellDetailActions(flash, refreshProjects, refreshState);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await onRefreshAction(project.id, projects, replaceProject);
    } finally {
      setRefreshing(false);
    }
  }, [project?.id, onRefreshAction, projects, replaceProject]);

  return (
    <ShellDetailView
      project={project}
      state={state}
      refreshing={refreshing}
      rebuilding={isRebuilding}
      onStart={onStart}
      isStartingShell={isStartingShell}
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
