import {
  init,
  track,
  identify,
  page,
  getConnectionState,
  type ConnectionState,
} from "@beacon/sdk";
import "./style.css";

// DOM elements
const connectionStatus = document.getElementById("connection-status")!;
const statusDot = connectionStatus.querySelector(".status-dot")!;
const statusText = connectionStatus.querySelector(".status-text")!;
const btnTrack = document.getElementById("btn-track")!;
const btnIdentify = document.getElementById("btn-identify")!;
const btnPage = document.getElementById("btn-page")!;
const flagsContainer = document.getElementById("flags-container")!;
const eventLog = document.getElementById("event-log")!;

let eventCounter = 0;

function log(message: string, type: "info" | "success" | "error" = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span> ${message}`;
  eventLog.insertBefore(entry, eventLog.firstChild);

  // Keep only last 50 entries
  while (eventLog.children.length > 50) {
    eventLog.removeChild(eventLog.lastChild!);
  }
}

function updateConnectionStatus(state: ConnectionState) {
  statusDot.className = `status-dot status-${state}`;
  statusText.textContent =
    state.charAt(0).toUpperCase() + state.slice(1);
  log(`Connection state: ${state}`, state === "connected" ? "success" : "info");
}

function updateFlags(flags: Record<string, boolean>) {
  if (Object.keys(flags).length === 0) {
    flagsContainer.innerHTML = '<p class="placeholder">No flags received yet</p>';
    return;
  }

  flagsContainer.innerHTML = Object.entries(flags)
    .map(
      ([key, value]) => `
      <div class="flag-item">
        <span class="flag-name">${key}</span>
        <span class="flag-value ${value ? "enabled" : "disabled"}">${value}</span>
      </div>
    `
    )
    .join("");
}

// Initialize SDK
log("Initializing Beacon SDK...");

init({
  url: "http://localhost:4000",
  apiKey: "test_api_key_12345",
  onConnectionChange: updateConnectionStatus,
  onError: (error) => log(`Error: ${error}`, "error"),
});

// Listen for flag updates
window.addEventListener("beacon:flags", ((event: CustomEvent) => {
  log("Received flag update", "success");
  updateFlags(event.detail);
}) as EventListener);

// Button handlers
btnTrack.addEventListener("click", () => {
  eventCounter++;
  const eventName = `button_click_${eventCounter}`;
  track(eventName, {
    button_id: "track-button",
    click_count: eventCounter,
  });
  log(`Tracked event: <strong>${eventName}</strong>`, "success");
});

btnIdentify.addEventListener("click", () => {
  const userId = `user_${Math.random().toString(36).slice(2, 8)}`;
  identify(userId, {
    name: "Test User",
    plan: "pro",
    signed_up: new Date().toISOString(),
  });
  log(`Identified user: <strong>${userId}</strong>`, "success");
});

btnPage.addEventListener("click", () => {
  page({ section: "example" });
  log(`Tracked page view: <strong>${window.location.pathname}</strong>`, "success");
});

// Initial state
updateConnectionStatus(getConnectionState());
log("SDK initialized. Click buttons to send events.");
