import { useCallback } from "react";
import { api } from "../../../lib/api.js";

export function useTagsActions(flash, refreshState, refreshVersions) {
  const onBuild = useCallback(
    async (tag) => {
      try {
        await api("/api/mova/build", {
          method: "POST",
          body: JSON.stringify({ tag }),
        });
        void refreshState();
      } catch (error) {
        flash(error.message, "error");
      }
    },
    [flash, refreshState],
  );

  const onRefreshTags = useCallback(async () => {
    try {
      const result = await api("/api/mova/tags/refresh", {
        method: "POST",
      });
      await refreshVersions();
      flash(result.message);
    } catch (error) {
      flash(error.message, "error");
    }
  }, [flash, refreshVersions]);

  return { onBuild, onRefreshTags };
}
