import { useState } from "react";
import { Icon } from "../../../shared/components/Icon.jsx";
import { Modal } from "../../../shared/components/Modal.jsx";

function shellStatus(project, state) {
  const execution = state.execution || {};
  const isCurrentOperation = execution.projectId === project.id;
  const starting = isCurrentOperation && execution.status === "running";
  const failed = isCurrentOperation && execution.status === "error";
  const active =
    state.shell.projectId === project.id && state.shell.status === "running";
  if (failed) return { tone: "error", label: "Error", clickable: true };
  if (starting)
    return { tone: "starting", label: "Iniciando", clickable: true };
  if (active) return { tone: "active", label: "Activa", clickable: true };
  return { tone: "stopped", label: "Detenida", clickable: false };
}

function healthCheck(project, state, status) {
  const execution = state.execution || {};
  const steps = execution.projectId === project.id ? execution.steps || [] : [];
  const completed = steps.filter((step) => step.status === "success").length;
  if (status.tone === "error")
    return {
      label: `${completed}/${steps.length} pasos completados · Falló al iniciar`,
      tone: "error",
      clickable: true,
    };
  if (status.tone === "starting")
    return {
      label: `${completed}/${steps.length} pasos completados`,
      tone: "starting",
      clickable: true,
    };
  if (status.tone === "active")
    return {
      label: `${steps.length}/${steps.length} comprobaciones correctas`,
      tone: "active",
      clickable: true,
    };
  return { label: "—", tone: "stopped", clickable: false };
}

function StatusDetails({ project, state, onClose }) {
  const execution = state.execution || {};
  const steps = execution.projectId === project.id ? execution.steps || [] : [];
  const status = shellStatus(project, state);
  const errorStep = steps.find((step) => step.status === "error");
  const error = errorStep?.message || execution.error;
  return (
    <Modal
      title={`Chequeo de estado · ${project.name.toUpperCase()}`}
      subtitle="Estado y pasos del último inicio de esta shell."
      onClose={onClose}
      width={620}
    >
      <div className="modal-body shell-status-details">
        <div className={`shell-status-summary ${status.tone}`}>
          <span className="shell-status-dot" />
          <div>
            <strong>{status.label}</strong>
            <small>
              {status.tone === "error"
                ? "La shell no llegó a estar disponible."
                : status.tone === "active"
                  ? "La shell está disponible."
                  : "El inicio está en curso."}
            </small>
          </div>
        </div>
        {error && (
          <div className="shell-status-error">
            <Icon name="alert" size={16} />
            <div>
              <strong>Falló al iniciar</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        <div className="shell-check-list">
          {steps.map((step, index) => (
            <div className={`shell-check-step ${step.status}`} key={step.id}>
              <i>
                {step.status === "success" ? (
                  <Icon name="check" size={13} />
                ) : step.status === "error" ? (
                  <Icon name="close" size={13} />
                ) : step.status === "running" ? (
                  <span className="trace-spinner" />
                ) : (
                  index + 1
                )}
              </i>
              <div>
                <strong>{step.command}</strong>
                {step.message && <small>{step.message}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="modal-actions">
        <button className="button ghost" onClick={onClose}>
          Cerrar
        </button>
      </footer>
    </Modal>
  );
}

export function ShellsView({
  projects,
  search,
  state,
  favoriteIds,
  onSearch,
  onRefresh,
  onFavorite,
  onStart,
  onStop,
  onAction,
  onMicrofronts,
  onDetails,
}) {
  const [statusProject, setStatusProject] = useState(null);
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
                onChange={(event) => onSearch(event.target.value)}
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
                <th>Microfronts</th>
                <th>Estado de shell</th>
                <th>Chequeo de estado</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const own = state.shell.projectId === project.id;
                const disabled =
                  state.busy || (state.shell.status !== "stopped" && !own);
                const favorite = favoriteIds.includes(project.id);
                const status = shellStatus(project, state);
                const check = healthCheck(project, state, status);
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
                        {project.microfrontends?.length || 0}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`shell-state ${status.tone}`}
                        disabled={!status.clickable}
                        onClick={() => setStatusProject(project)}
                      >
                        <span className="shell-status-dot" />
                        {status.label}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`shell-health ${check.tone}`}
                        disabled={!check.clickable}
                        onClick={() => setStatusProject(project)}
                      >
                        {check.label}
                      </button>
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
                        <button
                          className="icon-button"
                          title="Ver microfronts"
                          onClick={() => onMicrofronts(project)}
                        >
                          <Icon name="list" size={16} />
                        </button>
                        {own && (
                          <button
                            className="icon-button"
                            title="Abrir webapp"
                            onClick={() =>
                              onAction("/api/chrome/open", { mode: "tab" })
                            }
                          >
                            <Icon name="external" size={16} />
                          </button>
                        )}
                        {own ? (
                          <button
                            className="icon-button stop-action"
                            title="Detener entorno"
                            onClick={onStop}
                          >
                            <Icon name="stop" size={16} />
                          </button>
                        ) : (
                          <button
                            className="icon-button primary-action"
                            title={
                              project.configured
                                ? "Iniciar shell"
                                : "La shell requiere configuración"
                            }
                            disabled={disabled || !project.configured}
                            onClick={() => onStart(project)}
                          >
                            <Icon name="play" size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {statusProject && (
        <StatusDetails
          project={statusProject}
          state={state}
          onClose={() => setStatusProject(null)}
        />
      )}
    </div>
  );
}
