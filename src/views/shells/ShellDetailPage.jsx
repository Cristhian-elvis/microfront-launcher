import { useCallback, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ShellDetailView } from './components/ShellDetailView.jsx';
import { useShellDetailActions } from './hooks/useShellDetailActions.js';
import { useFlash } from '../../shared/hooks/useFlash.js';
import { useProjects } from '../../shared/hooks/useProjects.js';
import { useAppPreferences } from '../../shared/hooks/useAppPreferences.js';

export function ShellDetailPage({
  state,
  onMicrofrontDetail,
}) {
  const { shellId } = useParams();
  const decodedShellId = decodeURIComponent(shellId || '');
  const { projects, refreshProjects, replaceProject } = useProjects();
  const project = projects.find(p => p.id === decodedShellId);

  const appState = state || { preferences: {} };
  const { favoriteIds, toggleFavorite } = useAppPreferences(appState, async () => {});
  const favorite = favoriteIds.includes(decodedShellId);
  const onFavorite = () => toggleFavorite(decodedShellId);
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

  if (!project) {
    if (projects.length === 0) {
      return (
        <div className="boot-screen">
          <div className="loader" />
          <p>Cargando proyecto...</p>
        </div>
      );
    }
    return <Navigate to="/shells" replace />;
  }

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
