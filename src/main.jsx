import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { api } from "./lib/api.js";
import { Icon } from "./shared/components/Icon.jsx";
import { Field, Modal } from "./shared/components/Modal.jsx";
import { HomePage } from "./views/home/HomePage.jsx";
import { Sidebar } from "./shared/components/Sidebar.jsx";
import { MicrofrontsPage } from "./views/microfronts/MicrofrontsPage.jsx";
import { ShellsPage } from "./views/shells/ShellsPage.jsx";
import { ShellDetailPage } from "./views/shells/ShellDetailPage.jsx";
import { ProjectCard } from "./views/shells/components/ProjectCard.jsx";
import { TagsPage } from "./views/tags/TagsPage.jsx";
import { AppBreadcrumbs } from "./shared/components/AppBreadcrumbs.jsx";
import { GlobalSettings } from "./views/settings/components/GlobalSettings.jsx";
import { InitialSetup } from "./views/setup/components/InitialSetup.jsx";
import { flattenMicrofronts } from "./lib/microfronts.js";
import { useLauncherEvents } from "./shared/hooks/useLauncherEvents.js";
import { useShellProjects } from "./views/shells/hooks/useShellProjects.js";
import { useMovaVersions } from "./views/tags/hooks/useMovaVersions.js";
import { useProcessLogs } from "./views/home/hooks/useProcessLogs.js";
import "./styles.css";

function ProjectEditor({ project, defaults, onClose, onSaved }) {
  const [form, setForm] = useState(
    project || {
      name: "",
      path: "",
      command: defaults?.shellDefaults?.command || "npm start",
      url: defaults?.shellDefaults?.url || "http://localhost:4200",
      detected: false,
    },
  );
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal
      title={project ? "Configurar shell" : "Agregar shell"}
      subtitle="Los valores detectados pueden personalizarse sin modificar el repositorio."
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          <Field
            label="Nombre"
            value={form.name}
            onChange={set("name")}
            required
          />
          <Field
            label="Carpeta"
            value={form.path}
            onChange={set("path")}
            required
          />
          <div className="two-columns">
            <Field
              label="Comando"
              value={form.command}
              onChange={set("command")}
              required
            />
            <Field
              label="URL"
              value={form.url}
              onChange={set("url")}
              required
            />
          </div>
          {error && (
            <div className="form-error">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            <Icon name="check" />
            Guardar
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function BrowserOpenModal({ prompt, onClose, onOpen }) {
  const [remember, setRemember] = useState(false);
  return (
    <Modal
      title="Navegador ya abierto"
      subtitle={`Ya existe una ventana de ${prompt.browser}${prompt.insecure ? " con esta configuración de desarrollo" : ""}.`}
      onClose={onClose}
      width={520}
    >
      <div className="modal-body browser-choice">
        <p>¿Cómo deseas abrir esta shell?</p>
        <label>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />{" "}
          Marcar como preferencia
        </label>
      </div>
      <footer className="modal-actions">
        <button className="button ghost" onClick={onClose}>
          Ahora no
        </button>
        <button
          className="button secondary"
          onClick={() => onOpen("tab", remember)}
        >
          Nueva pestaña
        </button>
        <button
          className="button primary"
          onClick={() => onOpen("window", remember)}
        >
          Nueva ventana
        </button>
      </footer>
    </Modal>
  );
}

function App() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const shellDetailId =
    location.pathname.match(/^\/shells\/([^/]+)$/)?.[1] || "";
  const activeView =
    location.pathname === "/shells" || shellDetailId
      ? "shells"
      : location.pathname === "/microfronts"
        ? "microfronts"
        : location.pathname === "/tags"
          ? "tags"
          : "home";
  const microfrontFilter =
    new URLSearchParams(location.search).get("microfront") || "";
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [search, setSearch] = useState("");
  const [microfrontSearch, setMicrofrontSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [editor, setEditor] = useState(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [consoleTab, setConsoleTab] = useState("environment");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("microfront-theme") || "dark",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("microfront-sidebar-collapsed") === "true",
  );
  const setMicrofrontProject = (project) => {
    if (project)
      routerNavigate({
        pathname: "/microfronts",
        search: `?project=${encodeURIComponent(project.id)}`,
      });
  };
  const logEnd = useRef(null);
  const flash = useCallback((message, kind = "success") => {
    setNotice({ message, kind });
    setTimeout(() => setNotice(null), 5000);
  }, []);
  const { projects, loading, refreshProjects } = useShellProjects(flash);
  const { versions, refreshVersions } = useMovaVersions(flash);
  const { logs, receiveLog, clearLogs } = useProcessLogs(flash);
  const refreshState = useCallback(async () => {
    try {
      setState(await api("/api/state"));
    } catch (e) {
      flash(e.message, "error");
    }
  }, [flash]);
  const refreshBootstrap = useCallback(async () => {
    try {
      const [nextConfig, nextState, setup] = await Promise.all([api("/api/config"), api("/api/state"), api("/api/setup")]);
      setConfig(nextConfig);
      setState(nextState);
      setSetupRequired(Boolean(setup.required));
    } catch (e) { flash(e.message, "error"); }
  }, [flash]);
  useEffect(() => {
    refreshBootstrap();
  }, [flash, refreshBootstrap]);
  useEffect(() => {
    if (shellDetailId) void refreshProjects();
  }, [shellDetailId, refreshProjects]);
  const onState = useCallback((next) => setState(next), []);
  useLauncherEvents({ onLog: receiveLog, onState });
  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  useEffect(() => {
    if (state?.buildBusy) setConsoleTab("build");
  }, [state?.buildBusy]);
  useEffect(() => {
    if (setupRequired && location.pathname !== "/inicio")
      routerNavigate("/inicio", { replace: true });
  }, [setupRequired, location.pathname, routerNavigate]);
  useEffect(() => {
    if (state?.build?.status === "success")
      refreshVersions()
        .catch(() => {});
  }, [refreshVersions, state?.build?.status, state?.build?.tag]);
  useEffect(() => {
    if (state?.microfrontendBranch?.status === "success") refreshProjects();
  }, [refreshProjects, state?.microfrontendBranch?.status, state?.microfrontendBranch?.startedAt]);
  useEffect(() => {
    if (state?.microfrontendBuild?.status === "success") refreshProjects();
  }, [refreshProjects, state?.microfrontendBuild?.status, state?.microfrontendBuild?.startedAt]);
  useEffect(() => {
    localStorage.setItem("microfront-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.body.classList.toggle(
      "launcher-home-view",
      activeView === "home",
    );
    return () => document.body.classList.remove("launcher-home-view");
  }, [activeView]);
  useEffect(() => {
    localStorage.setItem(
      "microfront-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter(
      (p) =>
        !q ||
        `${p.name} ${p.path} ${p.appName || ""} ${(p.microfrontends || []).map((item) => item.name).join(" ")}`
          .toLowerCase()
          .includes(q),
    );
  }, [projects, search]);
  const action = async (url, body) => {
    try {
      const result = await api(url, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      await Promise.all([refreshProjects(), refreshState()]);
      return result;
    } catch (e) {
      flash(e.message, "error");
    }
  };
  const startMicrofrontendAction = async (url, body) => {
    try {
      const result = await api(url, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      void refreshState();
      return result;
    } catch (e) {
      flash(e.message, "error");
      throw e;
    }
  };
  const startShell = async (project) => {
    await action("/api/environment/start", { projectId: project.id });
  };
  const rebuildServer = async (project) => {
    routerNavigate("/home");
    await action("/api/shell/rebuild", { projectId: project.id });
  };
  useEffect(() => {
    const handleRebuild = (event) => rebuildServer(event.detail);
    window.addEventListener("launcher:rebuild-server", handleRebuild);
    return () =>
      window.removeEventListener("launcher:rebuild-server", handleRebuild);
  });
  const preferences = async (patch, reload = true) => {
    try {
      const next = await api("/api/mova/preferences", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setState((current) => ({
        ...current,
        preferences: { ...current.preferences, ...next },
      }));
      if (reload) await refreshState();
      return next;
    } catch (e) {
      flash(e.message, "error");
      return null;
    }
  };
  const remove = async (project) => {
    if (
      !confirm(
        `¿Quitar “${project.name}” de la lista? No se borrarán archivos.`,
      )
    )
      return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      await refreshProjects();
    } catch (e) {
      flash(e.message, "error");
    }
  };
  if (!state || !config)
    return (
      <div className="boot-screen">
        <div className="loader" />
        <p>Preparando Microfront Launcher V2...</p>
      </div>
    );
  if (setupRequired || location.pathname === "/inicio")
    return (
      <InitialSetup
        config={config}
        onCompleted={async () => {
          setSetupRequired(false);
          await Promise.all([refreshBootstrap(), refreshProjects()]);
          routerNavigate("/home", { replace: true });
        }}
      />
    );
  const environmentLabel =
    state.execution?.status === "error"
      ? "Error"
      : state.session.status === "ready"
        ? "Listo"
        : state.session.status === "stopping"
          ? "Deteniendo"
          : ["starting", "building"].includes(state.session.status)
            ? "Iniciando"
            : "Detenido";
  const favoriteIds = state.preferences.favoriteShellIds || [];
  const favoriteMicrofrontIds = state.preferences.favoriteMicrofrontIds || [];
  const favoriteFiltered = filtered.filter((project) =>
    favoriteIds.includes(project.id),
  );
  const generalProjects = filtered;
  const buildLogs = logs.filter((log) =>
    ["Versiones", "Build MOVA"].includes(log.source),
  );
  const environmentLogs = logs.filter(
    (log) => !["Versiones", "Build MOVA"].includes(log.source),
  );
  const componentVersion =
    versions.find((item) => item.tag === state.preferences.preferredTag) ||
    versions.find((item) => item.cached) ||
    versions[0];
  const includeComponents = true;
  const componentsActive = state.components.status === "running";
  const browserName = config.chrome.browser?.startsWith("edge")
    ? "Edge"
    : "Chrome";
  const toggleFavorite = (projectId) =>
    preferences(
      {
        favoriteShellIds: favoriteIds.includes(projectId)
          ? favoriteIds.filter((id) => id !== projectId)
          : [...favoriteIds, projectId],
      },
      false,
    );
  const toggleMicrofrontFavorite = (microfrontId) =>
    preferences(
      {
        favoriteMicrofrontIds: favoriteMicrofrontIds.includes(microfrontId)
          ? favoriteMicrofrontIds.filter((id) => id !== microfrontId)
          : [...favoriteMicrofrontIds, microfrontId],
      },
      false,
    );
  const allMicrofronts = flattenMicrofronts(projects);
  const navigate = (
    view,
    shellSearch = "",
    microfrontId = "",
    projectId = "",
  ) => {
    setSearch(shellSearch);
    const pathname =
      view === "shells"
        ? "/shells"
        : view === "microfronts"
          ? "/microfronts"
          : view === "tags"
            ? "/tags"
            : "/home";
    const searchParams = new URLSearchParams();
    if (microfrontId) searchParams.set("microfront", microfrontId);
    if (projectId) searchParams.set("project", projectId);
    routerNavigate({
      pathname,
      search: searchParams.toString() ? `?${searchParams}` : "",
    });
  };
  return (
    <div
      className={`app-shell ${theme} ${activeView === "tags" ? "tags-route" : ""}`}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Icon name="terminal" size={23} />
          </div>
          <div>
            <strong>Microfront</strong>
            <span>Launcher V2</span>
          </div>
        </div>
        <div className="top-actions">
          <button
            className="button ghost theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            {theme === "dark" ? "Claro" : "Oscuro"}
          </button>
          <button
            className="button ghost"
            onClick={() =>
              action(
                state.shell.status === "running"
                  ? "/api/chrome/open"
                  : "/api/chrome/open-empty",
                { mode: "tab" },
              )
            }
          >
            <Icon name="external" />
            Abrir navegador
          </button>
          <button
            className="button ghost"
            disabled={state.busy || state.shell.status !== "stopped"}
            title={
              state.busy || state.shell.status !== "stopped"
                ? "Detén el entorno antes de cambiar la configuración."
                : "Configuración"
            }
            onClick={() => setShowSettings(true)}
          >
            <Icon name="settings" />
            Configuración
          </button>
          <button className="avatar">CV</button>
        </div>
      </header>
      <div
        className={`app-layout ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}
      >
        <Sidebar
          activeView={activeView}
          projects={projects}
          favoriteShellIds={favoriteIds}
          favoriteMicrofrontIds={favoriteMicrofrontIds}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          onNavigate={navigate}
          onNavigateToShell={(project) =>
            routerNavigate(`/shells/${encodeURIComponent(project.id)}`)
          }
          onNavigateToMicrofront={(microfrontId) =>
            navigate("microfronts", "", microfrontId)
          }
        />
        <main>
          <AppBreadcrumbs
            activeView={activeView}
            shellName={
              shellDetailId
                ? projects.find(
                    (project) =>
                      project.id === decodeURIComponent(shellDetailId),
                  )?.name
                : ""
            }
            onNavigate={navigate}
          />
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
                      : includeComponents
                        ? "Se inicia con la shell"
                        : "No incluido"}
                  </strong>
                </div>
                <button
                  className="button ghost"
                  onClick={() => navigate("tags")}
                >
                  <Icon name="tag" size={14} />
                  Versiones
                </button>
                {componentsActive ? (
                  <button
                    className="button stop"
                    disabled={state.components.external}
                    onClick={() => action("/api/components/stop")}
                  >
                    <Icon name="stop" size={14} />
                    {state.components.external ? "Externo" : "Detener"}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={state.busy || !componentVersion?.cached}
                    onClick={() => action("/api/components/start")}
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
                      onClick={() =>
                        setMicrofrontProject(
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
                      onClick={() =>
                        action("/api/chrome/open", { mode: "window" })
                      }
                    >
                      <Icon name="chrome" size={14} />
                      Nueva ventana
                    </button>
                  )}
                  {state.shell.status === "running" && (
                    <button
                      className="open-chrome-tab"
                      onClick={() =>
                        action("/api/chrome/open", { mode: "tab" })
                      }
                    >
                      <Icon name="external" size={14} />
                      Abrir pestaña
                    </button>
                  )}
                  {state.session.status === "idle" &&
                    state.shell.status === "stopped" && (
                      <button
                        className="select-shell"
                        onClick={() => navigate("shells")}
                      >
                        <Icon name="layers" size={14} />
                        Seleccionar shell
                      </button>
                    )}
                  {state.session.status !== "idle" && (
                    <button
                      disabled={state.session.status === "stopping"}
                      onClick={() => action("/api/environment/stop")}
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
          {activeView === "shells" && !shellDetailId && (
            <div className="shells-table-wrapper">
              <ShellsPage
                projects={filtered}
                search={search}
                state={state}
                favoriteIds={favoriteIds}
                onSearch={setSearch}
                onRefresh={refreshProjects}
                onFavorite={toggleFavorite}
                onStart={startShell}
                onStop={() => action("/api/environment/stop")}
                onAction={action}
                onMicrofronts={setMicrofrontProject}
                onDetails={(project) =>
                  routerNavigate(`/shells/${encodeURIComponent(project.id)}`)
                }
              />
            </div>
          )}
          {shellDetailId && (
            <div className="shell-detail-wrapper">
              <ShellDetailPage
                project={projects.find(
                  (project) => project.id === decodeURIComponent(shellDetailId),
                )}
                state={state}
                onBack={() => routerNavigate("/shells")}
                onOpenWebapp={(project) =>
                  action("/api/projects/open-webapp", { projectId: project.id })
                }
                onStart={(project) =>
                  action("/api/environment/start", { projectId: project.id })
                }
                onStop={() => action("/api/environment/stop")}
                onRebuild={(project) =>
                  action("/api/shell/rebuild", { projectId: project.id })
                }
                onChangeMicrofrontBranch={(project, microfrontend, branch) =>
                  startMicrofrontendAction("/api/microfrontends/branch", {
                    projectId: project.id,
                    microfrontendId: microfrontend.id,
                    branch,
                  })
                }
                onChangeMicrofrontBranchBatch={(project, microfronts, branch) =>
                  startMicrofrontendAction("/api/microfrontends/branch-batch", {
                    projectId: project.id,
                    microfrontendIds: microfronts.map((microfront) => microfront.id),
                    branch,
                  })
                }
                onBuildMicrofront={(project, microfrontend) =>
                  startMicrofrontendAction("/api/microfrontends/build", {
                    projectId: project.id,
                    microfrontendId: microfrontend.id,
                  })
                }
                onBuildMicrofrontBatch={(project, microfronts) =>
                  startMicrofrontendAction("/api/microfrontends/build-batch", {
                    projectId: project.id,
                    microfrontendIds: microfronts.map((microfront) => microfront.id),
                  })
                }
                onRefresh={refreshProjects}
                favorite={favoriteIds.includes(
                  decodeURIComponent(shellDetailId),
                )}
                onFavorite={toggleFavorite}
              />
            </div>
          )}
          {activeView === "tags" && (
            <TagsPage
              versions={versions}
              build={state.build}
              busy={state.buildBusy}
              processes={state.processes || []}
              preferredTag={state.preferences.preferredTag}
              onBuild={async (tag) => {
                setConsoleTab("build");
                await action("/api/mova/build", { tag });
              }}
              onCancelBuild={async () => {
                await action("/api/mova/build/cancel");
              }}
              onUse={async (tag) => {
                await preferences({ preferredTag: tag });
              }}
              onRefresh={async () => {
                await action("/api/mova/tags/refresh");
                await refreshVersions();
              }}
            />
          )}
          {activeView === "home" ? (
            <HomePage
              logs={consoleTab === "build" ? buildLogs : environmentLogs}
              state={state}
              tab={consoleTab}
              onTab={setConsoleTab}
              onClear={() => {
                clearLogs();
              }}
              logEnd={logEnd}
            />
          ) : activeView === "shells" ? (
            <div className="view-panel shells-view">
              <section className="workspace">
                <div className="section-head">
                  <div>
                    <h2>Shells disponibles</h2>
                    <p>
                      Solo una puede utilizar el servidor local{" "}
                      <code>localhost:8080</code>.
                    </p>
                  </div>
                  <div className="toolbar">
                    <div className="search">
                      <Icon name="search" size={17} />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar shell o microfrontend..."
                      />
                    </div>
                    <button className="button ghost" onClick={refreshProjects}>
                      <Icon name="refresh" />
                      Actualizar
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setEditor(null)}
                    >
                      <Icon name="plus" />
                      Agregar
                    </button>
                  </div>
                </div>
                {loading ? (
                  <div className="empty">
                    <div className="loader" />
                    <p>Buscando shells...</p>
                  </div>
                ) : (
                  <>
                    {favoriteFiltered.length > 0 && (
                      <section className="shell-group favorites-group">
                        <header>
                          <div>
                            <p className="eyebrow">ACCESOS RÁPIDOS</p>
                            <h3>
                              <Icon name="star" size={16} />
                              Favoritas
                            </h3>
                          </div>
                          <span>{favoriteFiltered.length}</span>
                        </header>
                        <div className="projects-grid">
                          {favoriteFiltered.map((project) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              state={state}
                              favorite
                              onFavorite={toggleFavorite}
                              onLaunch={startShell}
                              onStop={() => action("/api/environment/stop")}
                              onShowMicrofronts={setMicrofrontProject}
                              onEdit={setEditor}
                              onDelete={remove}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                    <section className="shell-group">
                      <header>
                        <div>
                          <p className="eyebrow">DIRECTORIO LOCAL</p>
                          <h3>General</h3>
                        </div>
                        <span>{generalProjects.length}</span>
                      </header>
                      <div className="projects-grid">
                        {generalProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            state={state}
                            favorite={false}
                            onFavorite={toggleFavorite}
                            onLaunch={startShell}
                            onStop={() => action("/api/environment/stop")}
                            onShowMicrofronts={setMicrofrontProject}
                            onEdit={setEditor}
                            onDelete={remove}
                          />
                        ))}
                      </div>
                    </section>
                  </>
                )}
                <div className="todo-note complete">
                  <Icon name="check" size={16} />
                  <span>
                    <strong>Favoritas:</strong> usa la estrella para mover una
                    shell a la sección superior.
                  </span>
                </div>
              </section>
            </div>
          ) : (
            <MicrofrontsPage
              items={allMicrofronts}
              selectedId={microfrontFilter}
              search={microfrontSearch}
              favoriteIds={favoriteMicrofrontIds}
              processes={state.processes || []}
              onSearch={setMicrofrontSearch}
              onClearSelection={() => navigate("microfronts")}
              onToggleFavorite={toggleMicrofrontFavorite}
              onOpen={(project, microfrontend) =>
                startMicrofrontendAction("/api/microfrontends/open", {
                  projectId: project.id,
                  microfrontendId: microfrontend.id,
                })
              }
              onBuild={(project, microfrontend) =>
                action("/api/microfrontends/build", {
                  projectId: project.id,
                  microfrontendId: microfrontend.id,
                })
              }
              onRefresh={refreshProjects}
            />
          )}
        </main>
      </div>
      {notice && (
        <div className={`toast ${notice.kind}`}>
          <Icon name={notice.kind === "error" ? "alert" : "check"} />
          {notice.message}
        </div>
      )}
      {editor !== undefined && (
        <ProjectEditor
          project={editor}
          defaults={config}
          onClose={() => setEditor(undefined)}
          onSaved={refreshProjects}
        />
      )}
      {showSettings && (
        <GlobalSettings
          config={config}
          onClose={() => setShowSettings(false)}
          onSaved={refreshBootstrap}
        />
      )}
      {state.browserPrompt && (
        <BrowserOpenModal
          prompt={state.browserPrompt}
          onClose={() => action("/api/chrome/dismiss")}
          onOpen={(mode, remember) =>
            action("/api/chrome/open", { mode, remember })
          }
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
