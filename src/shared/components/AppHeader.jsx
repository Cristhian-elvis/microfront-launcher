import React, { useCallback, useState } from "react";
import { Icon } from "./Icon.jsx";
import { useFlash } from "../hooks/useFlash.js";
import { api } from "../../lib/api.js";

export function AppHeader({
  theme,
  onThemeToggle,
  state,
  onOpenBrowser,
  onOpenProfessionalDesktop,
  onOpenConsole,
  onOpenSettings,
}) {
  const { flash } = useFlash();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const checkLauncherUpdates = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      const result = await api("/api/launcher/check-updates", { method: "POST" });
      if (result.hasUpdates) {
        flash(
          `Hay ${result.behind} cambio${result.behind === 1 ? "" : "s"} pendiente${result.behind === 1 ? "" : "s"} de master. Ejecuta "git pull" para bajarlos.`,
          "error",
        );
      } else {
        flash("El launcher está actualizado con master.", "success");
      }
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setCheckingUpdates(false);
    }
  }, [flash]);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-icon">
          <Icon name="terminal" size={23} />
        </div>
        <div>
          <strong>Microfront</strong>
          <span>Launcher V2</span>
        </div>
        <button
          className="button ghost"
          onClick={checkLauncherUpdates}
          disabled={checkingUpdates}
          title="Buscar cambios pendientes de master"
        >
          <Icon name="refresh" />
          {checkingUpdates ? "Buscando..." : "Buscar actualizaciones"}
        </button>
      </div>
      <div className="top-actions">
        <button
          className="button ghost theme-toggle"
          onClick={onThemeToggle}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
          {theme === "dark" ? "Claro" : "Oscuro"}
        </button>
        <button
          className="button ghost"
          onClick={onOpenBrowser}
        >
          <Icon name="external" />
          Abrir navegador
        </button>
        <button
          className="button ghost"
          onClick={onOpenConsole}
        >
          <Icon name="terminal" />
          Visualizar consola
        </button>
        <button
          className="button ghost"
          onClick={onOpenProfessionalDesktop}
        >
          <Icon name="external" />
          Abrir escritorio profesional
        </button>
        <button
          className="button ghost"
          disabled={state.busy || state.shell.status !== "stopped"}
          title={
            state.busy || state.shell.status !== "stopped"
              ? "Detén el entorno antes de cambiar la configuración."
              : "Configuración"
          }
          onClick={onOpenSettings}
        >
          <Icon name="settings" />
          Configuración
        </button>
        <button className="avatar">
          {(state?.preferences?.avatarLetters || "ML").slice(0, 2).toUpperCase()}
        </button>
      </div>
    </header>
  );
}
