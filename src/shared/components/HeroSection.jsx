import React from "react";
import { EnvironmentSummary } from "./EnvironmentSummary.jsx";
import { SessionStatus } from "./SessionStatus.jsx";

export function HeroSection({
  environmentLabel,
  shellName,
  componentVersion,
  componentsActive,
  state,
  onNavigateToTags,
  onComponentStop,
  onComponentStart,
  onMicrofronts,
  onOpenBrowser,
  onOpenBrowserTab,
  onSelectShell,
  onStop,
  projects,
}) {
  return (
    <section className="hero v2 compact-hero">
      <div>
        <p className="eyebrow">CENTRO DE OPERACIONES</p>
        <h1>
          Tu entorno local,
          <br />
          <em>bajo control.</em>
        </h1>
        <p className="hero-copy">
          Una shell, un servidor HTTP y los proyectos locales que abres en
          VS Code.
        </p>
      </div>
      <EnvironmentSummary
        environmentLabel={environmentLabel}
        shellName={shellName}
        componentVersion={componentVersion}
        componentsActive={componentsActive}
        state={state}
        onNavigateToTags={onNavigateToTags}
        onComponentStop={onComponentStop}
        onComponentStart={onComponentStart}
      />
      <SessionStatus
        state={state}
        onMicrofronts={onMicrofronts}
        onOpenBrowser={onOpenBrowser}
        onOpenBrowserTab={onOpenBrowserTab}
        onSelectShell={onSelectShell}
        onStop={onStop}
        projects={projects}
      />
    </section>
  );
}
