import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useAppNavigation() {
  const location = useLocation();
  const routerNavigate = useNavigate();

  const shellDetailId = useMemo(
    () => location.pathname.match(/^\/shells\/([^/]+)(?:\/|$)/)?.[1] || "",
    [location.pathname],
  );

  const microfrontDetailId = useMemo(
    () => location.pathname.match(/^\/shells\/[^/]+\/([^/]+)$/)?.[1] || "",
    [location.pathname],
  );

  const activeView = useMemo(() => {
    if (location.pathname === "/shells" || shellDetailId) return "shells";
    if (location.pathname === "/microfronts") return "microfronts";
    if (location.pathname === "/tags") return "tags";
    return "home";
  }, [location.pathname, shellDetailId]);

  const microfrontFilter = useMemo(
    () => new URLSearchParams(location.search).get("microfront") || "",
    [location.search],
  );

  const navigate = useCallback(
    (view, shellSearch = "", microfrontId = "", projectId = "") => {
      const pathname =
        view === "shells"
          ? "/shells"
          : view === "microfronts"
            ? "/microfronts"
            : view === "tags"
              ? "/tags"
              : "/home";
      const searchParams = new URLSearchParams();
      if (microfrontId) searchParams.set("microfront", microfrontId);
      if (projectId) searchParams.set("project", projectId);
      routerNavigate({
        pathname,
        search: searchParams.toString() ? `?${searchParams}` : "",
      });
    },
    [routerNavigate],
  );

  const setMicrofrontProject = useCallback(
    (project) => {
      if (project)
        routerNavigate({
          pathname: "/microfronts",
          search: `?project=${encodeURIComponent(project.id)}`,
        });
    },
    [routerNavigate],
  );

  return {
    location,
    routerNavigate,
    shellDetailId,
    microfrontDetailId,
    activeView,
    microfrontFilter,
    navigate,
    setMicrofrontProject,
  };
}
