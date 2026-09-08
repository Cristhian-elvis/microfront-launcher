import { useState } from "react";
import { Icon } from "../../../shared/components/Icon.jsx";
import { MicrofrontDirectory } from "./MicrofrontDirectory.jsx";
import { microfrontKey } from "../../../lib/microfronts.js";
import { api } from "../../../lib/api.js";
import { useSearchParams } from "react-router-dom";

export function MicrofrontsView({
  items,
  selectedId,
  favoriteIds,
  processes,
  onClearSelection,
  onToggleFavorite,
  onOpen,
  onOpenFolder = (project, microfrontend) =>
    api("/api/microfrontends/open-folder", {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    }),
  onBuild,
}) {
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const selected = items.find(
    ({ project, id }) => microfrontKey(project.id, id) === selectedId,
  );
  const selectedProject = items.find(
    ({ project }) => project.id === projectId,
  )?.project;
  const query = search.trim().toLowerCase();
  const visibleItems = items.filter(({ project, ...microfrontend }) => {
    const matchesSelection =
      (!selectedId ||
        microfrontKey(project.id, microfrontend.id) === selectedId) &&
      (!projectId || project.id === projectId);
    const matchesSearch =
      !query ||
      `${microfrontend.name} ${project.name} ${microfrontend.path}`
        .toLowerCase()
        .includes(query);
    return matchesSelection && matchesSearch;
  });

  return (
    <div className="view-panel microfronts-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <h2>Microfronts disponibles</h2>
            <p>
              {selected
                ? `Mostrando: ${selected.name} · ${selected.project.name}`
                : selectedProject
                  ? `Microfronts de la shell: ${selectedProject.name}`
                  : "Todos los microfronts locales detectados, agrupados por shell."}
            </p>
          </div>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar microfront o shell..."
              />
            </div>
            {(selected || selectedProject) && (
              <button className="button ghost" onClick={onClearSelection}>
                <Icon name="close" />
                Ver todos
              </button>
            )}
          </div>
        </div>
        <MicrofrontDirectory
          items={visibleItems}
          favoriteIds={favoriteIds}
          processes={processes}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpen}
          onOpenFolder={onOpenFolder}
          onBuild={onBuild}
        />
      </section>
    </div>
  );
}
