import { useCallback } from "react";
import { api } from "../../../lib/api.js";

export function useMicrofrontsActions(flash, refreshProjects) {
  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        await api(url, {
          method: "POST",
          body: JSON.stringify(body || {}),
        });
        void refreshProjects();
      } catch (e) {
        flash(e.message, "error");
        throw e;
      }
    },
    [flash, refreshProjects],
  );

  const onOpen = useCallback(
    (project, microfrontend) =>
      startMicrofrontendAction("/api/microfrontends/open", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    [startMicrofrontendAction],
  );

  const onBuild = useCallback(
    (project, microfrontend) =>
      startMicrofrontendAction("/api/microfrontends/build", {
        projectId: project.id,
        microfrontendId: microfrontend.id,
      }),
    [startMicrofrontendAction],
  );

  const onRefresh = useCallback(() => {
    return refreshProjects();
  }, [refreshProjects]);

  return {
    onOpen,
    onBuild,
    onRefresh,
  };
}
