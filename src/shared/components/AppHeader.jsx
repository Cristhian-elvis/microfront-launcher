import React from "react";
import { Icon } from "./Icon.jsx";

export function AppHeader({
  theme,
  onThemeToggle,
  state,
  onOpenBrowser,
  onOpenSettings,
}) {
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
        <button className="avatar">CV</button>
      </div>
    </header>
  );
}
