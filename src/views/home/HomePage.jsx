import { Icon } from "../../shared/components/Icon.jsx";
import { useHomeActions } from "./hooks/useHomeActions.js";
import { ProcessConsole } from "./components/ProcessConsole.jsx";

export function HomePage({
  state,
  buildLogs,
  environmentLogs,
  consoleTab,
  setConsoleTab,
  logEnd,
  componentVersion,
  componentsActive,
  environmentLabel,
  onNavigateToTags,
  onComponentStop,
  onComponentStart,
  onMicrofronts,
  onOpenBrowser,
  onOpenBrowserTab,
  onSelectShell,
  onStop,
  projects,
  clearLogs,
}) {
  const { onClear } = useHomeActions(clearLogs);

  const displayLogs = consoleTab === "build" ? buildLogs : environmentLogs;

  return (
    <>
      <section className="hero v2 compact-hero">
        <div>
          <p className="eyebrow">CENTRO DE OPERACIONES</p>
          <h1>
            Tu entorno local,
            <br />
            <em>bajo control.</em>
          </h1>
          <p className="hero-copy">
            Una shell, un servidor HTTP y los proyectos locales que abres en
            VS Code.
          </p>
        </div>
        <div className="summary-card compact-summary">
          <div className="summary-grid operational-summary">
            <div>
              <strong
                className={
                  state.session.status === "ready"
                    ? "green"
                    : state.execution?.status === "error"
                      ? "red"
                      : ""
                }
              >
                {environmentLabel}
              </strong>
              <span>Entorno</span>
            </div>
            <div>
              <strong title={state.shell.name || ""}>
                {state.shell.name || "Ninguna"}
              </strong>
              <span>Shell</span>
            </div>
          </div>
          <div className="component-core">
            <div className="component-core-title">
              <Icon name="package" size={15} />
              <span>MOVA Components</span>
            </div>
            <div>
              <small>VERSIÓN</small>
              <strong>
                {componentVersion?.version || "Sin seleccionar"}
              </strong>
            </div>
            <div>
              <small>ESTADO</small>
              <strong className={componentsActive ? "green" : ""}>
                {componentsActive
                  ? "Activo"
                  : "Se inicia con la shell"}
              </strong>
            </div>
            <button
              className="button ghost"
              onClick={onNavigateToTags}
            >
              <Icon name="tag" size={14} />
              Versiones
            </button>
            {componentsActive ? (
              <button
                className="button stop"
                disabled={state.components.external}
                onClick={onComponentStop}
              >
                <Icon name="stop" size={14} />
                {state.components.external ? "Externo" : "Detener"}
              </button>
            ) : (
              <button
                className="button primary"
                disabled={state.busy || !componentVersion?.cached}
                onClick={onComponentStart}
              >
                <Icon name="play" size={14} />
                Iniciar
              </button>
            )}
          </div>
          <div className="summary-session">
            <span
              className={`dot ${state.execution?.status === "error" ? "error" : state.session.status}`}
            />
            <div>
              <strong>
                {state.execution?.status === "error"
                  ? "El último inicio no se completó"
                  : state.session.message}
              </strong>
              <small>
                {state.execution?.status === "error"
                  ? state.execution.error
                  : state.shell.url || "Puerto 8080 disponible"}
              </small>
            </div>
            <div className="summary-actions">
              {state.shell.status === "running" && (
                <button
                  className="manage-microfronts"
                  onClick={() => onMicrofronts(
                    projects.find(
                      (project) => project.id === state.shell.projectId,
                    ) || null,
                  )}
                >
                  <Icon name="vscode" size={14} />
                  Microfronts
                </button>
              )}
              {state.shell.status === "running" && (
                <button
                  className="open-chrome"
                  onClick={onOpenBrowser}
                >
                  <Icon name="chrome" size={14} />
                  Nueva ventana
                </button>
              )}
              {state.shell.status === "running" && (
                <button
                  className="open-chrome-tab"
                  onClick={onOpenBrowserTab}
                >
                  <Icon name="external" size={14} />
                  Abrir pestaña
                </button>
              )}
              {state.session.status === "idle" &&
                state.shell.status === "stopped" && (
                  <button
                    className="select-shell"
                    onClick={onSelectShell}
                  >
                    <Icon name="layers" size={14} />
                    Seleccionar shell
                  </button>
                )}
              {state.session.status !== "idle" && (
                <button
                  disabled={state.session.status === "stopping"}
                  onClick={onStop}
                >
                  <Icon name="stop" size={14} />
                  {state.session.status === "stopping"
                    ? "Deteniendo…"
                    : state.session.status === "ready"
                      ? "Detener shell"
                      : "Detener inicio"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="view-panel home-view">
        <ProcessConsole
          logs={displayLogs}
          state={state}
          tab={consoleTab}
          onTab={setConsoleTab}
          onClear={onClear}
          logEnd={logEnd}
        />
      </div>
    </>
  );
}
