import { useCallback } from "react";

export function useHomeActions(clearLogs) {
  const onClear = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  return {
    onClear,
  };
}
