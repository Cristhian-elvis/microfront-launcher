import { useEffect } from "react";
import { api } from "../../lib/api.js";

export function useLauncherEvents({ onLog, onState }) {
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === "log") onLog?.(event.payload);
      if (event.type === "state") onState?.(event.payload);
      if (event.type === "processes" || event.type === "servers") api("/api/state").then(onState).catch(() => {});
    };
    return () => events.close();
  }, [onLog, onState]);
}
