import { useEffect, useMemo, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Icon } from "../../shared/components/Icon.jsx";
import { useHomeActions } from "./hooks/useHomeActions.js";
import { useActions } from "../../shared/hooks/useActions.js";
import { ProcessConsole } from "./components/ProcessConsole.jsx";
import "./HomePage.css";

export function HomePage({
  state,
  buildLogs,
  environmentLogs,
  logEnd,
  componentVersion,
  componentsActive,
  environmentLabel,
  versions,
  preferredTag,
  onSelectVersion,
  onStartShell,
  projects,
  clearLogs,
}) {
  const { onClear } = useHomeActions(clearLogs);
  const {
    onComponentStop,
    onComponentStart,
    onOpenBrowser,
    onEnvironmentStop,
  } = useActions();

  const [consoleTab, setConsoleTab] = useState("environment");
  const [selectedShellId, setSelectedShellId] = useState(
    () => localStorage.getItem("microfront-last-shell-id") || "",
  );
  const compiledVersions = useMemo(
    () => versions.filter((version) => version.cached),
    [versions],
  );
  const [selectedVersionTag, setSelectedVersionTag] = useState(preferredTag || "");

  useEffect(() => {
    const preferredVersionAvailable = compiledVersions.some(
      (version) => version.tag === preferredTag,
    );
    if (preferredVersionAvailable) {
      setSelectedVersionTag(preferredTag);
    } else if (!compiledVersions.some((version) => version.tag === selectedVersionTag)) {
      setSelectedVersionTag(compiledVersions[0]?.tag || "");
    }
  }, [compiledVersions, preferredTag, selectedVersionTag]);

  const displayLogs = consoleTab === "build" ? buildLogs : environmentLogs;
  const selectableProjects = useMemo(
    () => projects.filter((project) => project.configured),
    [projects],
  );
  const selectedShell = selectableProjects.find(
    (project) => project.id === selectedShellId,
  );
  const shellRunning = state.shell.status !== "stopped";

  useEffect(() => {
    const activeShellId = state.shell.projectId;
    if (activeShellId) {
      localStorage.setItem("microfront-last-shell-id", activeShellId);
      setSelectedShellId(activeShellId);
      return;
    }

    const savedShellIsAvailable = selectableProjects.some(
      (project) => project.id === selectedShellId,
    );
    if (!savedShellIsAvailable && selectedShellId) {
      setSelectedShellId("");
      localStorage.removeItem("microfront-last-shell-id");
    }
  }, [selectableProjects, selectedShellId, state.shell.projectId]);

  const handleVersionChange = (event) => {
    const nextVersionTag = event.target.value;
    setSelectedVersionTag(nextVersionTag);
    if (nextVersionTag && nextVersionTag !== preferredTag) {
      onSelectVersion(nextVersionTag);
    }
  };

  return (
    <>
      <section className="hero v2 compact-hero home-operation-hero">
        <div>
          <p className="eyebrow">CENTRO DE OPERACIONES</p>
          <h1>
            Tu entorno local,
            <br />
            <em>bajo control.</em>
          </h1>
          <p className="hero-copy">
            Gestiona las dependencias de MOVA y la shell de trabajo desde un
            único lugar.
          </p>
        </div>

        <div className="home-status-summary">
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
            <span>Shell activa</span>
          </div>
        </div>
      </section>

      <section className="home-operation-cards" aria-label="Operaciones">
        <article className="home-operation-card">
          <div className="home-operation-icon components">
            <Icon name="package" size={23} />
          </div>
          <div className="home-operation-copy">
            <small>DEPENDENCIA COMPARTIDA</small>
            <strong>MOVA Components</strong>
            {componentsActive && (
              <span>Componentes disponibles para la shell.</span>
            )}
          </div>
          <div className="home-version-control">
            <FormControl
              className="home-version-select"
              size="small"
              fullWidth
              disabled={!compiledVersions.length || state.busy || shellRunning}
            >
              <InputLabel id="home-mova-version-label">
                Versión para la shell
              </InputLabel>
              <Select
                labelId="home-mova-version-label"
                id="home-mova-version"
                label="Versión para la shell"
                value={selectedVersionTag}
                onChange={handleVersionChange}
                MenuProps={{
                  PaperProps: {
                    className: "home-version-menu",
                  },
                }}
              >
                {!compiledVersions.length && (
                  <MenuItem value="">No hay versiones compiladas</MenuItem>
                )}
                {compiledVersions.map((version) => (
                  <MenuItem key={version.tag} value={version.tag}>
                    {version.tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="home-operation-actions">
            {componentsActive && !state.busy && !shellRunning ? (
              <button
                className="button stop"
                disabled={state.components.external}
                onClick={onComponentStop}
              >
                <Icon name="stop" size={14} />
                {state.components.external ? "Externo" : "Detener"}
              </button>
            ) : (
              !state.busy &&
              !shellRunning && (
                <button
                  className="button primary"
                  disabled={!componentVersion?.cached}
                  onClick={onComponentStart}
                >
                  <Icon name="play" size={14} />
                  Iniciar
                </button>
              )
            )}
          </div>
        </article>

        <article
          className={`home-operation-card ${shellRunning ? "running without-control" : ""}`}
        >
          <div className="home-operation-icon shell">
            <Icon name="terminal" size={23} />
          </div>
          <div className="home-operation-copy">
            <small>ENTORNO DE TRABAJO</small>
            <strong>Shell</strong>
            <span>
              {shellRunning
                ? `${state.shell.name || "Shell"} se encuentra en ejecución.`
                : "Selecciona una shell configurada para iniciar."}
            </span>
          </div>
          {!shellRunning && (
            <FormControl
              className="home-shell-control"
              size="small"
              fullWidth
              disabled={state.busy || !selectableProjects.length}
            >
              <InputLabel id="home-shell-label">Shell a iniciar</InputLabel>
              <Select
                labelId="home-shell-label"
                id="home-shell"
                label="Shell a iniciar"
                value={selectedShellId}
                onChange={(event) => {
                  setSelectedShellId(event.target.value);
                }}
                MenuProps={{
                  PaperProps: {
                    className: "home-version-menu",
                  },
                }}
              >
                <MenuItem value="">Seleccionar shell…</MenuItem>
                {selectableProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <div className="home-operation-actions">
            {shellRunning ? (
              <>
                <button
                  className="button ghost"
                  onClick={() => onOpenBrowser("window")}
                >
                  <Icon name="chrome" size={14} />
                  Abrir ventana
                </button>
                <button
                  className="button ghost"
                  onClick={() => onOpenBrowser("tab")}
                >
                  <Icon name="chrome" size={14} />
                  Abrir pestaña
                </button>
                <button
                  className="button stop"
                  disabled={state.session.status === "stopping"}
                  onClick={onEnvironmentStop}
                >
                  <Icon name="stop" size={14} />
                  {state.session.status === "stopping"
                    ? "Deteniendo…"
                    : "Detener"}
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={state.busy || !selectedShell}
                onClick={() => onStartShell(selectedShell)}
              >
                <Icon name="play" size={14} />
                Iniciar
              </button>
            )}
          </div>
        </article>
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
