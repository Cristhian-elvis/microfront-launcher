import { useCallback } from "react";
import { api } from "../../../lib/api.js";

export function useTagsActions(flash, refreshState) {
  const onBuild = useCallback(
    async (tag) => {
      try {
        await api("/api/mova/build", {
          method: "POST",
          body: JSON.stringify({ tag }),
        });
        void refreshState();
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshState],
  );

  const onCancelBuild = useCallback(
    async () => {
      try {
        await api("/api/mova/build/cancel", {
          method: "POST",
          body: JSON.stringify({}),
        });
        void refreshState();
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshState],
  );

  const onUse = useCallback(
    async (tag) => {
      try {
        const next = await api("/api/mova/preferences", {
          method: "PUT",
          body: JSON.stringify({ preferredTag: tag }),
        });
        await refreshState();
        return next;
      } catch (e) {
        flash(e.message, "error");
        return null;
      }
    },
    [flash, refreshState],
  );

  const onRefresh = useCallback(
    async () => {
      try {
        await api("/api/mova/tags/refresh", {
          method: "POST",
          body: JSON.stringify({}),
        });
        await refreshState();
      } catch (e) {
        flash(e.message, "error");
      }
    },
    [flash, refreshState],
  );

  return {
    onBuild,
    onCancelBuild,
    onUse,
    onRefresh,
  };
}
