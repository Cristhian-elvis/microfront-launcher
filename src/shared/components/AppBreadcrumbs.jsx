import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";

export function AppBreadcrumbs({ activeView, shellName, onNavigate }) {
  if (activeView === "home") return null;
  const items = [{ label: "Inicio", view: "home" }];
  if (activeView === "shells") items.push({ label: "Shells", view: "shells" });
  if (activeView === "microfronts")
    items.push({ label: "Microfronts", view: "microfronts" });
  if (activeView === "tags")
    items.push({ label: "Tags de MOVA", view: "tags" });
  if (shellName) items.push({ label: shellName.toUpperCase() });
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
            onClick={() => onNavigate(item.view)}
            underline="hover"
          >
            {item.label}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
