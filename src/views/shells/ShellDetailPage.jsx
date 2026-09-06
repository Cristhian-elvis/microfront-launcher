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
  const { projects } = useProjects();
  const project = projects.find(p => p.id === decodeURIComponent(shellDetailId));
  
  const appState = state || { preferences: {} };
  const { favoriteIds, toggleFavorite } = useAppPreferences(appState, async () => {});
  const favorite = favoriteIds.includes(decodeURIComponent(shellDetailId));
  const onFavorite = () => toggleFavorite(decodeURIComponent(shellDetailId));
  const [refreshing, setRefreshing] = useState(false);

  const { flash } = useFlash();
  const { refreshProjects } = useProjects();
  // Obtener refreshState del contexto (simulado aquí)
  const refreshState = useCallback(async () => {
    // Esta función permanece como prop si viene del contexto global
    // Por ahora se mantiene similar
  }, []);

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
  } = useShellDetailActions(flash, refreshProjects, refreshState);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await onRefreshAction(project.id, [project], () => {});
    } finally {
      setRefreshing(false);
    }
  }, [project.id, onRefreshAction]);

  return (
    <ShellDetailView
      project={project}
      state={state}
      refreshing={refreshing}
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
