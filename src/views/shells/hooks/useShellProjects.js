import { useProjects } from "../../../shared/hooks/useProjects.js";

export function useShellProjects() {
  const { projects, loading, refreshProjects } = useProjects();
  return { projects, loading, refreshProjects };
}
