import { Icon } from "../../../shared/components/Icon.jsx";
import { ShellMicrofrontList } from "./ShellMicrofrontList.jsx";

export function ShellDetailView({
  project,
  state,
  refreshing,
  onBack,
  onOpenWebapp,
  onStart,
  isStartingShell = false,
  onStop,
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
  const webappName = project.appName || "Sin configurar";
  const webappPath =
    project.appName && project.serverPath
      ? `${project.serverPath}\\${project.appName}`
      : "No disponible";
  const operationActive =
    state.session.projectId === project.id &&
    ["starting", "building"].includes(state.session.status);
  const shellRunning =
    state.shell.projectId === project.id && state.shell.status === "running";
  const anotherShellRunning =
    state.shell.status !== "stopped" && state.shell.projectId !== project.id;
  const cannotStart = state.busy || anotherShellRunning || !project.configured || isStartingShell;
  const cannotRebuild = state.busy || anotherShellRunning;
  return (
    <div className="view-panel shell-detail-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <div className="shell-detail-title">
              <h2>Proyecto: {project.name.toUpperCase()}</h2>
              <button
                className={`icon-button ${favorite ? "favorite" : ""}`}
                title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
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
              disabled={refreshing}
              onClick={onRefresh}
            >
              <Icon name={refreshing ? "loader" : "refresh"} />
              {refreshing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              className="button ghost"
              title="Reconstruir todo: prepara el servidor y reconstruye el build local"
              disabled={cannotRebuild || refreshing}
              onClick={() => onRebuild(project)}
            >
              <Icon name="refresh" />
              Reconstruir todo
            </button>
            {shellRunning ? (
              <button
                className="button stop"
                title="Detener shell"
                disabled={refreshing}
                onClick={onStop}
              >
                <Icon name="stop" />
                Detener shell
              </button>
            ) : operationActive || isStartingShell ? (
              <button
                className="button stop shell-start-button is-starting"
                title="Iniciando shell"
                disabled
              >
                <span className="shell-start-status" />
                Iniciando...
              </button>
            ) : (
              <button
                className="button primary shell-start-button"
                title={
                  project.configured
                    ? "Iniciar shell"
                    : "La shell requiere configuración"
                }
                disabled={cannotStart || refreshing}
                onClick={() => onStart(project)}
              >
                <Icon name="play" />
                Iniciar shell
              </button>
            )}
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
              disabled={!project.appName || !project.serverPath}
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
          disabled={refreshing}
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
