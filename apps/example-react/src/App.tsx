import { useState, useEffect, useCallback } from "react";
import {
  init,
  track,
  identify,
  page,
  getConnectionState,
  type ConnectionState,
  type EventProps,
} from "@beacon/sdk";
import { type LogEntry, generateId } from "@beacon/example-shared";
import Header from "./components/Header";
import AuthCard from "./components/AuthCard";
import ActionsCard from "./components/ActionsCard";
import HowItWorks from "./components/HowItWorks";
import FlagsCard from "./components/FlagsCard";
import EventLog from "./components/EventLog";

const STORAGE_KEY = "beacon_example_user";

function getCurrentUser(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

function setCurrentUser(userId: string | null): void {
  if (userId) {
    sessionStorage.setItem(STORAGE_KEY, userId);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export default function App() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [currentUser, setCurrentUserState] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      { ...entry, id: generateId(), timestamp: new Date() },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const logEvent = useCallback(
    (eventName: string, props?: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {
        type: "event",
        event: eventName,
        props: JSON.stringify(props || {}),
        ts: Date.now(),
      };
      if (currentUser) {
        payload.userId = currentUser;
      }
      addLog({
        type: "event",
        message: `<strong>${eventName}</strong>`,
        direction: "sent",
        payload,
      });
    },
    [addLog, currentUser],
  );

  const logIdentify = useCallback(
    (userId: string, traits?: Record<string, unknown>) => {
      addLog({
        type: "identify",
        message: `Identified as <strong>${userId}</strong>`,
        direction: "sent",
        payload: {
          type: "identify",
          userId,
          traits: JSON.stringify(traits || {}),
        },
      });
    },
    [addLog],
  );

  const logPage = useCallback(
    (props?: Record<string, unknown>) => {
      const fullProps = {
        url: window.location.href,
        path: window.location.pathname,
        ref: document.referrer,
        ...props,
      };
      const payload: Record<string, unknown> = {
        type: "event",
        event: "$page",
        props: JSON.stringify(fullProps),
        ts: Date.now(),
      };
      if (currentUser) {
        payload.userId = currentUser;
      }
      addLog({
        type: "page",
        message: "<strong>$page</strong> view",
        direction: "sent",
        payload,
      });
    },
    [addLog, currentUser],
  );

  const logConnection = useCallback(
    (state: ConnectionState) => {
      addLog({
        type: "connection",
        message: `Connection: <strong>${state}</strong>`,
        direction: "system",
      });
    },
    [addLog],
  );

  const logFlags = useCallback(
    (newFlags: Record<string, boolean>) => {
      const count = Object.keys(newFlags).length;
      addLog({
        type: "flags",
        message: `Received <strong>${count}</strong> flag${count !== 1 ? "s" : ""}`,
        direction: "received",
        payload: { type: "flags", flags: newFlags },
      });
    },
    [addLog],
  );

  const logInfo = useCallback(
    (message: string) => {
      addLog({
        type: "info",
        message,
        direction: "system",
      });
    },
    [addLog],
  );

  const logError = useCallback(
    (message: string) => {
      addLog({
        type: "error",
        message,
        direction: "system",
      });
    },
    [addLog],
  );

  // Initialize SDK
  useEffect(() => {
    logInfo("Initializing Beacon SDK...");

    init({
      url: "http://localhost:4000",
      apiKey: "test_api_key_12345",
      onConnectionChange: (state) => {
        setConnectionState(state);
        logConnection(state);
      },
      onError: (error) => logError(error),
    });

    // Track initial page view
    page({ page_name: "home" });
    logPage({ page_name: "home" });

    // Restore session
    const existingUser = getCurrentUser();
    if (existingUser) {
      setCurrentUserState(existingUser);
      identify(existingUser);
      logInfo(`Restored session for ${existingUser}`);
    } else {
      logInfo("Tracking as anonymous user");
    }

    // Set initial connection state
    setConnectionState(getConnectionState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for flag updates
  useEffect(() => {
    const handleFlags = (event: CustomEvent<Record<string, boolean>>) => {
      setFlags(event.detail);
      logFlags(event.detail);
    };

    window.addEventListener("beacon:flags", handleFlags as EventListener);

    return () => {
      window.removeEventListener("beacon:flags", handleFlags as EventListener);
    };
  }, [logFlags]);

  const handleLogin = useCallback(
    (username: string) => {
      setCurrentUser(username);
      setCurrentUserState(username);

      const traits = { signed_up_at: new Date().toISOString() };
      identify(username, traits);
      logIdentify(username, traits);

      const eventProps = { method: "form" };
      track("user_signed_in", eventProps);
      logEvent("user_signed_in", eventProps);

      logInfo("Anonymous activity is now linked to this user");
    },
    [logIdentify, logEvent, logInfo],
  );

  const handleLogout = useCallback(() => {
    const previousUser = currentUser;

    track("user_signed_out");
    logEvent("user_signed_out");

    setCurrentUser(null);
    setCurrentUserState(null);
    logInfo(`Signed out from ${previousUser}`);
  }, [currentUser, logEvent, logInfo]);

  const handleTrackEvent = useCallback(
    (eventName: string, props: EventProps) => {
      track(eventName, props);
      logEvent(eventName, props);
    },
    [logEvent],
  );

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <div className="app">
      <Header connectionState={connectionState} currentUser={currentUser} />

      <main className="main">
        <div className="controls-column">
          <AuthCard
            currentUser={currentUser}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
          <ActionsCard onTrackEvent={handleTrackEvent} />
          <HowItWorks />
          <FlagsCard flags={flags} />
        </div>

        <div className="log-column">
          <EventLog logs={logs} onClear={handleClearLogs} />
        </div>
      </main>
    </div>
  );
}
