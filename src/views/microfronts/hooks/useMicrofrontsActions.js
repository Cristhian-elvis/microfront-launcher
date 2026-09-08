import { useCallback } from "react";
import { api } from "../../../lib/api.js";

export function useMicrofrontsActions(flash, refreshProjects) {

  const action = useCallback(
    async (url, body) => {
      try {
        await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash],
  );

  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        await refreshProjects();
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshProjects],
  );

  const onOpen = useCallback(
    (project, microfrontend) =>
      action("/api/microfrontends/open", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    [action],
  );

  const onBuild = useCallback(
    (project, microfrontend) =>
      startMicrofrontendAction("/api/microfrontends/build", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    [startMicrofrontendAction],
  );

  return {
    onOpen,
    onBuild,
  };
}
