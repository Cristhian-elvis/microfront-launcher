import { ProcessConsole } from "./components/ProcessConsole.jsx";

export function HomePage({ logs, state, tab, onTab, onClear, logEnd }) {
  return (
    <div className="view-panel home-view">
      <ProcessConsole
        logs={logs}
        state={state}
        tab={tab}
        onTab={onTab}
        onClear={onClear}
        logEnd={logEnd}
      />
    </div>
  );
}
