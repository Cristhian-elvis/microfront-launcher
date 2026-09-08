import { ShellsView } from "./components/ShellsView.jsx";
import { useProjects } from "../../shared/hooks/useProjects.js";

export function ShellsPage(props) {
  const { refreshProjects } = useProjects();
  return (
    <ShellsView
      {...props}
      onRefresh={() => refreshProjects({ force: true })}
    />
  );
}
