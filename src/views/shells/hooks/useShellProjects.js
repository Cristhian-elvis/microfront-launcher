import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api.js";

export function useShellProjects(onError) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api("/api/projects?refresh=1");
      setProjects(next);
      return next;
    } catch (error) {
      onError?.(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [onError]);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);
  return { projects, setProjects, loading, refreshProjects };
}
