import { api } from "../../../lib/api.js";
import { Icon } from "../../../shared/components/Icon.jsx";

export function ProjectCard({
  project,
  state,
  onLaunch,
  onEdit,
  onDelete,
  onStop,
  onShowMicrofronts,
  onOpenWebapp = () =>
    api("/api/chrome/open", {
      method: "POST",
      body: JSON.stringify({ mode: "tab" }),
    }),
  favorite,
  onFavorite,
}) {
  const own = state.shell.projectId === project.id;
  const activeOther = state.shell.status !== "stopped" && !own;
  const disabled = state.busy || activeOther || state.session.status === "stopping";
  const configLocked = state.busy || state.shell.status !== "stopped";
  const microfrontCount = project.microfrontends?.length || 0;

  return (
    <article className={`project-card ${own ? "is-running" : ""}`}>
      <div className="project-head">
        <div className="project-mark"><Icon name="layers" size={22} /></div>
        <div className="project-title"><h3>{project.name}</h3></div>
        <div className="card-menu">
          <button className="icon-button" disabled={!own} title={own ? "Abrir webapp" : "Inicia esta shell para abrir su webapp"} onClick={() => onOpenWebapp()}><Icon name="external" size={17} /></button>
          <button className={`icon-button ${favorite ? "favorite" : ""}`} title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"} onClick={() => onFavorite(project.id)}><Icon name="star" size={17} /></button>
          <button className="icon-button" disabled={configLocked} title={configLocked ? "Modo lectura: detÃ©n la shell para configurar." : "Configurar shell"} onClick={() => onEdit(project)}><Icon name="settings" size={17} /></button>
          <button className="icon-button danger" disabled={configLocked} title={configLocked ? "Modo lectura: detÃ©n la shell para quitarla." : "Quitar"} onClick={() => onDelete(project)}><Icon name="trash" size={17} /></button>
        </div>
      </div>
      <div className="project-app"><div><span>APLICACIÃ“N ENLAZADA</span><strong>{project.appName || "Sin configurar"}</strong></div><span className={`config-state ${project.configured ? "ready" : ""}`}>{project.configured ? "Lista" : "Pendiente"}</span></div>
      <div className="project-details"><div><span>RUTA</span><code title={project.path}>{project.path}</code></div></div>
      <div className="microfront-count"><Icon name="layers" size={14} /><strong>{microfrontCount}</strong> microfrontends locales asociados</div>
      <div className="project-actions">
        <button className="button ghost microfronts-button" onClick={() => onShowMicrofronts(project)}><Icon name="vscode" size={14} />Microfronts</button>
        {own ? <><button className="button secondary grow" onClick={() => onOpenWebapp()}><Icon name="external" />Abrir webapp</button><button className="button stop grow" onClick={onStop}><Icon name="stop" />Detener entorno</button></> : <><button className="button ghost" disabled={disabled} onClick={() => window.dispatchEvent(new CustomEvent("launcher:rebuild-server", { detail: project }))}><Icon name="refresh" />Reconstruir servidor</button><button className="button primary grow" disabled={disabled} onClick={() => onLaunch(project)}><Icon name={project.configured ? "play" : "settings"} />{project.configured ? "Iniciar" : "Configurar shell"}</button></>}
      </div>
    </article>
  );
}
