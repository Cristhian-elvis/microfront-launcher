import { useState } from "react";
import { Icon } from "../../../shared/components/Icon.jsx";

function shellStatus(project, state) {
  const execution = state.execution || {};
  const isCurrentStart =
    execution.projectId === project.id &&
    execution.kind === "start" &&
    execution.status === "running";
  const active =
    state.shell.projectId === project.id && state.shell.status === "running";

  if (isCurrentStart) return { tone: "starting", label: "Iniciando" };
  if (active) return { tone: "active", label: "Activa" };
  return { tone: "stopped", label: "Detenida" };
}

export function ShellsView({
  projects,
  state,
  favoriteIds,
  onRefresh,
  onFavorite,
  onDetails,
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="view-panel shells-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <h2>Shells disponibles</h2>
            <p>Solo puede estar ejecutándose una shell a la vez.</p>
          </div>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar shell o microfrontend..."
              />
            </div>
            <button className="button ghost" onClick={onRefresh}>
              <Icon name="refresh" />
              Actualizar
            </button>
          </div>
        </div>
        <div className="shell-directory">
          <table>
            <thead>
              <tr>
                <th>Favorito</th>
                <th>Proyecto</th>
                <th>Webapp</th>
                <th>Estado de shell</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const favorite = favoriteIds.includes(project.id);
                const status = shellStatus(project, state);

                return (
                  <tr key={project.id}>
                    <td className="favorite-column">
                      <button
                        className={`icon-button ${favorite ? "favorite" : ""}`}
                        title={
                          favorite
                            ? "Quitar de favoritos"
                            : "Agregar a favoritos"
                        }
                        onClick={() => onFavorite(project.id)}
                      >
                        <Icon name="star" size={16} />
                      </button>
                    </td>
                    <td>
                      <div className="shell-table-name">
                        <strong>{project.name.toUpperCase()}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="project-tag">
                        {project.configFolder || "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`shell-state ${status.tone}`}>
                        <span className="shell-status-dot" />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <div className="shell-directory-actions">
                        <button
                          className="icon-button"
                          title="Ver detalle"
                          onClick={() => onDetails(project)}
                        >
                          <Icon name="settings" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
