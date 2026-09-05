import { useEffect, useState } from "react";
import { Icon } from "../../../shared/components/Icon.jsx";

export function ProcessConsole({ logs, state, onClear, logEnd, tab, onTab }) {
  const isBuild = tab === "build";
  const [sourceTab, setSourceTab] = useState("all");
  const [flowVisible, setFlowVisible] = useState(true);
  const sources = [...new Set(logs.map((log) => log.source))];
  const visibleLogs =
    sourceTab === "all" ? logs : logs.filter((log) => log.source === sourceTab);
  useEffect(() => {
    if (sourceTab !== "all" && !sources.includes(sourceTab))
      setSourceTab("all");
  }, [tab, sourceTab, sources.join("|")]);
  useEffect(() => {
    setFlowVisible(true);
  }, [state.execution?.startedAt]);
  const activeStep = state.execution?.steps?.find(
    (step) => step.status === "running",
  );
  const currentIndex = activeStep
    ? state.execution.steps.findIndex((step) => step.id === activeStep.id) + 1
    : 0;
  const total = state.execution?.steps?.length || 0;
  const status = isBuild
    ? state.build?.status === "building"
      ? "running"
      : state.build?.status || "idle"
    : state.execution?.status === "error"
      ? "error"
      : state.session.status === "ready"
        ? "ready"
        : state.session.status === "stopping"
          ? "stopping"
          : ["starting", "building"].includes(state.session.status)
            ? "running"
            : "idle";
  const summary = isBuild
    ? state.build?.message
    : state.execution?.status === "error"
      ? state.execution.error
      : activeStep
        ? `Paso ${currentIndex} de ${total}: ${activeStep.label}`
        : state.session.message;
  const iconFor = (level) =>
    level === "success"
      ? "check"
      : level === "error"
        ? "close"
        : level === "stage"
          ? "layers"
          : null;
  const executionFlow =
    !isBuild && flowVisible && state.execution?.steps?.length;
  const statusBlock = (
    <div className={`console-status ${status}`}>
      <i>
        {status === "error" ? (
          <Icon name="alert" size={15} />
        ) : status === "ready" || status === "success" ? (
          <Icon name="check" size={15} />
        ) : status === "idle" ? (
          <Icon name="terminal" size={15} />
        ) : status === "stopping" ? (
          <Icon name="stop" size={15} />
        ) : (
          <span className="trace-spinner" />
        )}
      </i>
      <div>
        <strong>
          {status === "error"
            ? "El proceso se detuvo con un error"
            : status === "ready"
              ? "Entorno disponible"
              : status === "success"
                ? "Compilación completada"
                : status === "stopping"
                  ? "Deteniendo entorno"
                  : status === "idle"
                    ? "En espera"
                    : isBuild
                      ? "Compilando versión"
                      : "Proceso en curso"}
        </strong>
        <span>{summary}</span>
      </div>
    </div>
  );
  const flowTitle =
    state.execution.kind === "stop"
      ? "Deteniendo entorno"
      : state.execution.kind === "rebuild"
        ? "Reconstruyendo servidor"
        : "Iniciando entorno";
  return (
    <section className="console-panel integrated-console">
      <div className="console-head">
        <div>
          <Icon name="terminal" />
          <strong>Consola de proceso</strong>
          <span>{logs.length} eventos</span>
        </div>
        <div className="console-tools">
          <button
            onClick={() => {
              setFlowVisible(false);
              onClear();
            }}
          >
            Limpiar vista
          </button>
        </div>
      </div>
      <div className="console-tabs">
        <button
          className={tab === "environment" ? "active" : ""}
          onClick={() => onTab("environment")}
        >
          Entorno
        </button>
        <button
          className={tab === "build" ? "active" : ""}
          onClick={() => onTab("build")}
        >
          Versiones MOVA{state.buildBusy && <i />}
        </button>
      </div>
      {isBuild && sources.length > 1 && (
        <div className="console-source-tabs">
          <button
            className={sourceTab === "all" ? "active" : ""}
            onClick={() => setSourceTab("all")}
          >
            Todos
          </button>
          {sources.map((source) => (
            <button
              className={sourceTab === source ? "active" : ""}
              onClick={() => setSourceTab(source)}
              key={source}
            >
              {source}
            </button>
          ))}
        </div>
      )}
      {executionFlow ? (
        <div className="console-flow">
          <header>
            <strong>{flowTitle}</strong>
            <span>{state.execution.steps.length} pasos</span>
          </header>
          <div className="console-flow-steps">
            {state.execution.steps.map((step, index) => (
              <div className={`console-flow-step ${step.status}`} key={step.id}>
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
                <strong>{step.command}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        statusBlock
      )}
      <div className="console-body">
        {visibleLogs.length ? (
          visibleLogs.slice(-250).map((log) => (
            <div className={`log-line ${log.level}`} key={log.id}>
              <time>{new Date(log.at).toLocaleTimeString()}</time>
              <i>
                {iconFor(log.level) && (
                  <Icon name={iconFor(log.level)} size={13} />
                )}
              </i>
              <div>
                <b>{log.source}</b>
                <p>{log.message}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="console-empty">
            {isBuild
              ? "Aquí se mostrarán las actualizaciones y compilaciones de MOVA."
              : "Aquí se mostrarán las acciones y resultados del entorno."}
          </div>
        )}
        <div ref={logEnd} />
      </div>
    </section>
  );
}
