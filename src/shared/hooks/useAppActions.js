import { useCallback } from "react";
import { api } from "../../lib/api.js";

export function useAppActions(flash, refreshProjects, refreshState, refreshVersions) {
  const action = useCallback(
    async (url, body, options = {}) => {
      const { refreshProjectsAfter = false, refreshStateAfter = true } = options;
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        if (refreshProjectsAfter && refreshStateAfter) {
          await Promise.all([refreshProjects(), refreshState()]);
        } else if (refreshProjectsAfter) {
          await refreshProjects();
        } else if (refreshStateAfter) {
          await refreshState();
        }
        return result;
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshProjects, refreshState],
  );

  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        await refreshState();
        return result;
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshState],
  );

  const startShell = useCallback(
    async (project) => {
      await action("/api/environment/start", { projectId: project.id }, {
        refreshProjectsAfter: false,
        refreshStateAfter: false,
      });
    },
    [action],
  );

  const rebuildServer = useCallback(
    async (project) => {
      await action("/api/shell/rebuild", { projectId: project.id }, {
        refreshProjectsAfter: false,
        refreshStateAfter: true,
      });
    },
    [action],
  );

  const preferences = useCallback(
    async (setState, state, patch, reload = true) => {
      try {
        const next = await api("/api/mova/preferences", {
          method: "PUT",
          body: JSON.stringify(patch),
        });
        setState((current) => ({
          ...current,
          preferences: { ...current.preferences, ...next },
        }));
        if (reload) await refreshState();
        return next;
      } catch (e) {
        flash(e.message, "error");
        return null;
      }
    },
    [flash, refreshState],
  );

  const remove = useCallback(
    async (project) => {
      if (
        !confirm(
          `¿Quitar "${project.name}" de la lista? No se borrarán archivos.`,
        )
      )
        return;
      try {
        await api(`/api/projects/${project.id}`, { method: "DELETE" });
        await refreshProjects();
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshProjects],
  );

  return {
    action,
    startMicrofrontendAction,
    startShell,
    rebuildServer,
    preferences,
    remove,
  };
}
