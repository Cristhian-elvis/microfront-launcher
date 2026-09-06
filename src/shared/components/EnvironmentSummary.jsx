import React from "react";
import { Icon } from "./Icon.jsx";

export function EnvironmentSummary({
  environmentLabel,
  shellName,
  componentVersion,
  componentsActive,
  state,
  onNavigateToTags,
  onComponentStop,
  onComponentStart,
}) {
  return (
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
          <strong title={shellName || ""}>
            {shellName || "Ninguna"}
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
    </div>
  );
}
