import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import { useAppNavigation } from "../hooks/useAppNavigation.js";
import { useProjects } from "../hooks/useProjects.js";

export function AppBreadcrumbs({ onNavigate, routerNavigate }) {
  const { activeView, shellDetailId, microfrontDetailId } = useAppNavigation();
  const { projects } = useProjects();
  
  const shellName = shellDetailId
    ? projects.find((p) => p.id === decodeURIComponent(shellDetailId))?.name
    : null;
  
  const microfrontName =
    shellDetailId && microfrontDetailId
      ? projects
          .find((p) => p.id === decodeURIComponent(shellDetailId))
          ?.microfrontends?.find(
            (mf) => mf.id === decodeURIComponent(microfrontDetailId)
          )?.name
      : null;
  if (activeView === "home") return null;
  const items = [{ label: "Inicio", view: "home" }];
  if (activeView === "shells") items.push({ label: "Shells", view: "shells" });
  if (activeView === "microfronts")
    items.push({ label: "Microfronts", view: "microfronts" });
  if (activeView === "tags")
    items.push({ label: "Tags de MOVA", view: "tags" });
  if (shellName) items.push({ label: shellName.toUpperCase(), shellId: shellDetailId, action: "goToShell" });
  if (microfrontName) items.push({ label: microfrontName });
  return (
    <Breadcrumbs
      className="app-breadcrumbs"
      separator="›"
      aria-label="Miga de pan"
    >
      {items.map((item, index) =>
        index === items.length - 1 ? (
          <span key={item.label}>{item.label}</span>
        ) : (
          <Link
            key={item.label}
            component="button"
            onClick={() => {
              if (item.action === "goToShell" && routerNavigate) {
                routerNavigate(`/shells/${encodeURIComponent(item.shellId)}`);
              } else {
                onNavigate(item.view);
              }
            }}
            underline="hover"
          >
            {item.label}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
