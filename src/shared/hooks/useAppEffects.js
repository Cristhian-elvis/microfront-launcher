import { useEffect } from "react";

export function useAppEffects(
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
) {
  // Setup redirect
  useEffect(() => {
    if (setupRequired && location.pathname !== "/inicio")
      routerNavigate("/inicio", { replace: true });
  }, [setupRequired, location.pathname, routerNavigate]);

  // Load fresh project data when navigating to shell detail
  useEffect(() => {
    if (shellDetailId && projects.length > 0) {
      api(`/api/projects/${encodeURIComponent(shellDetailId)}`)
        .then((updated) => {
          setProjectsState((current) =>
            (current || projects).map((p) =>
              p.id === updated.id ? updated : p,
            ),
          );
        })
        .catch((e) => flash(e.message, "error"));
    }
  }, [shellDetailId, projects.length, setProjectsState, flash, api]);

  // Refresh versions on successful build
  useEffect(() => {
    if (state?.build?.status === "success")
      refreshVersions().catch(() => {});
  }, [refreshVersions, state?.build?.status, state?.build?.tag]);

  // Refresh projects on successful branch switch
  useEffect(() => {
    if (state?.microfrontendBranch?.status === "success")
      refreshProjects();
  }, [
    refreshProjects,
    state?.microfrontendBranch?.status,
    state?.microfrontendBranch?.startedAt,
  ]);

  // Refresh projects on successful microfrontend build
  useEffect(() => {
    if (state?.microfrontendBuild?.status === "success")
      refreshProjects();
  }, [
    refreshProjects,
    state?.microfrontendBuild?.status,
    state?.microfrontendBuild?.startedAt,
  ]);

  // Set console tab when build is busy
  useEffect(() => {
    if (state?.buildBusy) setConsoleTab("build");
  }, [state?.buildBusy, setConsoleTab]);

  // Auto-scroll logs
  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logEnd]);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem("microfront-theme", theme);
  }, [theme]);

  // Manage body classes
  useEffect(() => {
    document.body.classList.toggle(
      "launcher-home-view",
      activeView === "home",
    );
    return () => document.body.classList.remove("launcher-home-view");
  }, [activeView]);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "microfront-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);
}
