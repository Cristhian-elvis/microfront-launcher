import { Icon } from "../../../shared/components/Icon.jsx";
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from "@mui/material";
import "./MicrofrontDetailView.css";

import { useState } from "react";

export function MicrofrontDetailView({
  project,
  microfront,
  state,
  refreshing,
  onBack,
  onOpenFolder,
  onOpenVsCode,
  onBuild,
  onChangeBranch,
  onRefresh,
  onFetchBranch,
}) {
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");

  if (!project || !microfront)
    return (
      <div className="view-panel microfront-detail-view">
        <section className="workspace">
          <div className="empty">
            <p>El microfront solicitado no existe.</p>
            <button className="button ghost" onClick={onBack}>
              Volver
            </button>
          </div>
        </section>
      </div>
    );

  const buildOperation = state.microfrontendBuild;
  const branchOperation = state.microfrontendBranch;
  const rowBuildOperation =
    state.microfrontendOperations?.[`build:${microfront.id}`];
  const rowBranchOperation =
    state.microfrontendOperations?.[`branch:${microfront.id}`];

  const isBuilding =
    buildOperation?.microfrontendId === microfront.id &&
    buildOperation?.status === "running";
  const isChangingBranch =
    branchOperation?.microfrontendId === microfront.id &&
    branchOperation?.status === "running";

  const busy = refreshing || isBuilding || isChangingBranch;

  const handleApply = () => {
    if (selectedAction === "build") {
      onBuild(project.id, microfront.id);
    } else if (selectedAction === "refresh") {
      onRefresh(project.id, microfront.id);
    } else if (selectedAction === "branch" && selectedBranch) {
      onChangeBranch(project.id, microfront.id, selectedBranch);
    } else if (selectedAction === "fetch") {
      onFetchBranch?.(project.id, microfront.id);
    }
    setSelectedAction("");
    setSelectedBranch("");
  };

  return (
    <div className="view-panel microfront-detail-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <div className="microfront-detail-title">
              <h2>{microfront.name}</h2>
            </div>
            <p>Detalles y acciones del microfront</p>
          </div>
          <div className="toolbar microfront-detail-actions">
            <FormControl sx={{ minWidth: 160 }} size="small" disabled={busy}>
              <InputLabel id="action-select-label">Acción</InputLabel>
              <Select
                labelId="action-select-label"
                id="action-select"
                value={selectedAction}
                label="Acción"
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setSelectedBranch("");
                }}
              >
                <MenuItem value="">Seleccionar acción…</MenuItem>
                <MenuItem value="build">Compilar</MenuItem>
                <MenuItem value="refresh">Sincronizar</MenuItem>
                {microfront.branches && microfront.branches.length > 0 && (
                  <MenuItem value="branch">Cambiar rama</MenuItem>
                )}
                {onFetchBranch && (
                  <MenuItem value="fetch">Actualizar rama</MenuItem>
                )}
              </Select>
            </FormControl>

            {selectedAction === "branch" && microfront.branches?.length > 0 && (
              <FormControl sx={{ minWidth: 160 }} size="small" disabled={busy}>
                <InputLabel id="branch-select-label">Rama destino</InputLabel>
                <Select
                  labelId="branch-select-label"
                  id="branch-select"
                  value={selectedBranch}
                  label="Rama destino"
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <MenuItem value="">Seleccionar rama…</MenuItem>
                  {microfront.branches.map((branch) => (
                    <MenuItem key={branch} value={branch}>
                      {branch}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {selectedAction &&
              (selectedAction !== "branch" || selectedBranch) && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy}
                  onClick={handleApply}
                >
                  Aplicar
                </Button>
              )}
          </div>
        </div>

        {microfront.outOfSync && (
          <div className="microfront-out-of-sync">
            <span className="out-of-sync-warning">
              ⚠️ Cambios pendientes por descargar
            </span>
          </div>
        )}

        <div className="microfront-detail-grid">
          <article className="microfront-detail-info">
            <span>Ruta local</span>
            <code>{microfront.path}</code>
            <button
              className="button ghost microfront-detail-action"
              disabled={busy}
              onClick={() => onOpenFolder(project.id, microfront.id)}
            >
              <Icon name="folder" size={15} />
              Abrir en explorador
            </button>
          </article>

          <article className="microfront-detail-info">
            <span>Abrir en editor</span>
            <strong>VS Code</strong>
            <button
              className="button ghost microfront-detail-action"
              disabled={busy}
              onClick={() => onOpenVsCode(project.id, microfront.id)}
            >
              <Icon name="vscode" size={15} />
              Abrir en VS Code
            </button>
          </article>

          <article className="microfront-detail-info">
            <span>Rama actual</span>
            <strong>{microfront.branch || "No disponible"}</strong>
          </article>

          <article className="microfront-detail-info">
            <span>Build local</span>
            <strong>
              {isBuilding
                ? "Compilando..."
                : microfront.localBuildAvailable
                  ? "Disponible"
                  : "No disponible"}
            </strong>
          </article>
        </div>

        {(buildOperation?.microfrontendId === microfront.id ||
          branchOperation?.microfrontendId === microfront.id) && (
          <div className="microfront-operation-status">
            <h3>Estado de la operación</h3>
            <div
              className={`status-info ${buildOperation?.status || branchOperation?.status}`}
            >
              <Icon
                name={
                  buildOperation?.status === "running" ||
                  branchOperation?.status === "running"
                    ? "loader"
                    : buildOperation?.status === "error" ||
                        branchOperation?.status === "error"
                      ? "alert"
                      : "check"
                }
              />
              <div>
                <p className="status-message">
                  {buildOperation?.message || branchOperation?.message}
                </p>
                {(buildOperation?.error || branchOperation?.error) && (
                  <p className="status-error">
                    {buildOperation?.error || branchOperation?.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
