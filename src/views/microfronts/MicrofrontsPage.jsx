import { MicrofrontsView } from './components/MicrofrontsView.jsx';
import { useMicrofrontsActions } from './hooks/useMicrofrontsActions.js';

export function MicrofrontsPage({
  items,
  selectedId,
  search,
  favoriteIds,
  processes,
  onSearch,
  onClearSelection,
  onToggleFavorite,
  flash,
  refreshProjects,
}) {
  const {
    onOpen,
    onBuild,
    onRefresh,
  } = useMicrofrontsActions(flash, refreshProjects);

  return (
    <MicrofrontsView
      items={items}
      selectedId={selectedId}
      search={search}
      favoriteIds={favoriteIds}
      processes={processes}
      onSearch={onSearch}
      onClearSelection={onClearSelection}
      onToggleFavorite={onToggleFavorite}
      onOpen={onOpen}
      onBuild={onBuild}
      onRefresh={onRefresh}
    />
  );
}
