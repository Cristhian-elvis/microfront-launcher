/**
 * VersionsAuditPage
 * -----------------
 * Vista de “Estado versiones” para una Shell.
 *
 * Responsabilidad:
 * - Consumir el backend (/api/versions-audit) para comparar:
 *   - version del `package.json` de cada microfront local
 *   - vs. la version configurada en `app-config.json` por entorno (des/val/prod/local).
 * - Exponer una acción segura “Actualizar versiones” que dispara
 *   POST /api/versions-audit/update, con guardrails:
 *   - La UI habilita el botón solo si el backend indica `canUpdate === true`
 *   - `canUpdate` se calcula con la regla solicitada: TODOS los microfronts en main/master.
 *
 * Nota:
 * - La vista no “deduce” reglas críticas localmente; el backend también valida la regla main/master
 *   para evitar actualizaciones inválidas por manipulación del cliente.
 */
import "./VersionsAuditPage.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useFlash } from "../../shared/hooks/useFlash.js";
import { Icon } from "../../shared/components/Icon.jsx";

function statusLabel(matches) {
  return matches ? "Coincide" : "No coincide";
}

function statusClass(matches) {
  return matches ? "status-ok" : "status-bad";
}

export function VersionsAuditPage() {
  const { shellId } = useParams();
  const projectId = decodeURIComponent(shellId || "");
  const navigate = useNavigate();
  const { flash } = useFlash();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(
        `/api/versions-audit?projectId=${encodeURIComponent(projectId)}`,
      );
      setData(result);
    } catch (e) {
      flash(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [flash, projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = data?.rows || [];
  const canUpdate = Boolean(data?.canUpdate);

  const hasAnyMismatch = useMemo(
    () => rows.some((r) => !r.overallMatches),
    [rows],
  );

  const onUpdate = useCallback(async () => {
    if (!canUpdate || updating) return;
    setUpdating(true);
    try {
      const result = await api("/api/versions-audit/update", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
      flash(
        `Versiones actualizadas: ${(result.updatedEnvironments || []).join(", ") || "-"}`,
        "success",
      );
      await refresh();
    } catch (e) {
      flash(e.message, "error");
    } finally {
      setUpdating(false);
    }
  }, [canUpdate, flash, projectId, refresh, updating]);

  if (loading)
    return (
      <div className="view-panel">
        <section className="workspace">
          <div className="empty">
            <div className="loader" />
            <p>Cargando auditoría de versiones…</p>
          </div>
        </section>
      </div>
    );

  if (!data)
    return (
      <div className="view-panel">
        <section className="workspace">
          <div className="empty">
            <p>No se pudo cargar el estado de versiones.</p>
            <button className="button ghost" onClick={() => navigate(-1)}>
              Volver
            </button>
          </div>
        </section>
      </div>
    );

  return (
    <div className="view-panel versions-audit-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <h2>Estado versiones</h2>
            <p>
              Comparación entre la versión del <code>package.json</code> de cada
              microfront y las versiones configuradas en entornos.
            </p>
          </div>
          <div className="toolbar shell-detail-actions">
            <button className="button ghost" onClick={() => navigate(-1)}>
              <Icon name="chevron-left" />
              Volver
            </button>
            <button
              className="button ghost"
              title={
                canUpdate
                  ? "Actualizar versiones en des/val/prod/local"
                  : "Disponible solo si TODOS los microfronts están en main o master"
              }
              disabled={!canUpdate || updating}
              onClick={onUpdate}
            >
              <Icon name={updating ? "loader" : "refresh"} />
              {updating ? "Actualizando..." : "Actualizar versiones"}
            </button>
          </div>
        </div>

        <div className="versions-audit-summary">
          <div className={`pill ${hasAnyMismatch ? "warn" : "ok"}`}>
            {hasAnyMismatch ? "Hay diferencias" : "Todo coincide"}
          </div>
          <div className="versions-audit-paths">
            <span>Webapp:</span> <code>{data.webappPath}</code>
          </div>
        </div>

        <div className="versions-audit-table">
          <div className="versions-audit-columns">
            <span>Microfront</span>
            <span>Rama</span>
            <span>package.json</span>
            <span>des</span>
            <span>val</span>
            <span>prod</span>
            <span>local</span>
          </div>

          <div className="versions-audit-rows">
            {rows.map((row) => (
              <div
                key={row.microfrontend.id}
                className={`versions-audit-row ${
                  row.overallMatches ? "ok" : "warn"
                }`}
              >
                <div className="versions-audit-mf">
                  <div className="versions-audit-mf-title">
                    <Icon name="box" />
                    <div>
                      <strong>{row.microfrontend.name}</strong>
                      <code>{row.microfrontend.path}</code>
                    </div>
                  </div>
                </div>

                <div className="versions-audit-branch">
                  <code>{row.microfrontend.branch}</code>
                </div>

                <div className="versions-audit-pkg">
                  <code>{row.microfrontend.version || "-"}</code>
                </div>

                {["des", "val", "prod", "local"].map((env) => {
                  const s = row.environments?.[env];
                  const matches = Boolean(s?.matches);
                  return (
                    <div
                      key={env}
                      className={`versions-audit-env ${statusClass(matches)}`}
                    >
                      <span className="versions-audit-env-status">
                        {statusLabel(matches)}
                      </span>
                      <code className="versions-audit-env-version">
                        {s?.version ?? "-"}
                      </code>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="versions-audit-footnote">
          <p>
            Regla del entorno <strong>local</strong>: se resuelve usando el
            nombre dinámico de carpeta raíz del proyecto (basename de la
            webapp), por ejemplo <code>hcen_webapp_centros</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
