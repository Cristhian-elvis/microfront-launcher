import { useState } from "react";
import Button from "@mui/material/Button";
import { Icon } from "../../shared/components/Icon.jsx";
import { TagsTable } from "./components/TagsTable.jsx";
import { useTagsActions } from "./hooks/useTagsActions.js";
import "./TagsPage.css";

export function TagsPage({
  versions,
  build,
  busy,
  processes,
  preferredTag,
  flash,
  refreshState,
  refreshVersions,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const { onBuild, onRefreshTags } = useTagsActions(
    flash,
    refreshState,
    refreshVersions,
  );

  const refreshTags = async () => {
    setRefreshing(true);
    try {
      await onRefreshTags();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="tags-page">
      <header className="tags-page-header">
        <div>
          <h2>Tags de MOVA</h2>
          <p className="tags-page-description">
            Consulta las versiones disponibles en tu repositorio local y
            compila la que quieras usar en las shells.
          </p>
        </div>
        <div className="tags-page-actions">
          <span className="tags-count">
            {versions.length}{" "}
            {versions.length === 1 ? "tag disponible" : "tags disponibles"}
          </span>
          <Button
            className="tags-refresh-button"
            variant="outlined"
            onClick={refreshTags}
            disabled={refreshing || busy}
            startIcon={
              refreshing ? (
                <span className="trace-spinner" />
              ) : (
                <Icon name="refresh" size={16} />
              )
            }
          >
            {refreshing ? "Actualizando…" : "Actualizar tags"}
          </Button>
        </div>
      </header>
      <TagsTable
        versions={versions}
        build={build}
        busy={busy}
        processes={processes}
        preferredTag={preferredTag}
        onBuild={onBuild}
        onRefreshTags={refreshTags}
        refreshing={refreshing}
      />
    </div>
  );
}
