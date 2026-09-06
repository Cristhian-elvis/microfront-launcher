import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { api } from "./lib/api.js";
import { Icon } from "./shared/components/Icon.jsx";
import { HomePage } from "./views/home/HomePage.jsx";
import { Sidebar } from "./shared/components/Sidebar.jsx";
import { MicrofrontsPage } from "./views/microfronts/MicrofrontsPage.jsx";
import { ShellsPage } from "./views/shells/ShellsPage.jsx";
import { ShellDetailPage } from "./views/shells/ShellDetailPage.jsx";
import { TagsPage } from "./views/tags/TagsPage.jsx";
import { AppBreadcrumbs } from "./shared/components/AppBreadcrumbs.jsx";
import { GlobalSettings } from "./views/settings/components/GlobalSettings.jsx";
import { InitialSetup } from "./views/setup/components/InitialSetup.jsx";
import { ProjectEditor } from "./shared/components/ProjectEditor.jsx";
import { BrowserOpenModal } from "./shared/components/BrowserOpenModal.jsx";
import { AppHeader } from "./shared/components/AppHeader.jsx";
import { flattenMicrofronts } from "./lib/microfronts.js";
import { useLauncherEvents } from "./shared/hooks/useLauncherEvents.js";
import { useShellProjects } from "./views/shells/hooks/useShellProjects.js";
import { useMovaVersions } from "./views/tags/hooks/useMovaVersions.js";
import { useProcessLogs } from "./views/home/hooks/useProcessLogs.js";
import { useAppNavigation } from "./shared/hooks/useAppNavigation.js";
import { useAppActions } from "./shared/hooks/useAppActions.js";
import { useAppPreferences } from "./shared/hooks/useAppPreferences.js";
import { useAppEffects } from "./shared/hooks/useAppEffects.js";
import "./styles.css";

function App() {
  // Navigation state and utilities
  const {
    location,
    routerNavigate,
    shellDetailId,
    activeView,
    microfrontFilter,
    navigate,
    setMicrofrontProject,
  } = useAppNavigation();

  // UI state
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

  // Refs
  const logEnd = useRef(null);

  // Utilities
  const flash = useCallback((message, kind = "success") => {
    setNotice({ message, kind });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  // Data fetching
  const {
    projects: hookProjects,
    loading,
    refreshProjects,
  } = useShellProjects(flash);
  const [projectsState, setProjectsState] = useState(null);
  const projects = projectsState !== null ? projectsState : hookProjects;

  const { versions, refreshVersions } = useMovaVersions(flash);
  const { logs, receiveLog, clearLogs } = useProcessLogs(flash);

  // API calls
  const refreshState = useCallback(async () => {
    try {
      setState(await api("/api/state"));
    } catch (e) {
      flash(e.message, "error");
    }
  }, [flash]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const [nextConfig, nextState, setup] = await Promise.all([
        api("/api/config"),
        api("/api/state"),
        api("/api/setup"),
      ]);
      setConfig(nextConfig);
      setState(nextState);
      setSetupRequired(Boolean(setup.required));
    } catch (e) {
      flash(e.message, "error");
    }
  }, [flash]);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  // Event listeners
  const onState = useCallback((next) => setState(next), []);
  useLauncherEvents({ onLog: receiveLog, onState });

  useEffect(() => {
    const handleRebuild = (event) => {
      routerNavigate("/home");
      action("/api/shell/rebuild", { projectId: event.detail.id });
    };
    window.addEventListener("launcher:rebuild-server", handleRebuild);
    return () =>
      window.removeEventListener("launcher:rebuild-server", handleRebuild);
  }, [routerNavigate]);

  // Actions
  const {
    action,
    startShell,
    preferences: preferencesAction,
    remove,
  } = useAppActions(flash, refreshProjects, refreshState, refreshVersions);

  const preferences = useCallback(
    async (patch, reload = true) => {
      return preferencesAction(setState, state, patch, reload);
    },
    [preferencesAction, state],
  );

  // Preferences
  const {
    favoriteIds,
    favoriteMicrofrontIds,
    toggleFavorite,
    toggleMicrofrontFavorite,
  } = useAppPreferences(state || { preferences: {} }, preferences);

  // Effects
  useAppEffects(
    setupRequired,
    location,
    routerNavigate,
    state,
    shellDetailId,
    projects,
    refreshVersions,
    refreshProjects,
    theme,
    sidebarCollapsed,
    activeView,
    setConsoleTab,
    logEnd,
    logs,
    flash,
    setProjectsState,
    api,
  );

  // Computed values
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter(
      (p) =>
        !q ||
        `${p.name} ${p.path} ${p.appName || ""} ${(p.microfrontends || [])
          .map((item) => item.name)
          .join(" ")}`
          .toLowerCase()
          .includes(q),
    );
  }, [projects, search]);

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
    versions.find((item) => item.tag === state?.preferences?.preferredTag) ||
    versions.find((item) => item.cached) ||
    versions[0];

  const componentsActive = state?.components?.status === "running";

  const allMicrofronts = flattenMicrofronts(projects);

  const environmentLabel =
    state?.execution?.status === "error"
      ? "Error"
      : state?.session?.status === "ready"
        ? "Listo"
        : state?.session?.status === "stopping"
          ? "Deteniendo"
          : ["starting", "building"].includes(state?.session?.status)
            ? "Iniciando"
            : "Detenido";

  // Loading state
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

  return (
    <div
      className={`app-shell ${theme} ${activeView === "tags" ? "tags-route" : ""}`}
    >
      <AppHeader
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        state={state}
        onOpenBrowser={() =>
          action(
            state.shell.status === "running"
              ? "/api/chrome/open"
              : "/api/chrome/open-empty",
            { mode: "tab" },
          )
        }
        onOpenSettings={() => setShowSettings(true)}
      />
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
                favorite={favoriteIds.includes(
                  decodeURIComponent(shellDetailId),
                )}
                onFavorite={toggleFavorite}
                flash={flash}
                refreshProjects={refreshProjects}
                refreshState={refreshState}
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
              flash={flash}
              refreshState={refreshState}
            />
          )}
          {activeView === "home" && (
            <HomePage
              state={state}
              buildLogs={buildLogs}
              environmentLogs={environmentLogs}
              consoleTab={consoleTab}
              setConsoleTab={setConsoleTab}
              logEnd={logEnd}
              componentVersion={componentVersion}
              componentsActive={componentsActive}
              environmentLabel={environmentLabel}
              onNavigateToTags={() => navigate("tags")}
              onComponentStop={() => action("/api/components/stop")}
              onComponentStart={() => action("/api/components/start")}
              onMicrofronts={setMicrofrontProject}
              onOpenBrowser={() => action("/api/chrome/open", { mode: "window" })}
              onOpenBrowserTab={() => action("/api/chrome/open", { mode: "tab" })}
              onSelectShell={() => navigate("shells")}
              onStop={() => action("/api/environment/stop")}
              projects={projects}
              clearLogs={clearLogs}
            />
          )}
          {activeView === "microfronts" && (
            <MicrofrontsPage
              items={allMicrofronts}
              selectedId={microfrontFilter}
              search={microfrontSearch}
              favoriteIds={favoriteMicrofrontIds}
              processes={state.processes || []}
              onSearch={setMicrofrontSearch}
              onClearSelection={() => navigate("microfronts")}
              onToggleFavorite={toggleMicrofrontFavorite}
              flash={flash}
              refreshProjects={refreshProjects}
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
