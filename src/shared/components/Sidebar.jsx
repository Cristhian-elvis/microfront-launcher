import { Icon } from "./Icon.jsx";
import { microfrontKey } from "../../lib/microfronts.js";

export function Sidebar({
  activeView,
  projects,
  favoriteShellIds,
  favoriteMicrofrontIds,
  collapsed,
  onToggleCollapse,
  onNavigate,
  onNavigateToShell,
  onNavigateToMicrofront,
}) {
  const favoriteShells = projects.filter((project) =>
    favoriteShellIds.includes(project.id),
  );
  const microfrontCount = projects.reduce(
    (total, project) => total + (project.microfrontends || []).length,
    0,
  );
  const favoriteMicrofronts = projects.flatMap((project) =>
    (project.microfrontends || [])
      .filter((microfrontend) =>
        favoriteMicrofrontIds.includes(
          microfrontKey(project.id, microfrontend.id),
        ),
      )
      .map((microfrontend) => ({ project, microfrontend })),
  );

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      aria-label="Navegación principal"
    >
      <button
        className="sidebar-collapse"
        onClick={onToggleCollapse}
        title={collapsed ? "Expandir barra lateral" : "Recoger barra lateral"}
      >
        <Icon name="chevron" />
      </button>
      <nav className="sidebar-nav">
        <button
          className={activeView === "home" ? "active" : ""}
          onClick={() => onNavigate("home")}
        >
          <Icon name="home" />
          <span className="sidebar-label">Inicio</span>
        </button>
        <button
          className={activeView === "shells" ? "active" : ""}
          onClick={() => onNavigate("shells")}
        >
          <Icon name="layers" />
          <span className="sidebar-label">Shells</span>
          <span className="sidebar-count">{projects.length}</span>
        </button>
        <button
          className={activeView === "microfronts" ? "active" : ""}
          onClick={() => onNavigate("microfronts")}
        >
          <Icon name="package" />
          <span className="sidebar-label">Microfronts</span>
          <span className="sidebar-count">{microfrontCount}</span>
        </button>
        <button
          className={activeView === "tags" ? "active" : ""}
          onClick={() => onNavigate("tags")}
        >
          <Icon name="tag" />
          <span className="sidebar-label">Tags MOVA</span>
        </button>
      </nav>

      <section className="sidebar-section">
        <header>
          <span>
            <Icon name="star" size={13} />
            Shells favoritas
          </span>
          <small>{favoriteShells.length}</small>
        </header>
        <div className="sidebar-list">
          {favoriteShells.length ? (
            favoriteShells.map((project) => (
              <button
                key={project.id}
                title={project.path}
                onClick={() => onNavigateToShell(project)}
              >
                <Icon name="layers" size={14} />
                <span>{project.name}</span>
              </button>
            ))
          ) : (
            <p>Aún no hay favoritas.</p>
          )}
        </div>
      </section>

      <section className="sidebar-section microfront-sidebar">
        <header>
          <span>
            <Icon name="star" size={13} />
            Microfronts favoritos
          </span>
          <small>{favoriteMicrofronts.length}</small>
        </header>
        <div className="sidebar-list">
          {favoriteMicrofronts.length ? (
            favoriteMicrofronts.map(({ project, microfrontend }) => (
              <button
                key={microfrontKey(project.id, microfrontend.id)}
                title={`${project.name} · ${microfrontend.path}`}
                onClick={() =>
                  onNavigateToMicrofront(
                    microfrontKey(project.id, microfrontend.id),
                  )
                }
              >
                <Icon name="package" size={14} />
                <span>{microfrontend.name}</span>
                <small>{project.name}</small>
              </button>
            ))
          ) : (
            <p>Aún no hay favoritos.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
