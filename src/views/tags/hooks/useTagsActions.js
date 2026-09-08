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
      } catch (error) {
        flash(error.message, "error");
      }
    },
    [flash, refreshState],
  );

  return { onBuild };
}
