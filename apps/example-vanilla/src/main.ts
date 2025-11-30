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
// Event Log
// ============================================================================

function log(message: string, type: "info" | "success" | "error" | "event" = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span> ${message}`;
  eventLog.insertBefore(entry, eventLog.firstChild);

  // Keep only last 50 entries
  while (eventLog.children.length > 50) {
    eventLog.removeChild(eventLog.lastChild!);
  }
}

// ============================================================================
// UI Updates
// ============================================================================

function updateConnectionStatus(state: ConnectionState) {
  statusDot.className = `status-dot status-${state}`;
  statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  log(`Connection: ${state}`, state === "connected" ? "success" : "info");
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
// Auth Handlers
// ============================================================================

function handleLogin(username: string) {
  // Store in session
  setCurrentUser(username);

  // Call identify() - this links the anonymous user to the known user
  identify(username, {
    signed_up_at: new Date().toISOString(),
  });

  // Track the login event
  track("user_signed_in", {
    method: "form",
  });

  // Update UI
  updateAuthUI(username);

  log(`Identified as <strong>${username}</strong>`, "success");
  log(
    `<span class="log-detail">Anonymous activity is now linked to this user</span>`,
    "info"
  );
}

function handleLogout() {
  const previousUser = getCurrentUser();
  setCurrentUser(null);

  // Track logout before clearing
  track("user_signed_out");

  // Update UI
  updateAuthUI(null);

  log(`Signed out from <strong>${previousUser}</strong>`, "info");
  log(
    `<span class="log-detail">Note: SDK continues tracking with same anon_id until page refresh</span>`,
    "info"
  );
}

// ============================================================================
// Initialize SDK
// ============================================================================

log("Initializing Beacon SDK...");

init({
  url: "http://localhost:4000",
  apiKey: "test_api_key_12345",
  onConnectionChange: updateConnectionStatus,
  onError: (error) => log(`Error: ${error}`, "error"),
});

// Track initial page view
page({ page_name: "home" });
log(`Tracked <strong>$page</strong> view`, "event");

// ============================================================================
// Restore Session
// ============================================================================

const existingUser = getCurrentUser();
if (existingUser) {
  // Re-identify on page load if user was logged in
  identify(existingUser);
  updateAuthUI(existingUser);
  log(`Restored session for <strong>${existingUser}</strong>`, "info");
} else {
  updateAuthUI(null);
  log("Tracking as anonymous user", "info");
}

// ============================================================================
// Event Listeners
// ============================================================================

// Listen for flag updates from server
window.addEventListener("beacon:flags", ((event: CustomEvent) => {
  log("Received flag update", "success");
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

// App interaction buttons - simulating real user actions
btnAddCart.addEventListener("click", () => {
  const productId = `prod_${Math.random().toString(36).slice(2, 6)}`;
  track("product_added_to_cart", {
    product_id: productId,
    price: 29.99,
    currency: "USD",
  });
  log(
    `Tracked <strong>product_added_to_cart</strong> <span class="log-detail">${productId}</span>`,
    "event"
  );
});

btnCheckout.addEventListener("click", () => {
  track("checkout_started", {
    cart_value: 59.98,
    item_count: 2,
  });
  log(`Tracked <strong>checkout_started</strong>`, "event");
});

btnUpgrade.addEventListener("click", () => {
  track("pricing_page_viewed", {
    source: "header_cta",
    current_plan: "free",
  });
  log(`Tracked <strong>pricing_page_viewed</strong>`, "event");
});

// Show initial connection state
updateConnectionStatus(getConnectionState());
