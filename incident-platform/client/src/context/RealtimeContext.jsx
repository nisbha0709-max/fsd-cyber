import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const EVENTS = [
  "incident:created",
  "incident:updated",
  "incident:assigned",
  "incident:escalated",
  "incident:response_breached",
  "incident:deleted",
];

const RealtimeCtx = createContext({ subscribe: () => () => {} });

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const { push } = useToast();
  const listeners = useRef(new Map()); // event -> Set(handler)

  const subscribe = useCallback((event, handler) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(handler);
    return () => listeners.current.get(event).delete(handler);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const opts = { auth: { token: localStorage.getItem("token") } };
    const url = import.meta.env.VITE_SOCKET_URL;
    const socket = url ? io(url, opts) : io(opts);

    const alertFor = {
      "incident:created": (p) => [`New ${p.severity} incident ${p.incidentNumber}: ${p.title}`, "alert"],
      "incident:assigned": (p) => [`${p.incidentNumber} was assigned to you`, "alert"],
      "incident:escalated": (p) => [`${p.incidentNumber} missed its resolution deadline and was escalated`, "error"],
      "incident:response_breached": (p) => [`${p.incidentNumber} was not picked up in time`, "error"],
    };

    EVENTS.forEach((event) => {
      socket.on(event, (payload) => {
        (listeners.current.get(event) || []).forEach((fn) => fn(payload));
        if (alertFor[event] && payload) push(...alertFor[event](payload));
      });
    });

    return () => socket.disconnect();
  }, [user, push]);

  const value = useMemo(() => ({ subscribe }), [subscribe]);
  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

// useRealtime(["incident:updated"], (event, payload) => reload())
export function useRealtime(events, handler) {
  const { subscribe } = useContext(RealtimeCtx);
  const latest = useRef(handler);
  latest.current = handler;
  const key = events.join(",");

  useEffect(() => {
    const offs = key.split(",").map((e) => subscribe(e, (payload) => latest.current(e, payload)));
    return () => offs.forEach((off) => off());
  }, [subscribe, key]);
}
