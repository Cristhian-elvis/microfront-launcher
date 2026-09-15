import { Outlet } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { AppHeader } from "./AppHeader.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { AppBreadcrumbs } from "./AppBreadcrumbs.jsx";
import { ProjectEditor } from "./ProjectEditor.jsx";
import { BrowserOpenModal } from "./BrowserOpenModal.jsx";
import { GlobalSettings } from "../../views/settings/components/GlobalSettings.jsx";
import { ProcessConsole } from "../../views/home/components/ProcessConsole.jsx";

export function AppLayout({
  theme,
  onThemeToggle,
  state,
  onOpenBrowser,
  onOpenProfessionalDesktop,
  onOpenConsole,
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
  showConsole,
  onCloseConsole,
  consoleLogs,
  consoleTab,
  onConsoleTab,
  onClearConsole,
  consoleLogEnd,
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
        onOpenProfessionalDesktop={onOpenProfessionalDesktop}
        onOpenConsole={onOpenConsole}
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
      {showConsole && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCloseConsole()}>
          <section className="modal" style={{ maxWidth: 980 }}>
            <header className="modal-header">
              <div>
                <h2>Consola de proceso</h2>
                <p>Estado del entorno y eventos recientes</p>
              </div>
              <button className="icon-button" onClick={onCloseConsole} aria-label="Cerrar">
                <Icon name="close" />
              </button>
            </header>
            <ProcessConsole
              logs={consoleLogs}
              state={state}
              tab={consoleTab}
              onTab={onConsoleTab}
              onClear={onClearConsole}
              logEnd={consoleLogEnd}
            />
          </section>
        </div>
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
