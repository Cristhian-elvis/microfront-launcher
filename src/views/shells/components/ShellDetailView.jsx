import { Icon } from "../../../shared/components/Icon.jsx";
import { projectDisplayName } from "../../../lib/projects.js";
import { ShellMicrofrontList } from "./ShellMicrofrontList.jsx";

export function ShellDetailView({
  project,
  state,
  refreshing,
  rebuilding,
  onBack,
  onOpenWebapp,
  onRebuild,
  onChangeMicrofrontBranch,
  onChangeMicrofrontBranchBatch,
  onBuildMicrofront,
  onBuildMicrofrontBatch,
  onRefresh,
  onMicrofrontDetail,
  favorite,
  onFavorite,
}) {
  if (!project)
    return (
      <div className="view-panel shell-detail-view">
        <section className="workspace">
          <div className="empty">
            <p>La shell solicitada no existe.</p>
            <button className="button ghost" onClick={onBack}>
              Volver a shells
            </button>
          </div>
        </section>
      </div>
    );
  const webappName = project.name || "Sin configurar";
  const webappPath = project.webappPath || "No disponible";
  const rebuildInProgress =
    rebuilding ||
    (state.execution?.status === "running" &&
      state.execution.projectId === project.id);
  const cannotRebuild =
    rebuildInProgress ||
    (state.shell.status !== "stopped" &&
      state.shell.projectId === project.id);
  const interactionsDisabled = refreshing || rebuildInProgress;
  return (
    <div className="view-panel shell-detail-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <div className="shell-detail-title">
              <h2>Proyecto: {projectDisplayName(project.name)}</h2>
              <button
                className={`icon-button ${favorite ? "favorite" : ""}`}
                title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                disabled={interactionsDisabled}
                onClick={() => onFavorite(project.id)}
              >
                <Icon name="star" size={17} />
              </button>
            </div>
            <p>Configuración y vínculos locales del proyecto.</p>
          </div>
          <div className="toolbar shell-detail-actions">
            <button
              className="button ghost"
              title="Sincronizar información del proyecto"
              disabled={interactionsDisabled}
              onClick={onRefresh}
            >
              <Icon name={refreshing ? "loader" : "refresh"} />
              {refreshing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              className="button ghost"
              title="Reconstruir todo: prepara el servidor y reconstruye el build local"
              disabled={cannotRebuild}
              onClick={() => onRebuild(project)}
            >
              <Icon name={rebuildInProgress ? "loader" : "refresh"} />
              {rebuildInProgress ? "Reconstruyendo..." : "Reconstruir todo"}
            </button>
          </div>
        </div>
        <div className="shell-detail-grid">
          <article className="shell-detail-webapp">
            <span>Webapp asociada</span>
            <strong>{webappName}</strong>
            <span className="shell-detail-path-label">
              Ubicación de la webapp
            </span>
            <code>{webappPath}</code>
            <button
              className="button ghost shell-detail-open"
              disabled={interactionsDisabled || !project.webappPath}
              onClick={() => onOpenWebapp(project)}
            >
              <Icon name="vscode" size={15} />
              Abrir en VS Code
            </button>
          </article>
          <article>
            <span>Ruta shell</span>
            <strong>{project.path}</strong>
          </article>
          <article>
            <span>Microfronts</span>
            <strong>{String(project.microfrontends?.length || 0)}</strong>
          </article>
        </div>
        <ShellMicrofrontList
          microfronts={project.microfrontends}
          branchOperation={state.microfrontendBranch}
          buildOperation={state.microfrontendBuild}
          operations={state.microfrontendOperations}
          disabled={interactionsDisabled}
          onChangeBranch={(microfront, branch) =>
            onChangeMicrofrontBranch?.(project, microfront, branch)
          }
          onChangeBranchBatch={(microfronts, branch) => onChangeMicrofrontBranchBatch?.(project, microfronts, branch)}
          onBuildBatch={(microfronts) => onBuildMicrofrontBatch?.(project, microfronts)}
          onMicrofrontDetail={onMicrofrontDetail}
          onRefresh={onRefresh}
        />
      </section>
    </div>
  );
}
