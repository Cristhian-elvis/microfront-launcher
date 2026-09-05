import { Icon } from "../../../shared/components/Icon.jsx";
import { microfrontKey } from "../../../lib/microfronts.js";

export function MicrofrontDirectory({
  items,
  favoriteIds,
  processes,
  onToggleFavorite,
  onOpen,
  onOpenFolder,
  onBuild,
}) {
  if (!items.length)
    return (
      <div className="microfront-empty">
        No hay microfronts locales detectados.
      </div>
    );
  return (
    <div className="microfront-directory">
      <table>
        <thead>
          <tr>
            <th>Favorito</th>
            <th>Microfront</th>
            <th>Proyecto</th>
            <th className="actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ project, ...microfrontend }) => {
            const id = microfrontKey(project.id, microfrontend.id);
            const favorite = favoriteIds.includes(id);
            const building = processes.some(
              (process) =>
                process.key ===
                `microfrontend-build:${project.id}:${microfrontend.id}`,
            );
            return (
              <tr key={id}>
                <td className="favorite-column">
                  <button
                    className={`icon-button ${favorite ? "favorite" : ""}`}
                    title={
                      favorite ? "Quitar de favoritos" : "Agregar a favoritos"
                    }
                    onClick={() => onToggleFavorite(id)}
                  >
                    <Icon name="star" size={16} />
                  </button>
                </td>
                <td>
                  <div className="microfront-table-name">
                    <strong>{microfrontend.name}</strong>
                  </div>
                </td>
                <td>
                  <span className="project-tag">
                    {project.name.split("_")[0].toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="microfront-directory-actions">
                    <button
                      className="icon-button"
                      title="Abrir carpeta del microfront"
                      onClick={() => onOpenFolder(project, microfrontend)}
                    >
                      <Icon name="folder" size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title="Abrir en VS Code"
                      onClick={() => onOpen(project, microfrontend)}
                    >
                      <Icon name="vscode" size={16} />
                    </button>
                    {microfrontend.buildAvailable ? (
                      <button
                        className="icon-button"
                        title={building ? "Compilando…" : "Compilar"}
                        disabled={building}
                        onClick={() => onBuild(project, microfrontend)}
                      >
                        {building ? (
                          <span className="trace-spinner" />
                        ) : (
                          <Icon name="play" />
                        )}
                      </button>
                    ) : (
                      <span className="microfront-unavailable">
                        No define <code>npm run build</code>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
