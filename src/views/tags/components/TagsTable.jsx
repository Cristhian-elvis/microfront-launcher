import { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Icon } from "../../../shared/components/Icon.jsx";

function tagState(item, build) {
  if (build?.tag === item.tag && build.status === "building") {
    return {
      tone: "starting",
      compilation: "Sin compilar",
      check: build.message || "Compilación en curso",
    };
  }
  if (build?.tag === item.tag && build.status === "error") {
    return {
      tone: "error",
      compilation: "Sin compilar",
      check: build.message || "Falló la compilación",
    };
  }
  if (item.cached) {
    return {
      tone: "active",
      compilation: "Compilado",
      check: item.preferred ? "Versión seleccionada" : "Build disponible",
    };
  }
  return {
    tone: "stopped",
    compilation: "Sin compilar",
    check: "No hay un proceso ejecutado",
  };
}

function buildProcessState(item, build, processes) {
  const activeProcess = processes.find((process) =>
    process.key.startsWith("build:"),
  );
  if (build?.tag === item.tag && build.status === "building") {
    const steps = {
      "build:clone": "Clonando repositorio",
      "build:checkout": "Obteniendo tag",
      "build:install": "Instalando dependencias",
      "build:compile": "Compilando librería",
    };
    return {
      tone: "starting",
      check: steps[activeProcess?.key] || "Preparando compilación",
    };
  }
  if (build?.tag === item.tag && build.status === "error") {
    return {
      tone: "error",
      check: build.message || "La compilación falló",
    };
  }
  return { tone: "stopped", check: "—" };
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function TagsTable({
  versions,
  build,
  busy,
  processes = [],
  onBuild,
  onCancelBuild,
  onUse,
  onRefresh,
  preferredTag,
}) {
  const compiledVersions = versions.filter((item) => item.cached);
  const [nextActiveTag, setNextActiveTag] = useState("");
  useEffect(() => {
    const selectedStillAvailable = compiledVersions.some(
      (item) => item.tag === nextActiveTag,
    );
    if ((!nextActiveTag || !selectedStillAvailable) && compiledVersions.length) {
      setNextActiveTag(
        compiledVersions.some((item) => item.tag === preferredTag)
          ? preferredTag
          : compiledVersions[0].tag,
      );
    }
  }, [compiledVersions, nextActiveTag, preferredTag]);
  const activeVersion =
    versions.find((item) => item.tag === preferredTag) ||
    versions.find((item) => item.preferred);
  return (
    <div className="view-panel tags-view">
      <section className="workspace">
        <div className="section-head">
          <div>
            <h2>Tags de MOVA UI Components</h2>
            <p>Compila y selecciona el tag reutilizable por las shells.</p>
          </div>
          <div className="toolbar">
            <button className="button ghost" disabled={busy} onClick={onRefresh}>
              <Icon name="refresh" />
              Actualizar tags
            </button>
          </div>
        </div>
        <div className="shell-directory tags-directory">
          <section className="tag-selection-card" aria-live="polite">
            <div className="tag-selection-card-icon">
              <Icon name="package" size={20} />
            </div>
            <div className="tag-selection-card-copy">
              <FormControl
                className="tag-active-select"
                size="small"
                fullWidth
                disabled={!compiledVersions.length}
              >
                <InputLabel id="active-mova-version-label">
                  Versión activa en las shells
                </InputLabel>
                <Select
                  labelId="active-mova-version-label"
                  id="active-mova-version"
                  label="Versión activa en las shells"
                value={nextActiveTag}
                onChange={(event) => setNextActiveTag(event.target.value)}
                  MenuProps={{
                    PaperProps: {
                      className: "tag-active-menu",
                    },
                  }}
                >
                  {!compiledVersions.length && (
                    <MenuItem value="">No hay versiones compiladas</MenuItem>
                  )}
                  {compiledVersions.map((item) => (
                    <MenuItem key={item.tag} value={item.tag}>
                      {item.tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <small>
                {activeVersion?.cached
                  ? "Build local disponible para las shells."
                  : "No hay un build local disponible para las shells."}
              </small>
            </div>
            <button
              className="button primary tag-apply-action"
              disabled={!nextActiveTag || nextActiveTag === preferredTag}
              onClick={() => onUse(nextActiveTag)}
            >
              <Icon name="check" size={14} />
              Aplicar cambio
            </button>
            {busy && (
              <button
                className="button stop tag-build-action"
                onClick={onCancelBuild}
              >
                <Icon name="stop" size={14} />
                Detener compilación
              </button>
            )}
          </section>
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Fecha</th>
                <th>Estado de compilación</th>
                <th>Chequeo de proceso</th>
                <th className="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((item) => {
                const status = tagState(item, build);
                const process = buildProcessState(item, build, processes);
                return (
                  <tr
                    key={item.tag}
                    className={item.tag === preferredTag ? "in-use" : ""}
                  >
                    <td>
                      <div className="tag-table-name">
                        <Icon name="tag" size={15} />
                        <div className="tag-name-line">
                          <strong>{item.tag}</strong>
                          {item.tag === preferredTag && (
                            <small className="tag-in-use-label">En uso</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="tag-date">{formatDate(item.date)}</td>
                    <td>
                      <span className={`tag-state ${status.tone}`}>
                        <i />
                        {status.compilation}
                      </span>
                    </td>
                    <td>
                      <span className={`shell-health ${process.tone}`}>
                        {process.check}
                      </span>
                    </td>
                    <td className="tag-actions-cell">
                      <button
                        className="button ghost tag-row-action"
                        disabled={busy}
                        onClick={() => onBuild(item.tag)}
                      >
                        <Icon name="play" size={14} />
                        {item.cached ? "Recompilar" : "Compilar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
