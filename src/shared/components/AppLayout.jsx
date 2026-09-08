import { Outlet } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { AppHeader } from "./AppHeader.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { AppBreadcrumbs } from "./AppBreadcrumbs.jsx";
import { ProjectEditor } from "./ProjectEditor.jsx";
import { BrowserOpenModal } from "./BrowserOpenModal.jsx";
import { GlobalSettings } from "../../views/settings/components/GlobalSettings.jsx";

export function AppLayout({
  theme,
  onThemeToggle,
  state,
  onOpenBrowser,
  onOpenSettings,
  activeView,
  projects,
  favoriteIds,
  favoriteMicrofrontIds,
  sidebarCollapsed,
  onToggleSidebar,
  navigate,
  routerNavigate,
  notice,
  editor,
  onCloseEditor,
  config,
  showSettings,
  onCloseSettings,
  onSavedSettings,
  onDismissBrowserPrompt,
  onOpenBrowserPrompt,
}) {
  return (
    <div
      className={`app-shell ${theme} ${activeView === "tags" ? "tags-route" : ""}`}
    >
      <AppHeader
        theme={theme}
        onThemeToggle={onThemeToggle}
        state={state}
        onOpenBrowser={onOpenBrowser}
        onOpenSettings={onOpenSettings}
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
          onToggleCollapse={onToggleSidebar}
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
            onNavigate={navigate}
            routerNavigate={routerNavigate}
          />
          <Outlet />
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
          onClose={onCloseEditor}
          onSaved={async () => {}}
        />
      )}
      {showSettings && (
        <GlobalSettings
          config={config}
          onClose={onCloseSettings}
          onSaved={onSavedSettings}
        />
      )}
      {state.browserPrompt && (
        <BrowserOpenModal
          prompt={state.browserPrompt}
          onClose={onDismissBrowserPrompt}
          onOpen={onOpenBrowserPrompt}
        />
      )}
    </div>
  );
}
