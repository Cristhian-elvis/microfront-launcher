import { Icon } from "../../../shared/components/Icon.jsx";

function tagState(item, build) {
  if (build?.tag === item.tag && build.status === "building") {
    return {
      tone: "starting",
      compilation: "Sin compilar",
      check: build.message || "Compilación en curso",
    };
  }
  if (build?.tag === item.tag && build.status === "error") {
    return {
      tone: "error",
      compilation: "Sin compilar",
      check: build.message || "Falló la compilación",
    };
  }
  if (item.cached) {
    return {
      tone: "active",
      compilation: "Compilado",
      check: item.preferred ? "Versión seleccionada" : "Build disponible",
    };
  }
  return {
    tone: "stopped",
    compilation: "Sin compilar",
    check: "No hay un proceso ejecutado",
  };
}

function buildProcessState(item, build, processes) {
  const activeProcess = processes.find((process) =>
    process.key.startsWith("build:"),
  );
  if (build?.tag === item.tag && build.status === "building") {
    const steps = {
      "build:clone": "Clonando repositorio",
      "build:checkout": "Obteniendo tag",
      "build:install": "Instalando dependencias",
      "build:compile": "Compilando librería",
    };
    return {
      tone: "starting",
      check: steps[activeProcess?.key] || "Preparando compilación",
    };
  }
  if (build?.tag === item.tag && build.status === "error") {
    return {
      tone: "error",
      check: build.message || "La compilación falló",
    };
  }
  return { tone: "stopped", check: "—" };
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function TagsTable({
  versions,
  build,
  busy,
  processes = [],
  onBuild,
  onRefreshTags,
  refreshing,
  preferredTag,
}) {
  return (
    <div className="view-panel tags-view">
      <section className="workspace">
        <div className="shell-directory tags-directory">
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Fecha</th>
                <th>Estado de compilación</th>
                <th>Chequeo de proceso</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 ? (
                <tr>
                  <td className="tags-empty-cell" colSpan="5">
                    <div className="tags-empty-state">
                      <Icon name="tag" size={22} />
                      <div>
                        <strong>No hay tags MOVA disponibles</strong>
                        <p>
                          Verifica que la ruta configurada apunte al repositorio
                          MOVA o sincroniza sus tags desde el remoto.
                        </p>
                      </div>
                      <button
                        className="button ghost"
                        disabled={refreshing || busy}
                        onClick={onRefreshTags}
                      >
                        <Icon name="refresh" size={14} />
                        {refreshing ? "Actualizando…" : "Actualizar tags"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                versions.map((item) => {
                  const status = tagState(item, build);
                  const process = buildProcessState(item, build, processes);
                  return (
                    <tr
                      key={item.tag}
                      className={item.tag === preferredTag ? "in-use" : ""}
                    >
                      <td>
                        <div className="tag-table-name">
                          <Icon name="tag" size={15} />
                          <div className="tag-name-line">
                            <strong>{item.tag}</strong>
                            {item.tag === preferredTag && (
                              <small className="tag-in-use-label">En uso</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="tag-date">{formatDate(item.date)}</td>
                      <td>
                        <span className={`tag-state ${status.tone}`}>
                          <i />
                          {status.compilation}
                        </span>
                      </td>
                      <td>
                        <span className={`shell-health ${process.tone}`}>
                          {process.check}
                        </span>
                      </td>
                      <td className="tag-actions-cell">
                        <button
                          className="button ghost tag-row-action"
                          disabled={busy}
                          onClick={() => onBuild(item.tag)}
                        >
                          <Icon name="play" size={14} />
                          {item.cached ? "Recompilar" : "Compilar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
