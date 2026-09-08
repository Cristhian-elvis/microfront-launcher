import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api } from "./lib/api.js";
import { HomePage } from "./views/home/HomePage.jsx";
import { MicrofrontsPage } from "./views/microfronts/MicrofrontsPage.jsx";
import { ShellsPage } from "./views/shells/ShellsPage.jsx";
import { ShellDetailPage } from "./views/shells/ShellDetailPage.jsx";
import { MicrofrontDetailPage } from "./views/shells/MicrofrontDetailPage.jsx";
import { TagsPage } from "./views/tags/TagsPage.jsx";
import { InitialSetup } from "./views/setup/components/InitialSetup.jsx";
import { AppLayout } from "./shared/components/AppLayout.jsx";
import { flattenMicrofronts } from "./lib/microfronts.js";
import { useLauncherEvents } from "./shared/hooks/useLauncherEvents.js";
import { useMovaVersions } from "./views/tags/hooks/useMovaVersions.js";
import { useProcessLogs } from "./views/home/hooks/useProcessLogs.js";
import { useAppNavigation } from "./shared/hooks/useAppNavigation.js";
import { useAppActions } from "./shared/hooks/useAppActions.js";
import { useAppPreferences } from "./shared/hooks/useAppPreferences.js";
import { useProjects } from "./shared/hooks/useProjects.js";
import { useFlash } from "./shared/hooks/useFlash.js";
import { useActions } from "./shared/hooks/useActions.js";
import { ProjectsProvider } from "./shared/context/ProjectsContext.jsx";
import { FlashProvider } from "./shared/context/FlashContext.jsx";
import { ActionsProvider } from "./shared/context/ActionsContext.jsx";
import "./styles.css";

function AppContent() {
  const { location, routerNavigate, activeView, microfrontFilter, navigate } =
    useAppNavigation();

  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [search, setSearch] = useState("");
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

  const logEnd = useRef(null);

  const flash = useCallback((message, kind = "success") => {
    setNotice({ message, kind });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const { projects, refreshProjects } = useProjects();
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

  const {
    favoriteIds,
    favoriteMicrofrontIds,
    toggleFavorite,
    toggleMicrofrontFavorite,
  } = useAppPreferences(state || { preferences: {} }, preferences);

  useEffect(() => {
    if (setupRequired && location.pathname !== "/inicio")
      routerNavigate("/inicio", { replace: true });
  }, [setupRequired, location.pathname, routerNavigate]);

  useEffect(() => {
    if (state?.build?.status === "success")
      refreshVersions().catch(() => {});
  }, [refreshVersions, state?.build?.status, state?.build?.tag]);

  useEffect(() => {
    if (state?.buildBusy) setConsoleTab("build");
  }, [state?.buildBusy, setConsoleTab]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logEnd]);

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
        `${p.name} ${p.path} ${p.appName || ""} ${(p.microfrontends || [])
          .map((item) => item.name)
          .join(" ")}`
          .toLowerCase()
          .includes(q),
    );
  }, [projects, search]);

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

  const selectMovaVersion = useCallback(
    async (tag) => {
      try {
        await api("/api/mova/preferences", {
          method: "PUT",
          body: JSON.stringify({ preferredTag: tag }),
        });
        await refreshState();
      } catch (error) {
        flash(error.message, "error");
      }
    },
    [flash, refreshState],
  );

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

  if (!state || !config || !projects || projects.length === 0)
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
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout
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
            activeView={activeView}
            projects={projects}
            favoriteIds={favoriteIds}
            favoriteMicrofrontIds={favoriteMicrofrontIds}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            navigate={navigate}
            routerNavigate={routerNavigate}
            notice={notice}
            editor={editor}
            onCloseEditor={() => setEditor(undefined)}
            config={config}
            showSettings={showSettings}
            onCloseSettings={() => setShowSettings(false)}
            onSavedSettings={refreshBootstrap}
            onDismissBrowserPrompt={() => action("/api/chrome/dismiss")}
            onOpenBrowserPrompt={(mode, remember) =>
              action("/api/chrome/open", { mode, remember })
            }
          />
        }
      >
        <Route
          path="home"
          element={
            <HomePage
              state={state}
              buildLogs={buildLogs}
              environmentLogs={environmentLogs}
              logEnd={logEnd}
              componentVersion={componentVersion}
              componentsActive={componentsActive}
              environmentLabel={environmentLabel}
              versions={versions}
              preferredTag={state.preferences.preferredTag}
              onSelectVersion={selectMovaVersion}
              onStartShell={startShell}
              projects={projects}
              clearLogs={clearLogs}
            />
          }
        />
        <Route
          path="tags"
          element={
            <TagsPage
              versions={versions}
              build={state.build}
              busy={state.buildBusy}
              processes={state.processes || []}
              preferredTag={state.preferences.preferredTag}
              flash={flash}
              refreshState={refreshState}
            />
          }
        />
        <Route
          path="microfronts"
          element={
            <MicrofrontsPage
              items={allMicrofronts}
              selectedId={microfrontFilter}
              favoriteIds={favoriteMicrofrontIds}
              processes={state.processes || []}
              onClearSelection={() => navigate("microfronts")}
              onToggleFavorite={toggleMicrofrontFavorite}
            />
          }
        />
        <Route
          path="shells"
          element={
            <div className="shells-table-wrapper">
              <ShellsPage
                projects={filtered}
                state={state}
                favoriteIds={favoriteIds}
                onFavorite={toggleFavorite}
                onStart={startShell}
                onStop={() =>
                  action(
                    "/api/environment/stop",
                    {},
                    {
                      refreshProjectsAfter: false,
                      refreshStateAfter: false,
                    },
                  )
                }
                onAction={action}
                onDetails={(project) =>
                  routerNavigate(`/shells/${encodeURIComponent(project.id)}`)
                }
              />
            </div>
          }
        />
        <Route
          path="shells/:shellId"
          element={
            <div className="shell-detail-wrapper">
              <ShellDetailPage
                state={state}
                onMicrofrontDetail={(microfront) =>
                  routerNavigate(
                    `${location.pathname}/${encodeURIComponent(microfront.id)}`,
                  )
                }
              />
            </div>
          }
        />
        <Route
          path="shells/:shellId/:microfrontId"
          element={
            <div className="microfront-detail-wrapper">
              <MicrofrontDetailPage state={state} />
            </div>
          }
        />
        <Route path="inicio" element={<Navigate to="/home" replace />} />
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ProjectsProvider>
      <FlashProvider>
        <ActionsProvider>
          <AppContent />
        </ActionsProvider>
      </FlashProvider>
    </ProjectsProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
