import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import { useMatch } from "react-router-dom";
import { useAppNavigation } from "../hooks/useAppNavigation.js";
import { useProjects } from "../hooks/useProjects.js";

export function AppBreadcrumbs({ onNavigate, routerNavigate }) {
  const { activeView } = useAppNavigation();
  const shellMatch = useMatch("/shells/:shellId");
  const microfrontMatch = useMatch("/shells/:shellId/:microfrontId");
  const shellId = microfrontMatch?.params.shellId || shellMatch?.params.shellId;
  const microfrontId = microfrontMatch?.params.microfrontId;
  const { projects } = useProjects();

  const shellName = shellId
    ? projects.find((p) => p.id === decodeURIComponent(shellId))?.name
    : null;

  const microfrontName =
    shellId && microfrontId
      ? projects
          .find((p) => p.id === decodeURIComponent(shellId))
          ?.microfrontends?.find(
            (mf) => mf.id === decodeURIComponent(microfrontId)
          )?.name
      : null;
  if (activeView === "home") return null;
  const items = [{ label: "Inicio", view: "home" }];
  if (activeView === "shells") items.push({ label: "Shells", view: "shells" });
  if (activeView === "microfronts")
    items.push({ label: "Microfronts", view: "microfronts" });
  if (activeView === "tags")
    items.push({ label: "Tags de MOVA", view: "tags" });
  if (shellName) items.push({ label: shellName.toUpperCase(), shellId, action: "goToShell" });
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
