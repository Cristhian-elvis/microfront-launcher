import { useEffect, useMemo, useState } from "react";
import {
  Button,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
} from "@mui/material";
import { Icon } from "../../shared/components/Icon.jsx";
import { useHomeActions } from "./hooks/useHomeActions.js";
import { useActions } from "../../shared/hooks/useActions.js";
import { ProcessConsole } from "./components/ProcessConsole.jsx";
import { projectDisplayName } from "../../lib/projects.js";
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
  const [selectedVersionTag, setSelectedVersionTag] = useState(preferredTag || "");

  useEffect(() => {
    const preferredVersionAvailable = versions.some(
      (version) => version.tag === preferredTag,
    );
    if (preferredVersionAvailable) {
      setSelectedVersionTag(preferredTag);
    } else if (!versions.some((version) => version.tag === selectedVersionTag)) {
      setSelectedVersionTag("");
    }
  }, [preferredTag, selectedVersionTag, versions]);

  const selectedVersion = versions.find(
    (version) => version.tag === selectedVersionTag,
  );
  const compiledVersions = versions.filter((version) => version.cached);
  const pendingVersions = versions.filter((version) => !version.cached);

  const displayLogs = consoleTab === "build" ? buildLogs : environmentLogs;
  const selectableProjects = useMemo(
    () => projects.filter((project) => project.configured),
    [projects],
  );
  const selectedShell = selectableProjects.find(
    (project) => project.id === selectedShellId,
  );
  const shellRunning = state.shell.status !== "stopped";
  const shellReady = state.shell.status === "running";
  const shellStarting = state.shell.status === "starting";

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
    if (nextVersionTag !== preferredTag) {
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
              {projectDisplayName(state.shell.name)}
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
              disabled={!versions.length || state.busy || shellRunning}
            >
              <InputLabel id="home-mova-version-label">
                Versión
              </InputLabel>
              <Select
                labelId="home-mova-version-label"
                id="home-mova-version"
                label="Versión"
                value={selectedVersionTag}
                onChange={handleVersionChange}
                MenuProps={{
                  PaperProps: {
                    className: "home-version-menu",
                  },
                }}
              >
                {!versions.length && (
                  <MenuItem value="">No hay tags disponibles</MenuItem>
                )}
                {compiledVersions.length > 0 && (
                  <ListSubheader>Versiones compiladas</ListSubheader>
                )}
                {compiledVersions.map((version) => (
                  <MenuItem key={version.tag} value={version.tag}>
                    {version.tag}
                  </MenuItem>
                ))}
                {pendingVersions.length > 0 && (
                  <ListSubheader>Versiones por compilar</ListSubheader>
                )}
                {pendingVersions.map((version) => (
                  <MenuItem key={version.tag} value={version.tag}>
                    {version.tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="home-operation-actions">
            {componentsActive && !shellRunning ? (
              <button
                className="button stop"
                disabled={state.components.external}
                onClick={onComponentStop}
              >
                <Icon name="stop" size={14} />
                {state.components.external ? "Externo" : "Detener"}
              </button>
            ) : (
              !shellRunning && (
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  className="button primary"
                  disabled={!componentVersion}
                  onClick={onComponentStart}
                  startIcon={<Icon name="play" size={14} />}
                >
                  Iniciar
                </Button>
              )
            )}
          </div>
        </article>

        <article
          className={`home-operation-card ${shellReady ? "running without-control" : ""}`}
        >
          <div className="home-operation-icon shell">
            <Icon name="terminal" size={23} />
          </div>
          <div className="home-operation-copy">
            <small>ENTORNO DE TRABAJO</small>
            <strong>Shell</strong>
            <span>
              {shellReady
                ? `${projectDisplayName(state.shell.name)} se encuentra en ejecución.`
                : shellStarting
                  ? `${projectDisplayName(state.shell.name)} se está iniciando.`
                  : "Selecciona un proyecto configurado para iniciar."}
            </span>
          </div>
          {!shellReady && (
            <FormControl
              className="home-shell-control"
              size="small"
              fullWidth
              disabled={
                state.busy || shellStarting || !selectableProjects.length
              }
            >
              <InputLabel id="home-shell-label">Proyecto</InputLabel>
              <Select
                labelId="home-shell-label"
                id="home-shell"
                label="Proyecto"
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
                <MenuItem value="">Seleccionar proyecto…</MenuItem>
                {selectableProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {projectDisplayName(project.name)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <div className="home-operation-actions">
            {shellReady ? (
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
              <Button
                variant="contained"
                disableElevation
                size="small"
                className="button primary"
                disabled={
                  !selectedShell || !selectedVersion
                }
                onClick={() => onStartShell(selectedShell)}
                startIcon={<Icon name="play" size={14} />}
              >
                {shellStarting ? "Iniciando..." : "Iniciar"}
              </Button>
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
