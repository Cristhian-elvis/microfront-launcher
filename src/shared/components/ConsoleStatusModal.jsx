import React, { useMemo } from "react";
import { Modal } from "./Modal.jsx";
import { Icon } from "./Icon.jsx";

function statusLabel(status) {
  if (!status) return "Desconocido";
  if (status === "running") return "En ejecución";
  if (status === "starting") return "Iniciando";
  if (status === "stopped") return "Detenido";
  if (status === "error") return "Error";
  if (status === "idle") return "En espera";
  if (status === "building") return "Compilando";
  if (status === "stopping") return "Deteniendo";
  return status;
}

function statusKind(status) {
  if (!status) return "idle";
  if (status === "running") return "success";
  if (status === "error") return "error";
  if (status === "stopped") return "idle";
  return "stage";
}

function Row({ title, status, detail }) {
  const kind = statusKind(status);
  return (
    <div className={`console-status-row ${kind}`}>
      <div className="console-status-row__title">
        <Icon
          name={
            kind === "success"
              ? "check"
              : kind === "error"
                ? "alert"
                : kind === "idle"
                  ? "stop"
                  : "layers"
          }
          size={16}
        />
        <strong>{title}</strong>
      </div>
      <div className="console-status-row__status">
        <span>{statusLabel(status)}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}

/**
 * Modal global de “estado de consola”.
 * Objetivo: mostrar procesos corriendo (estado), no el log stream completo.
 *
 * NOTA: no depende de HomePage; es reutilizable desde cualquier vista.
 */
export function ConsoleStatusModal({ state, onClose }) {
  const processes = state?.processes || [];

  const running = useMemo(
    () => processes.filter((p) => p.status === "running"),
    [processes],
  );

  const summary =
    running.length > 0
      ? `${running.length} proceso(s) en ejecución`
      : "No hay procesos en ejecución";

  return (
    <Modal
      title="Consola"
      subtitle={summary}
      onClose={onClose}
      width={820}
    >
      <div className="modal-body">
        <Row
          title="MOVA Components"
          status={state?.components?.status}
          detail={state?.components?.tag ? `Tag: ${state.components.tag}` : ""}
        />
        <Row
          title="Shell"
          status={state?.shell?.status}
          detail={state?.shell?.name ? state.shell.name : ""}
        />
        <Row
          title="Microfrontend"
          status={state?.microfrontend?.status}
          detail={state?.microfrontend?.name ? state.microfrontend.name : ""}
        />

        <div className="console-processes-block">
          <div className="console-processes-head">
            <strong>Procesos</strong>
            <span>{processes.length}</span>
          </div>

          {processes.length ? (
            <div className="console-processes-list">
              {processes.map((proc) => (
                <div className="console-process" key={proc.key || proc.id}>
                  <div className="console-process__main">
                    <strong>{proc.label || proc.key || "Proceso"}</strong>
                    <span className={`pill ${proc.status}`}>
                      {statusLabel(proc.status)}
                    </span>
                  </div>
                  <div className="console-process__detail">
                    {proc.pid ? <small>PID: {proc.pid}</small> : null}
                    {proc.cwd ? <small>CWD: {proc.cwd}</small> : null}
                    {proc.url ? <small>URL: {proc.url}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="console-empty">
              Aquí se mostrarán los procesos administrados por el launcher.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
