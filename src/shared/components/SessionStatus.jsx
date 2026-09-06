import React from "react";
import { Icon } from "./Icon.jsx";

export function SessionStatus({
  state,
  onMicrofronts,
  onOpenBrowser,
  onOpenBrowserTab,
  onSelectShell,
  onStop,
  projects,
}) {
  return (
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
            onClick={() =>
              onMicrofronts(
                projects.find(
                  (project) => project.id === state.shell.projectId,
                ) || null,
              )
            }
          >
            <Icon name="vscode" size={14} />
            Microfronts
          </button>
        )}
        {state.shell.status === "running" && (
          <button
            className="open-chrome"
            onClick={() => onOpenBrowser()}
          >
            <Icon name="chrome" size={14} />
            Nueva ventana
          </button>
        )}
        {state.shell.status === "running" && (
          <button
            className="open-chrome-tab"
            onClick={() => onOpenBrowserTab()}
          >
            <Icon name="external" size={14} />
            Abrir pestaña
          </button>
        )}
        {state.session.status === "idle" &&
          state.shell.status === "stopped" && (
            <button
              className="select-shell"
              onClick={() => onSelectShell()}
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
  );
}
