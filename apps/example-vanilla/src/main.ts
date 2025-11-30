import {
  init,
  track,
  identify,
  page,
  getConnectionState,
  type ConnectionState,
} from "@beacon/sdk";
import "./style.css";

// ============================================================================
// Types
// ============================================================================

type LogType = "event" | "identify" | "page" | "connection" | "flags" | "error" | "info";
type LogDirection = "sent" | "received" | "system";

interface LogEntry {
  type: LogType;
  message: string;
  direction: LogDirection;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// DOM Elements
// ============================================================================

const connectionStatus = document.getElementById("connection-status")!;
const statusDot = connectionStatus.querySelector(".status-dot")!;
const statusText = connectionStatus.querySelector(".status-text")!;

const userDisplay = document.getElementById("user-display")!;
const authSection = document.getElementById("auth-section")!;
const loggedInSection = document.getElementById("logged-in-section")!;
const loggedInUsername = document.getElementById("logged-in-username")!;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const logoutBtn = document.getElementById("logout-btn")!;

const btnAddCart = document.getElementById("btn-add-cart")!;
const btnCheckout = document.getElementById("btn-checkout")!;
const btnUpgrade = document.getElementById("btn-upgrade")!;
const codePreview = document.getElementById("code-preview")!;
const clearLogBtn = document.getElementById("clear-log")!;

const flagsContainer = document.getElementById("flags-container")!;
const eventLog = document.getElementById("event-log")!;

// ============================================================================
// State
// ============================================================================

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

// ============================================================================
// JSON Syntax Highlighting
// ============================================================================

function syntaxHighlight(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "key";
          match = match.slice(0, -1); // Remove colon for keys
          return `<span class="${cls}">${match}</span>:`;
        } else {
          cls = "string";
        }
      } else if (/true|false/.test(match)) {
        cls = "number"; // booleans same color as numbers
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ============================================================================
// Event Log
// ============================================================================

const icons: Record<LogType, string> = {
  event: "◆",
  identify: "●",
  page: "◇",
  connection: "◈",
  flags: "⚑",
  error: "✕",
  info: "○",
};

function log(entry: LogEntry) {
  // Remove empty state message if present
  const emptyState = eventLog.querySelector(".log-empty");
  if (emptyState) {
    emptyState.remove();
  }

  const el = document.createElement("details");
  el.className = `log-entry type-${entry.type}`;

  const time = entry.timestamp.toLocaleTimeString();
  const icon = icons[entry.type];
  const badge = entry.direction !== "system"
    ? `<span class="log-badge ${entry.direction}">${entry.direction}</span>`
    : "";

  el.innerHTML = `
    <summary>
      <span class="log-time">${time}</span>
      <span class="log-icon">${icon}</span>
      <span class="log-message">${entry.message}</span>
      ${badge}
    </summary>
    ${entry.payload ? `<div class="log-payload"><pre>${syntaxHighlight(entry.payload)}</pre></div>` : ""}
  `;

  eventLog.insertBefore(el, eventLog.firstChild);

  // Keep only last 100 entries
  while (eventLog.children.length > 100) {
    eventLog.removeChild(eventLog.lastChild!);
  }
}

function logEvent(eventName: string, props?: Record<string, unknown>) {
  log({
    type: "event",
    message: `<strong>${eventName}</strong>`,
    direction: "sent",
    payload: { type: "event", event: eventName, props, ts: Date.now() },
    timestamp: new Date(),
  });
}

function logIdentify(userId: string, traits?: Record<string, unknown>) {
  log({
    type: "identify",
    message: `Identified as <strong>${userId}</strong>`,
    direction: "sent",
    payload: { type: "identify", userId, traits },
    timestamp: new Date(),
  });
}

function logPage(props?: Record<string, unknown>) {
  log({
    type: "page",
    message: `<strong>$page</strong> view`,
    direction: "sent",
    payload: {
      type: "event",
      event: "$page",
      props: { url: window.location.href, path: window.location.pathname, ...props },
      ts: Date.now()
    },
    timestamp: new Date(),
  });
}

function logConnection(state: ConnectionState) {
  log({
    type: "connection",
    message: `Connection: <strong>${state}</strong>`,
    direction: "system",
    timestamp: new Date(),
  });
}

function logFlags(flags: Record<string, boolean>) {
  log({
    type: "flags",
    message: `Received <strong>${Object.keys(flags).length}</strong> flags`,
    direction: "received",
    payload: flags,
    timestamp: new Date(),
  });
}

function logInfo(message: string) {
  log({
    type: "info",
    message,
    direction: "system",
    timestamp: new Date(),
  });
}

function logError(message: string) {
  log({
    type: "error",
    message,
    direction: "system",
    timestamp: new Date(),
  });
}

// ============================================================================
// UI Updates
// ============================================================================

function updateConnectionStatus(state: ConnectionState) {
  statusDot.className = `status-dot status-${state}`;
  statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  logConnection(state);
}

function updateAuthUI(userId: string | null) {
  if (userId) {
    userDisplay.textContent = userId;
    userDisplay.classList.add("identified");
    authSection.style.display = "none";
    loggedInSection.style.display = "block";
    loggedInUsername.textContent = userId;
  } else {
    userDisplay.textContent = "Anonymous";
    userDisplay.classList.remove("identified");
    authSection.style.display = "block";
    loggedInSection.style.display = "none";
  }
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

// ============================================================================
// Code Preview (Hover)
// ============================================================================

function showCodePreview(code: string) {
  codePreview.innerHTML = `<code>${code}</code>`;
}

function hideCodePreview() {
  codePreview.innerHTML = '<span class="code-preview-label">Hover a button to see the code</span>';
}

// ============================================================================
// Auth Handlers
// ============================================================================

function handleLogin(username: string) {
  setCurrentUser(username);

  const traits = { signed_up_at: new Date().toISOString() };
  identify(username, traits);
  logIdentify(username, traits);

  const eventProps = { method: "form" };
  track("user_signed_in", eventProps);
  logEvent("user_signed_in", eventProps);

  updateAuthUI(username);
  logInfo("Anonymous activity is now linked to this user");
}

function handleLogout() {
  const previousUser = getCurrentUser();
  setCurrentUser(null);

  track("user_signed_out");
  logEvent("user_signed_out");

  updateAuthUI(null);
  logInfo(`Signed out from ${previousUser}`);
}

// ============================================================================
// Initialize SDK
// ============================================================================

logInfo("Initializing Beacon SDK...");

init({
  url: "http://localhost:4000",
  apiKey: "test_api_key_12345",
  onConnectionChange: updateConnectionStatus,
  onError: (error) => logError(error),
});

// Track initial page view
page({ page_name: "home" });
logPage({ page_name: "home" });

// ============================================================================
// Restore Session
// ============================================================================

const existingUser = getCurrentUser();
if (existingUser) {
  identify(existingUser);
  updateAuthUI(existingUser);
  logInfo(`Restored session for ${existingUser}`);
} else {
  updateAuthUI(null);
  logInfo("Tracking as anonymous user");
}

// ============================================================================
// Event Listeners
// ============================================================================

// Listen for flag updates from server
window.addEventListener("beacon:flags", ((event: CustomEvent) => {
  logFlags(event.detail);
  updateFlags(event.detail);
}) as EventListener);

// Login form
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (username) {
    handleLogin(username);
    usernameInput.value = "";
  }
});

// Logout button
logoutBtn.addEventListener("click", handleLogout);

// Clear log button
clearLogBtn.addEventListener("click", () => {
  eventLog.innerHTML = '<div class="log-empty">Events will appear here as they\'re sent...</div>';
});

// Action buttons with code preview
const actionButtons = [btnAddCart, btnCheckout, btnUpgrade];
actionButtons.forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    const code = btn.getAttribute("data-code");
    if (code) showCodePreview(code);
  });
  btn.addEventListener("mouseleave", hideCodePreview);
});

// Add to Cart
btnAddCart.addEventListener("click", () => {
  const productId = `prod_${Math.random().toString(36).slice(2, 6)}`;
  const props = {
    product_id: productId,
    price: 29.99,
    currency: "USD",
  };
  track("product_added_to_cart", props);
  logEvent("product_added_to_cart", props);
});

// Start Checkout
btnCheckout.addEventListener("click", () => {
  const props = {
    cart_value: 59.98,
    item_count: 2,
  };
  track("checkout_started", props);
  logEvent("checkout_started", props);
});

// View Pricing
btnUpgrade.addEventListener("click", () => {
  const props = {
    source: "header_cta",
    current_plan: "free",
  };
  track("pricing_page_viewed", props);
  logEvent("pricing_page_viewed", props);
});

// Show initial connection state
const initialState = getConnectionState();
statusDot.className = `status-dot status-${initialState}`;
statusText.textContent = initialState.charAt(0).toUpperCase() + initialState.slice(1);
