import { TagsTable } from './components/TagsTable.jsx';
import { useTagsActions } from './hooks/useTagsActions.js';

export function TagsPage({
  versions,
  build,
  busy,
  processes,
  preferredTag,
  flash,
  refreshState,
}) {
  const { onBuild } = useTagsActions(flash, refreshState);

  return (
    <TagsTable
      versions={versions}
      build={build}
      busy={busy}
      processes={processes}
      preferredTag={preferredTag}
      onBuild={onBuild}
    />
  );
}
