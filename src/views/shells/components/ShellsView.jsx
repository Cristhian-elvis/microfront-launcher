import { useEffect, useMemo, useState } from "react";
import { useProjects } from "../../../shared/hooks/useProjects.js";
import { Icon } from "../../../shared/components/Icon.jsx";
import { Modal } from "../../../shared/components/Modal.jsx";

function shellStatus(project, state) {
  const execution = state.execution || {};
  const isCurrentOperation = execution.projectId === project.id;
  const starting =
    isCurrentOperation &&
    execution.kind === "start" &&
    execution.status === "running";
  const failedStart =
    isCurrentOperation &&
    execution.kind === "start" &&
    execution.status === "error";
  const active =
    state.shell.projectId === project.id && state.shell.status === "running";
  if (starting)
    return { tone: "starting", label: "Iniciando", clickable: true };
  if (active) return { tone: "active", label: "Activa", clickable: true };
  if (failedStart) return { tone: "error", label: "Error", clickable: true };
  return { tone: "stopped", label: "Detenida", clickable: false };
}

function healthCheck(project, state, status) {
  const execution = state.execution || {};
  const isStartExecution =
    execution.projectId === project.id && execution.kind === "start";
  const steps = isStartExecution ? execution.steps || [] : [];
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
  if (status.tone === "active") {
    return { label: "Completado", tone: "active", clickable: true };
  }
  return { label: "—", tone: "stopped", clickable: false };
}

function StatusDetails({ project, state, onClose }) {
  const execution = state.execution || {};
  const isStartExecution =
    execution.projectId === project.id && execution.kind === "start";
  const steps = isStartExecution ? execution.steps || [] : [];
  const status = shellStatus(project, state);
  const errorStep = steps.find((step) => step.status === "error");
  const error = status.tone === "active" ? null : errorStep?.message || execution.error;
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
  state,
  favoriteIds,
  onRefresh,
  onFavorite,
  onStart,
  onStop,
  onAction,
  onMicrofronts,
  onDetails,
}) {
  const [statusProject, setStatusProject] = useState(null);
  const [search, setSearch] = useState("");
  const [startingProjectId, setStartingProjectId] = useState(null);
  const [stoppingProjectId, setStoppingProjectId] = useState(null);
  const [uiStartProjectId, setUiStartProjectId] = useState(null);
  useEffect(() => {
    if (
      state.execution?.kind === "start" &&
      state.execution?.status === "running" &&
      state.execution?.projectId
    ) {
      setUiStartProjectId(state.execution.projectId);
      return;
    }
    if (
      state.execution?.kind === "start" &&
      ["success", "error", "cancelled"].includes(state.execution?.status)
    ) {
      setUiStartProjectId(null);
      return;
    }
    if (state.shell?.status === "running" || state.shell?.status === "stopped") {
      setUiStartProjectId(null);
    }
  }, [
    state.execution?.kind,
    state.execution?.status,
    state.execution?.projectId,
    state.shell?.status,
  ]);

  const currentStartProjectId = useMemo(
    () => uiStartProjectId || startingProjectId,
    [uiStartProjectId, startingProjectId],
  );
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
                <th>Microfronts</th>
                <th>Estado de shell</th>
                <th>Chequeo de estado</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const own = state.shell.projectId === project.id;
                const isStartingCurrentProject = currentStartProjectId === project.id;
                const isActionLocked =
                  isStartingCurrentProject || stoppingProjectId === project.id;
                const disabled =
                  state.busy || (state.shell.status !== "stopped" && !own);
                const favorite = favoriteIds.includes(project.id);
                const status = shellStatus(project, state);
                const check = healthCheck(project, state, status);
                const hasSuccessfulStartForProject =
                  state.execution?.kind === "start" &&
                  state.execution?.projectId === project.id &&
                  state.execution?.status === "success";
                const shouldForceStartingVisual =
                  isStartingCurrentProject && !hasSuccessfulStartForProject;
                const displayStatus = shouldForceStartingVisual
                  ? { tone: "starting", label: "Iniciando", clickable: true }
                  : status;
                const displayCheck = shouldForceStartingVisual
                  ? {
                      label: "Iniciando...",
                      tone: "starting",
                      clickable: true,
                    }
                  : check;
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
                        className={`shell-state ${displayStatus.tone}`}
                        disabled={!displayStatus.clickable}
                        onClick={() => setStatusProject(project)}
                      >
                        <span className="shell-status-dot" />
                        {displayStatus.label}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`shell-health ${displayCheck.tone}`}
                        disabled={!displayCheck.clickable}
                        onClick={() => setStatusProject(project)}
                      >
                        {displayCheck.label}
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
                        {own && !isStartingCurrentProject ? (
                          <button
                            className="icon-button stop-action"
                            title={
                              stoppingProjectId === project.id
                                ? "Deteniendo..."
                                : "Detener entorno"
                            }
                            disabled={stoppingProjectId === project.id}
                            onClick={async () => {
                              if (stoppingProjectId === project.id) return;
                              setStoppingProjectId(project.id);
                              try {
                                await onStop();
                                setStartingProjectId(null);
                              } finally {
                                setStoppingProjectId(null);
                              }
                            }}
                          >
                            {stoppingProjectId === project.id ? (
                              <Icon name="loader" size={16} />
                            ) : (
                              <Icon name="stop" size={16} />
                            )}
                          </button>
                        ) : (
                          <button
                            className="icon-button primary-action"
                            title={
                              isStartingCurrentProject
                                ? "Iniciando shell..."
                                : project.configured
                                  ? "Iniciar shell"
                                  : "La shell requiere configuración"
                            }
                            disabled={disabled || !project.configured || isActionLocked}
                            onClick={async () => {
                              if (isActionLocked) return;
                              setStartingProjectId(project.id);
                              try {
                                await onStart(project);
                              } finally {
                                setStartingProjectId(null);
                                setUiStartProjectId(project.id);
                              }
                            }}
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
