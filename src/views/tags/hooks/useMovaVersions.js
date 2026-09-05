import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api.js";

export function useMovaVersions(onError) {
  const [versions, setVersions] = useState([]);
  const refreshVersions = useCallback(async () => {
    try {
      const next = await api("/api/mova/versions");
      setVersions(next);
      return next;
    } catch (error) {
      onError?.(error.message);
      return [];
    }
  }, [onError]);
  useEffect(() => { refreshVersions(); }, [refreshVersions]);
  return { versions, refreshVersions };
}
