import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api.js";

export function useProcessLogs(onError) {
  const [logs, setLogs] = useState([]);
  const clearedAt = useRef(0);
  const refreshLogs = useCallback(async () => {
    try {
      const next = await api("/api/logs");
      setLogs(next.filter((entry) => Date.parse(entry.at) > clearedAt.current));
    } catch (error) { onError?.(error.message); }
  }, [onError]);
  useEffect(() => { refreshLogs(); }, [refreshLogs]);
  const receiveLog = useCallback((entry) => {
    if (Date.parse(entry.at) > clearedAt.current) setLogs((current) => [...current.slice(-499), entry]);
  }, []);
  const clearLogs = useCallback(() => {
    clearedAt.current = Date.now();
    setLogs([]);
  }, []);
  return { logs, refreshLogs, receiveLog, clearLogs };
}
