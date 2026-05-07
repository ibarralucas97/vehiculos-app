let selectedVehicleId = null;
let currentPlaces = [];
let currentVehicles = [];
let editingVehicleId = null;
let editingPlaceId = null;
const SESSION_KEY = "mygarage_session";
const MAINTENANCE_IMAGES_KEY = "mygarage_maintenance_images";
const VIEW_STATE_KEY = "mygarage_view_state";
const BACK_BUTTON_MOVE_THRESHOLD = 10;
const BACK_BUTTON_GHOST_CLICK_WINDOW_MS = 700;
const MAX_NUMERIC_FIELD_VALUE = 999999999;
const ALLOWED_MAINTENANCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const NUMERIC_FIELD_CONFIG = {
  km: { allowDecimal: false, label: "Kilometros" },
  cost: { allowDecimal: false, label: "Costo" },
  km_actual: { allowDecimal: false, label: "KM actual" },
  ultimo_service_km: { allowDecimal: false, label: "Ultimo service (KM)" },
  intervalo_km: { allowDecimal: false, label: "Intervalo KM" },
};

const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const sessionBox = document.getElementById("session-box");
const sessionEmail = document.getElementById("session-email");
const sessionCopy = document.getElementById("session-copy");
const logoutButton = document.getElementById("logout-button");
const loginSubmitButton = document.getElementById("login-submit");
const passwordInput = document.getElementById("login-password");
const togglePasswordButton = document.getElementById("toggle-password");

const maintenanceList = document.getElementById("maintenance-list");
const latestMaintenanceList = document.getElementById("latest-maintenance-list");
const latestStatusPill = document.getElementById("latest-status-pill");
const statusPill = document.getElementById("status-pill");
const historyTitle = document.getElementById("history-title");
const historyCopy = document.getElementById("history-copy");
const maintenanceForm = document.getElementById("maintenance-form");
const vehicleForm = document.getElementById("vehicle-form");
const placeForm = document.getElementById("place-form");
const filtersForm = document.getElementById("filters-form");
const formMessage = document.getElementById("form-message");
const filtersSubmitButton = document.getElementById("filters-submit");
const latestButton = document.getElementById("latest-button");
const exportPdfButton = document.getElementById("export-pdf-button");
const maintenanceSubmitButton = document.getElementById("maintenance-submit");
const vehicleSelect = document.getElementById("vehiculo_id");
const placeSelect = document.getElementById("lugar_id");
const menuButton = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");
const menuLogoutButton = document.getElementById("menu-logout");
const menuProfileButton = document.getElementById("menu-profile");
const menuSettingsButton = document.getElementById("menu-settings");
const currentVehicleName = document.getElementById("current-vehicle-name");
const currentVehicleKm = document.getElementById("current-vehicle-km");
const updateKmButton = document.getElementById("update-km-button");
const maintenanceImageInput = document.getElementById("maintenance-image");
const maintenanceImagePreview = document.getElementById("maintenance-image-preview");
const maintenanceImagePreviewImg = document.getElementById("maintenance-image-preview-img");
const splashScreen = document.getElementById("splash-screen");
const splashLogoImg = document.getElementById("splash-logo-img");
const splashLogoFallback = document.getElementById("splash-logo-fallback");
const welcomeScreen = document.getElementById("welcome-screen");
const topbar = document.getElementById("app-topbar");
const topbarUserName = document.getElementById("topbar-user-name");
const topbarBackButton = document.getElementById("topbar-back-button");
const maintenanceSection = document.getElementById("maintenance-section");
const latestRecordsSection = document.getElementById("latest-records-section");
const historySection = document.getElementById("history-section");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const profileSaveButton = document.getElementById("profile-save-button");
const profileAvatarPreview = document.getElementById("profile-avatar-preview");
const profileAvatarImage = document.getElementById("profile-avatar-image");
const profileAvatarFallback = document.getElementById("profile-avatar-fallback");
const profileCreatedAt = document.getElementById("profile-created-at");
const preferencesForm = document.getElementById("preferences-form");
const preferencesMessage = document.getElementById("preferences-message");
const preferencesSaveButton = document.getElementById("preferences-save-button");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");
const passwordSaveButton = document.getElementById("password-save-button");
const settingsLogoutButton = document.getElementById("settings-logout-button");
const filtersResetButton = document.getElementById("filters-reset-button");

let maintenanceImageRefs = getMaintenanceImageRefs();
let latestRecordsLoaded = false;
let backButtonTouchState = {
  active: false,
  moved: false,
  cancelled: false,
  armed: false,
  startX: 0,
  startY: 0,
  lastTouchEndAt: 0,
};
let debugLogEntries = [];
let debugPanelElements = {
  root: null,
  body: null,
  currentView: null,
};
let debugPanelMinimized = false;
let lastDebugTouchMoveAt = 0;
let lastDebugView = "unknown";
let activeView = "unknown";
let touchGestureState = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
};
let touchScrollResetTimer = null;
let isTouchScrolling = false;
const TOUCH_SCROLL_THRESHOLD = 8;
const DEBUG_LOG_LIMIT = 40;

function buildFullName(user = {}) {
  return [user.nombre, user.apellido].filter(Boolean).join(" ").trim() || user.fullName || user.email || "";
}

function getUserDisplayName(user = {}) {
  const firstName = String(user.nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  const fallbackName = String(user.fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  const displayName = firstName || fallbackName || user.email || "";

  if (!displayName) {
    return "";
  }

  if (typeof window !== "undefined" && window.innerWidth <= 420) {
    return displayName.slice(0, 1).toUpperCase();
  }

  return displayName;
}

function normalizeSessionUser(user = {}) {
  return {
    ...user,
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    telefono: user.telefono || "",
    profilePhotoUrl: user.profilePhotoUrl || user.profile_photo_url || "",
    mileageUnit: user.mileageUnit || user.mileage_unit || "km",
    remindersEnabled:
      typeof user.remindersEnabled === "boolean"
        ? user.remindersEnabled
        : user.reminders_enabled !== false,
    fullName: buildFullName(user),
  };
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (_error) {
    return null;
  }
}

function saveSession(user) {
  const normalizedUser = normalizeSessionUser(user);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...normalizedUser,
      createdAt: normalizedUser.createdAt || user.created_at || new Date().toISOString(),
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getMaintenanceImageRefs() {
  try {
    return JSON.parse(localStorage.getItem(MAINTENANCE_IMAGES_KEY) || "{}");
  } catch (_error) {
    return {};
  }
}

function saveMaintenanceImageRefs() {
  localStorage.setItem(MAINTENANCE_IMAGES_KEY, JSON.stringify(maintenanceImageRefs));
}

function syncSession(user) {
  if (!user) return null;
  saveSession(user);
  updateSessionUI();
  return getSession();
}

function setButtonLoading(button, isLoading, loadingText = "Guardando...") {
  if (!button) return; // 👈 salva todo

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
  }
}


const vehiclesScreen = document.getElementById("vehicles-screen");

function updateTopbarContext() {
  if (!topbarBackButton) return;
  const inVehicleDetail = getCurrentView() === "dashboard";
  topbarBackButton.disabled = !inVehicleDetail;
  topbarBackButton.classList.toggle("is-inactive", !inVehicleDetail);
}

function updateSessionUI() {
  const session = normalizeSessionUser(getSession() || {});
  const isLoggedIn = Boolean(session?.email);
  const currentView = getCurrentView();
  const hasCurrentVehicle = Boolean(selectedVehicleId) && (currentVehicles.length === 0 || Boolean(getSelectedVehicle()));

  topbar?.classList.toggle("hidden", !isLoggedIn);
  loginForm.classList.toggle("hidden", isLoggedIn);
  sessionBox.classList.toggle("hidden", !isLoggedIn);
  logoutButton.classList.add("hidden");

  if (isLoggedIn) {
    const fullName = buildFullName(session);
    sessionEmail.textContent = fullName ? `${fullName} - ${session.email}` : session.email;
    if (topbarUserName) {
      topbarUserName.textContent = getUserDisplayName(session);
      topbarUserName.title = fullName || session.email || "";
    }

    sessionCopy.textContent = "";
    loginMessage.textContent = "";

    if (currentView === "dashboard") {
      if (hasCurrentVehicle) {
        debugLog("[SESSION UI] dashboard activo, no se navega", {
          currentView,
          selectedVehicleId,
          reason: "sessionUiOnlyNoNavigation",
        });
      } else {
        setView("vehicles", "updateSessionUI", null, { reason: "noCurrentVehicle" });
      }
    } else if (currentView === "vehicles") {
      debugLog("[SESSION UI] sessionUiOnlyNoNavigation", {
        currentView,
        selectedVehicleId,
        reason: "sessionUiOnlyNoNavigation",
      });
    } else if (currentView === "unknown" || currentView === "login") {
      setView("vehicles", "updateSessionUI", null, { reason: "initialSessionView" });
    } else {
      setView("vehicles", "updateSessionUI", null, { reason: "invalidView" });
    }
  } else {
    sessionEmail.textContent = "";
    if (topbarUserName) {
      topbarUserName.textContent = "";
      topbarUserName.title = "";
    }
    sessionCopy.textContent = "Ingresa para continuar.";
    setView("login", "updateSessionUI", null, { reason: "noSession" });
  }

  updateTopbarContext();
  updateDebugCurrentView(getCurrentView());
  return isLoggedIn;
}

function isCollapsibleSectionOpen(section) {
  return Boolean(section && section.classList.contains("open"));
}

function deriveCurrentViewFromDom() {
  const vehiclesScreen = document.getElementById("vehicles-screen");

  if (dashboard && !dashboard.classList.contains("hidden") && selectedVehicleId) {
    return "dashboard";
  }

  if (vehiclesScreen && !vehiclesScreen.classList.contains("hidden")) {
    return "vehicles";
  }

  if (welcomeScreen && !welcomeScreen.classList.contains("hidden")) {
    return "login";
  }

  return "unknown";
}

function getCurrentView() {
  return activeView === "unknown" ? deriveCurrentViewFromDom() : activeView;
}

function getEventLabel(target) {
  if (!(target instanceof Element)) {
    return String(target || "unknown");
  }

  const id = target.id ? `#${target.id}` : "";
  const className = typeof target.className === "string"
    ? `.${target.className.trim().split(/\s+/).filter(Boolean).join(".")}`
    : "";

  return `${target.tagName.toLowerCase()}${id}${className}`;
}

function logNavigation(origin, destination, details = {}) {
  const payload = {
    source: origin,
    target: destination,
    currentView: getCurrentView(),
    timestamp: new Date().toISOString(),
    ...details,
  };

  console.log("[NAVIGATION]", payload);
  debugLog(`[NAVIGATION] ${origin} -> ${destination}`, payload);
  updateDebugCurrentView(destination);
}

function isTouchCapableDevice() {
  return window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0;
}

function stringifyDebugValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function formatDebugTime(date = new Date()) {
  return date.toLocaleTimeString("es-AR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderDebugEntries() {
  if (!debugPanelElements.body) {
    return;
  }

  debugPanelElements.body.innerHTML = debugLogEntries
    .map((entry) => `<div class="debug-log-line">[${entry.time}] ${entry.message}</div>`)
    .join("");
  debugPanelElements.body.scrollTop = debugPanelElements.body.scrollHeight;
}

function updateDebugCurrentView(nextView = getCurrentView()) {
  if (debugPanelElements.currentView) {
    debugPanelElements.currentView.textContent = `CURRENT VIEW: ${nextView}`;
  }

  if (nextView !== lastDebugView) {
    appendDebugEntry(`[VIEW CHANGE] ${lastDebugView} -> ${nextView}`);
    lastDebugView = nextView;
  }
}

function appendDebugEntry(message) {
  const entry = {
    time: formatDebugTime(),
    message,
  };

  debugLogEntries.push(entry);
  if (debugLogEntries.length > DEBUG_LOG_LIMIT) {
    debugLogEntries = debugLogEntries.slice(-DEBUG_LOG_LIMIT);
  }

  renderDebugEntries();
}

function debugLog(message, data = null) {
  const suffix = data ? ` ${stringifyDebugValue(data)}` : "";
  appendDebugEntry(`${message}${suffix}`);
}

function clearTouchScrollState() {
  if (touchScrollResetTimer) {
    window.clearTimeout(touchScrollResetTimer);
    touchScrollResetTimer = null;
  }

  isTouchScrolling = false;
  touchGestureState.active = false;
  touchGestureState.moved = false;
}

function scheduleTouchScrollReset() {
  if (touchScrollResetTimer) {
    window.clearTimeout(touchScrollResetTimer);
  }

  touchScrollResetTimer = window.setTimeout(() => {
    clearTouchScrollState();
    debugLog("[TOUCH SCROLL RESET]", {
      currentView: getCurrentView(),
    });
  }, 160);
}

function setView(nextView, source, event = null, extra = {}) {
  const previousView = getCurrentView();
  const payload = {
    source,
    previousView,
    nextView,
    eventType: event?.type || null,
    targetElement: getEventLabel(event?.target),
    currentView: previousView,
    isTouchScrolling,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  debugLog("[VIEW REQUEST]", payload);

  if (
    previousView === "dashboard" &&
    nextView === "vehicles" &&
    isTouchScrolling &&
    source !== "explicitBackButton"
  ) {
    debugLog("[BLOCKED VIEW CHANGE DURING TOUCH]", payload);
    console.trace("[VIEW CHANGE TRACE BLOCKED]", payload);
    return false;
  }

  if (nextView === previousView) {
    updateDebugCurrentView(nextView);
    return true;
  }

  console.trace("[VIEW CHANGE TRACE]", payload);

  if (nextView === "dashboard") {
    welcomeScreen?.classList.add("hidden");
    vehiclesScreen?.classList.add("hidden");
    dashboard?.classList.remove("hidden");
  } else if (nextView === "vehicles") {
    welcomeScreen?.classList.add("hidden");
    dashboard?.classList.add("hidden");
    vehiclesScreen?.classList.remove("hidden");
  } else if (nextView === "login") {
    dashboard?.classList.add("hidden");
    vehiclesScreen?.classList.add("hidden");
    welcomeScreen?.classList.remove("hidden");
  }

  activeView = nextView;
  debugLog("[VIEW CHANGE]", {
    source,
    previousView,
    nextView,
    timestamp: new Date().toISOString(),
    ...extra,
  });
  updateTopbarContext();
  updateDebugCurrentView(nextView);
  return true;
}

function setupDebugPanel() {
  const panel = document.createElement("aside");
  panel.className = "debug-panel";
  panel.innerHTML = `
    <button type="button" class="debug-panel-toggle" aria-expanded="true">DEBUG LOGS</button>
    <div class="debug-panel-content">
      <div class="debug-panel-current-view">CURRENT VIEW: ${getCurrentView()}</div>
      <div class="debug-panel-body"></div>
    </div>
  `;

  document.body.appendChild(panel);

  debugPanelElements = {
    root: panel,
    body: panel.querySelector(".debug-panel-body"),
    currentView: panel.querySelector(".debug-panel-current-view"),
  };

  const toggleButton = panel.querySelector(".debug-panel-toggle");
  toggleButton?.addEventListener("click", () => {
    debugPanelMinimized = !debugPanelMinimized;
    panel.classList.toggle("is-minimized", debugPanelMinimized);
    toggleButton.setAttribute("aria-expanded", String(!debugPanelMinimized));
  });

  window.debugLog = debugLog;
  updateDebugCurrentView();
  appendDebugEntry("[DEBUG] panel listo");
}

function setupDebugObservers() {
  const touchLogger = (event) => {
    const touch = event.touches?.[0] || event.changedTouches?.[0] || null;

    if (event.type === "touchstart" && touch) {
      touchGestureState.active = true;
      touchGestureState.moved = false;
      touchGestureState.startX = touch.clientX;
      touchGestureState.startY = touch.clientY;
      if (touchScrollResetTimer) {
        window.clearTimeout(touchScrollResetTimer);
        touchScrollResetTimer = null;
      }
      isTouchScrolling = false;
    }

    if (event.type === "touchmove" && touchGestureState.active && touch) {
      const deltaX = touch.clientX - touchGestureState.startX;
      const deltaY = touch.clientY - touchGestureState.startY;
      if (Math.abs(deltaX) > TOUCH_SCROLL_THRESHOLD || Math.abs(deltaY) > TOUCH_SCROLL_THRESHOLD) {
        touchGestureState.moved = true;
        isTouchScrolling = true;
      }
    }

    if (event.type === "touchend" || event.type === "touchcancel") {
      if (touchGestureState.moved) {
        isTouchScrolling = true;
        scheduleTouchScrollReset();
      } else {
        clearTouchScrollState();
      }
    }

    if (event.type === "touchmove") {
      const now = Date.now();
      if (now - lastDebugTouchMoveAt < 180) {
        return;
      }
      lastDebugTouchMoveAt = now;
    }

    debugLog(`[${event.type.toUpperCase()}]`, {
      eventType: event.type,
      currentView: getCurrentView(),
      targetElement: getEventLabel(event.target),
      currentTarget: getEventLabel(event.currentTarget),
      x: touch ? Math.round(touch.clientX) : null,
      y: touch ? Math.round(touch.clientY) : null,
    });
  };

  document.addEventListener("touchstart", touchLogger, { passive: true, capture: true });
  document.addEventListener("touchmove", touchLogger, { passive: true, capture: true });
  document.addEventListener("touchend", touchLogger, { passive: true, capture: true });
  document.addEventListener("touchcancel", touchLogger, { passive: true, capture: true });

  document.addEventListener("click", (event) => {
    debugLog("[CLICK]", {
      eventType: event.type,
      currentView: getCurrentView(),
      targetElement: getEventLabel(event.target),
      currentTarget: getEventLabel(event.currentTarget),
      detail: event.detail,
    });
  }, true);

  window.addEventListener("popstate", (event) => {
    debugLog("[POPSTATE]", {
      currentView: getCurrentView(),
      state: event.state ?? null,
      href: window.location.href,
    });
  });

  window.addEventListener("hashchange", () => {
    debugLog("[HASHCHANGE]", {
      currentView: getCurrentView(),
      href: window.location.href,
    });
  });

  const originalPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(state, unused, url) {
    debugLog("[HISTORY PUSHSTATE]", {
      currentView: getCurrentView(),
      state,
      url: url || null,
    });
    return originalPushState(state, unused, url);
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(state, unused, url) {
    debugLog("[HISTORY REPLACESTATE]", {
      currentView: getCurrentView(),
      state,
      url: url || null,
    });
    return originalReplaceState(state, unused, url);
  };
}

function persistViewState() {
  try {
    sessionStorage.setItem(
      VIEW_STATE_KEY,
      JSON.stringify({
        view: selectedVehicleId ? "dashboard" : "vehicles",
        vehicleId: selectedVehicleId || null,
      })
    );
  } catch (_error) {
    // Ignored: session storage may be unavailable in some private sessions.
  }
}

function readViewState() {
  try {
    return JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function clearViewState() {
  try {
    sessionStorage.removeItem(VIEW_STATE_KEY);
  } catch (_error) {
    // Ignored: session storage may be unavailable in some private sessions.
  }
}

function restoreStoredDashboardView() {
  const storedState = readViewState();

  if (storedState?.view !== "dashboard" || !storedState?.vehicleId) {
    return false;
  }

  const vehicleId = Number(storedState.vehicleId);

  if (!currentVehicles.some((vehicle) => Number(vehicle.id) === vehicleId)) {
    persistViewState();
    return false;
  }

  logNavigation("restoreStoredDashboardView", "dashboard", { vehicleId });
  selectVehicle(vehicleId, "restoreStoredDashboardView");
  return true;
}

function goBackToVehicles(origin = "goBackToVehicles") {
  logNavigation(origin, "vehicles", { selectedVehicleId });
  selectedVehicleId = null;
  persistViewState();

  if (!setView("vehicles", origin)) {
    return;
  }
  closeMenu();

  if (currentVehicleKm) currentVehicleKm.textContent = "Sin dato";
  if (updateKmButton) updateKmButton.disabled = true;

  loadVehiclesScreen();
}


function closeMenu() {
  if (!menuPanel) return;
  menuPanel.classList.add("hidden");
  if (menuButton) menuButton.setAttribute("aria-expanded", "false");
}

async function fetchCurrentProfile() {
  const session = getSession();

  if (!session?.id) {
    throw new Error("No hay una sesion activa.");
  }

  const profile = await fetchJson(`/users/profile?user_id=${session.id}`);
  syncSession(profile);
  return normalizeSessionUser(profile);
}

async function openProfileModal() {
  closeMenu();
  openModal("profile-modal");
  if (profileMessage) profileMessage.textContent = "Cargando perfil...";

  try {
    const profile = await fetchCurrentProfile();
    fillProfileForm(profile);
    if (profileMessage) profileMessage.textContent = "";
  } catch (error) {
    if (profileMessage) profileMessage.textContent = error.message;
  }
}

async function openSettingsModal() {
  closeMenu();
  openModal("settings-modal");
  if (preferencesMessage) preferencesMessage.textContent = "Cargando preferencias...";
  if (passwordMessage) passwordMessage.textContent = "";
  passwordForm?.reset();

  try {
    const profile = await fetchCurrentProfile();
    fillPreferencesForm(profile);
    if (preferencesMessage) preferencesMessage.textContent = "";
  } catch (error) {
    if (preferencesMessage) preferencesMessage.textContent = error.message;
  }
}

function showNotAvailable() {
  setStatus("No disponible");
  closeMenu();

  if (typeof openUiModal === "function") {
    openUiModal({
      title: "Proximamente",
      bodyHtml: "<p>Esta seccion todavia no esta disponible.</p>",
    });
    return;
  }
}

async function playSplashScreen() {
  if (!splashScreen) return;

  await new Promise((resolve) => {
    setTimeout(() => {
      splashScreen.classList.add("fade-out");
      document.body.classList.remove("splash-active");
      setTimeout(resolve, 450);
    }, 2800);
  });
}

if (splashLogoImg) {
  splashLogoImg.addEventListener("error", () => {
    splashLogoImg.classList.add("hidden");
    splashLogoFallback?.classList.remove("hidden");
  });

  splashLogoImg.addEventListener("load", () => {
    splashLogoImg.classList.remove("hidden");
    splashLogoFallback?.classList.add("hidden");
  });
}

function toggleMenu() {
  if (!menuPanel) return;
  const willOpen = menuPanel.classList.contains("hidden");
  menuPanel.classList.toggle("hidden");
  if (menuButton) menuButton.setAttribute("aria-expanded", String(willOpen));
}


async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const message = data.errors ? data.errors.join(", ") : data.error || "Ocurrio un error";
    throw new Error(message);
  }

  return data;
}

function setStatus(text) {
  statusPill.textContent = text;
}

function getMileageUnit() {
  return getSession()?.mileageUnit === "millas" ? "millas" : "km";
}

function getDistanceUnitLabel() {
  return getMileageUnit() === "millas" ? "mi" : "km";
}

function convertDistanceValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return getMileageUnit() === "millas" ? numericValue / 1.60934 : numericValue;
}

function formatDistance(value) {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  const convertedValue = convertDistanceValue(value);

  if (convertedValue === null) {
    return "Sin dato";
  }

  const decimals = getMileageUnit() === "millas" ? 1 : 0;

  return `${convertedValue.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })} ${getDistanceUnitLabel()}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatRegisteredDate(value) {
  if (!value) {
    return "Alta sin datos";
  }

  return `Alta: ${new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

function setProfileAvatar(photoUrl, userName = "") {
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "RC";

  if (profileAvatarFallback) {
    profileAvatarFallback.textContent = initials;
  }

  if (photoUrl) {
    profileAvatarImage.src = photoUrl;
    profileAvatarPreview?.classList.remove("hidden");
    profileAvatarFallback?.classList.add("hidden");
    return;
  }

  if (profileAvatarImage) {
    profileAvatarImage.removeAttribute("src");
  }
  profileAvatarPreview?.classList.add("hidden");
  profileAvatarFallback?.classList.remove("hidden");
}

function fillProfileForm(user) {
  if (!profileForm || !user) return;

  profileForm.elements.nombre.value = user.nombre || "";
  profileForm.elements.apellido.value = user.apellido || "";
  profileForm.elements.email.value = user.email || "";
  profileForm.elements.telefono.value = user.telefono || "";
  profileForm.elements.profile_photo_url.value = user.profilePhotoUrl || "";
  if (profileCreatedAt) {
    profileCreatedAt.textContent = formatRegisteredDate(user.createdAt);
  }
  setProfileAvatar(user.profilePhotoUrl, buildFullName(user));
}

function fillPreferencesForm(user) {
  if (!preferencesForm || !user) return;
  preferencesForm.elements.mileage_unit.value = user.mileageUnit || "km";
  preferencesForm.elements.reminders_enabled.checked = user.remindersEnabled !== false;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const normalized = String(value || "").trim();
  return normalized === "" || /^[0-9+\s()\-]{6,20}$/.test(normalized);
}

function getSelectedVehicle() {
  return currentVehicles.find((item) => item.id === selectedVehicleId) || null;
}

function formatKmValue(value) {
  return formatDistance(value);
}

function renderCurrentVehicleKm() {
  const vehicle = getSelectedVehicle();

  if (!currentVehicleKm) return;

  currentVehicleKm.textContent = formatKmValue(vehicle?.km_actual ?? null);

  if (updateKmButton) {
    updateKmButton.disabled = !vehicle;
  }
}

async function openKmUpdateModal() {
  const vehicle = getSelectedVehicle();

  if (!vehicle || typeof openUiModal !== "function") {
    return;
  }

  const existingKm = vehicle.km_actual ?? "";
  const confirmation = openUiModal({
    title: "Actualizar kilometraje",
    bodyHtml: `
      <label class="form-stack">
        <span>Ingresa el kilometraje actual del vehiculo.</span>
        <input id="km-update-input" type="text" inputmode="numeric" autocomplete="off" placeholder="KM actual" value="${existingKm}" />
      </label>
      <p class="section-copy">Este valor se usa como base para recordatorios y calculos futuros.</p>
      <p id="km-update-feedback" class="message"></p>
    `,
    confirmLabel: "Guardar",
    cancelLabel: "Cancelar",
    showCancel: true,
  });

  setTimeout(() => {
    const input = document.getElementById("km-update-input");
    attachNumericSanitizer(input, NUMERIC_FIELD_CONFIG.km_actual);
    input?.focus();
    input?.select();
  }, 0);

  const confirmed = await confirmation;

  if (!confirmed) {
    return;
  }

  const input = document.getElementById("km-update-input");
  const feedback = document.getElementById("km-update-feedback");
  const rawValue = String(input?.value || "").trim();
  const errorMessage = getNumericFieldError(rawValue, NUMERIC_FIELD_CONFIG.km_actual);

  if (errorMessage) {
    if (feedback) feedback.textContent = errorMessage;
    return;
  }

  const nextKm = Number(rawValue);

  if (!rawValue) {
    if (feedback) feedback.textContent = "Ingresa un kilometraje valido mayor o igual a 0.";
    return;
  }

  if (vehicle.km_actual !== null && vehicle.km_actual !== undefined && nextKm < Number(vehicle.km_actual)) {
    if (feedback) feedback.textContent = "No puedes bajar el kilometraje actual.";
    return;
  }

  const session = getSession();

  try {
    showAppLoading("Actualizando kilometraje...");
    const updatedVehicle = await fetchJson(`/vehicles/${vehicle.id}/km`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.id,
        km_actual: nextKm,
      }),
    });

    currentVehicles = currentVehicles.map((item) => (item.id === updatedVehicle.id ? { ...item, ...updatedVehicle } : item));
    renderCurrentVehicleKm();
    await refreshAllData();
    if (typeof loadDashboardOverview === "function") {
      await loadDashboardOverview();
    }
    setStatus("KM actualizado");
  } catch (error) {
    await openUiModal({
      title: "No se pudo actualizar",
      bodyHtml: `<p>${error.message}</p>`,
    });
  } finally {
    hideAppLoading();
  }
}

function setHistoryState(state, detail = "") {
  historyTitle.textContent = "Historial";

  const states = {
    initial: {
      pill: "Sin consulta",
      copy: "Busca mantenimientos por texto o rango de fechas.",
      body: '<div class="empty">Aplica filtros para ver el historial.</div>',
    },
    loading: {
      pill: "Cargando",
      copy: "Cargando historial...",
      body: '<div class="empty">Cargando historial...</div>',
    },
    empty: {
      pill: "Sin resultados",
      copy: "No se encontraron registros",
      body: '<div class="empty">No se encontraron registros</div>',
    },
    error: {
      pill: "Error",
      copy: detail || "Ocurrio un error",
      body: `<div class="empty">${detail || "Ocurrio un error"}</div>`,
    },
  };

  const config = states[state];

  if (!config) {
    historyCopy.textContent = detail;
    setStatus(state);
    return;
  }

  historyCopy.textContent = config.copy;
  setStatus(config.pill);
  maintenanceList.innerHTML = config.body;
}

function setLatestRecordsState(state, detail = "") {
  if (!latestStatusPill || !latestMaintenanceList) {
    return;
  }

  const states = {
    initial: {
      pill: "Sin consulta",
      body: '<div class="empty">Abri este modulo o presiona "Actualizar ultimos registros".</div>',
    },
    loading: {
      pill: "Cargando",
      body: '<div class="empty">Cargando ultimos registros...</div>',
    },
    empty: {
      pill: "Sin resultados",
      body: '<div class="empty">No hay mantenimientos cargados para este vehiculo.</div>',
    },
    error: {
      pill: "Error",
      body: `<div class="empty">${detail || "Ocurrio un error"}</div>`,
    },
  };

  const config = states[state];

  if (!config) {
    latestStatusPill.textContent = detail;
    return;
  }

  latestStatusPill.textContent = config.pill;
  latestMaintenanceList.innerHTML = config.body;
}

function optionMarkup(items, labelKey) {
  return items
    .map((item) => `<option value="${item.id}">${item[labelKey]}</option>`)
    .join("");
}

function persistMaintenanceImages(items) {
  let hasChanges = false;

  items.forEach((item) => {
    if (item?.id && item.image_source && maintenanceImageRefs[item.id] !== item.image_source) {
      maintenanceImageRefs[item.id] = item.image_source;
      hasChanges = true;
    }
  });

  if (hasChanges) {
    saveMaintenanceImageRefs();
  }
}

function getMaintenanceImageSource(item) {
  return item?.image_source || maintenanceImageRefs[item?.id] || "";
}

function renderMaintenanceCards(items, container) {
  if (!container) return;

  if (items.length === 0) {
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${item.accion}</h3>
              <p>${item.vehiculo} ${item.modelo ? `- ${item.modelo}` : ""}</p>
            </div>
            <strong>${formatCurrency(item.cost)}</strong>
          </div>
          ${
            getMaintenanceImageSource(item)
              ? `<img class="maintenance-thumb" src="${getMaintenanceImageSource(item)}" alt="Imagen de mantenimiento" />`
              : ""
          }
          <div class="card-meta">
            <span>Fecha: ${item.fecha.slice(0, 10)}</span>
            <span>Unidad: ${formatDistance(item.km)}</span>
            <span>Taller: ${item.lugar}</span>
            <span>Patente: ${item.patente}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMaintenance(items) {
  if (items.length === 0) {
    setHistoryState("empty");
    return;
  }

  renderMaintenanceCards(items, maintenanceList);
}

function renderLatestMaintenance(items) {
  if (items.length === 0) {
    setLatestRecordsState("empty");
    return;
  }

  renderMaintenanceCards(items, latestMaintenanceList);
  if (latestStatusPill) {
    latestStatusPill.textContent = `${items.length} registros`;
  }
}

async function loadSelects() {
 const session = getSession();

const [vehicles, places] = await Promise.all([
  fetchJson(`/vehicles?user_id=${session.id}`),
  fetchJson(`/places?user_id=${session.id}`),
]);

  if (vehicleSelect) {
    vehicleSelect.innerHTML = optionMarkup(vehicles, "nombre");
  }
  if (placeSelect) {
    placeSelect.innerHTML = optionMarkup(places, "nombre");
  }
}

function hasActiveFilters() {
  const formData = new FormData(filtersForm);
  return Array.from(formData.values()).some((value) => String(value).trim() !== "");
}


async function loadPlacesList() {
  const session = getSession();

  const places = await fetchJson(`/places?user_id=${session.id}`);

  // 🔥 guardamos en memoria
  currentPlaces = places;

  const container = document.getElementById("places-list");

  container.innerHTML = places.map(p => `
    <div class="item-row">
      
      <div class="item-info">
        <strong>${p.nombre}</strong>
        <span>${p.ubicacion || ""}</span>
      </div>

      <div class="item-actions">
        <button onclick="viewPlace(${p.id})" title="Ver">👁</button>
        <button onclick="editPlace(${p.id})" title="Editar">✏️</button>
        <button onclick="deletePlace(${p.id})" title="Eliminar">🗑</button>
      </div>

    </div>
  `).join("");
}




async function loadVehiclesScreen() {
  const session = getSession();

  const vehicles = await fetchJson(`/vehicles?user_id=${session.id}`);

  const container = document.getElementById("vehicles-grid");

  if (vehicles.length === 0) {
    container.innerHTML = "<p>No tenés vehículos aún</p>";
    return;
  }

  container.innerHTML = vehicles.map(v => `
  <div class="vehicle-card card border-0 shadow-sm" onclick="selectVehicle(${v.id})">
    <strong>${v.nombre}</strong>
    <span>${v.modelo || ""}</span>
  </div>
`).join("");
}

function selectVehicle(id, origin = "selectVehicle") {
  logNavigation(origin, "dashboard", { vehicleId: id });
  selectedVehicleId = id;
  persistViewState();
  const vehicle = currentVehicles.find((v) => v.id === id);
  if (currentVehicleName) {
    currentVehicleName.textContent = vehicle ? `${vehicle.nombre} ${vehicle.modelo ? `- ${vehicle.modelo}` : ""}` : `ID ${id}`;
  }
  renderCurrentVehicleKm();

  if (!setView("dashboard", origin)) {
    return;
  }
  closeMenu();

  refreshAllData();
  latestRecordsLoaded = false;
  setLatestRecordsState("initial");
  setHistoryState("initial");
}


if (menuButton && menuPanel) {
  menuButton.addEventListener("click", (e) => {
    debugLog("[BUTTON] menu-toggle", {
      currentView: getCurrentView(),
      targetElement: getEventLabel(e.target),
    });
    e.stopPropagation();
    toggleMenu();
  });
}

document.addEventListener("click", (e) => {
  if (!menuPanel || !menuButton) return;

  if (!menuPanel.contains(e.target) && !menuButton.contains(e.target)) {
    closeMenu();
  }
});

topbarBackButton?.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1) {
    backButtonTouchState.active = false;
    backButtonTouchState.armed = false;
    return;
  }

  backButtonTouchState = {
    active: true,
    moved: false,
    cancelled: false,
    armed: false,
    startX: event.touches[0].clientX,
    startY: event.touches[0].clientY,
    lastTouchEndAt: 0,
  };
}, { passive: true });

topbarBackButton?.addEventListener("touchmove", (event) => {
  if (!backButtonTouchState.active || event.touches.length !== 1) {
    return;
  }

  const deltaX = event.touches[0].clientX - backButtonTouchState.startX;
  const deltaY = event.touches[0].clientY - backButtonTouchState.startY;

  if (Math.abs(deltaX) > BACK_BUTTON_MOVE_THRESHOLD || Math.abs(deltaY) > BACK_BUTTON_MOVE_THRESHOLD) {
    backButtonTouchState.moved = true;
    backButtonTouchState.armed = false;
  }
}, { passive: true });

topbarBackButton?.addEventListener("touchend", (event) => {
  backButtonTouchState.active = false;
  backButtonTouchState.lastTouchEndAt = Date.now();
  backButtonTouchState.armed = !backButtonTouchState.moved && !backButtonTouchState.cancelled;
  logNavigation("topbarBackButton:touchend", "vehicles", {
    ignored: !backButtonTouchState.armed,
    moved: backButtonTouchState.moved,
    cancelled: backButtonTouchState.cancelled,
    armed: backButtonTouchState.armed,
    eventType: event.type,
    currentView: getCurrentView(),
    targetElement: getEventLabel(event.target),
    currentTarget: getEventLabel(event.currentTarget),
  });
}, { passive: true });

topbarBackButton?.addEventListener("touchcancel", (event) => {
  backButtonTouchState.active = false;
  backButtonTouchState.cancelled = true;
  backButtonTouchState.armed = false;
  backButtonTouchState.lastTouchEndAt = Date.now();
  logNavigation("topbarBackButton:touchcancel", "vehicles", {
    ignored: true,
    moved: backButtonTouchState.moved,
    cancelled: true,
    armed: false,
    eventType: event.type,
    currentView: getCurrentView(),
    targetElement: getEventLabel(event.target),
    currentTarget: getEventLabel(event.currentTarget),
  });
}, { passive: true });

topbarBackButton?.addEventListener("click", (event) => {
  const timeSinceTouchEnd = backButtonTouchState.lastTouchEndAt
    ? Date.now() - backButtonTouchState.lastTouchEndAt
    : null;
  const isTouchDevice = isTouchCapableDevice();
  const isArmedTouchClick = Boolean(
    isTouchDevice &&
      backButtonTouchState.armed &&
      timeSinceTouchEnd !== null &&
      timeSinceTouchEnd <= BACK_BUTTON_GHOST_CLICK_WINDOW_MS
  );
  const shouldIgnoreClick = Boolean(
    topbarBackButton.disabled ||
      (isTouchDevice && !isArmedTouchClick)
  );

  logNavigation("topbarBackButton:click", "vehicles", {
    ignored: shouldIgnoreClick,
    moved: backButtonTouchState.moved,
    cancelled: backButtonTouchState.cancelled,
    armed: backButtonTouchState.armed,
    isTouchDevice,
    timeSinceTouchEnd,
    eventType: event.type,
    eventDetail: event.detail,
    currentView: getCurrentView(),
    targetElement: getEventLabel(event.target),
    currentTarget: getEventLabel(event.currentTarget),
  });

  if (shouldIgnoreClick) {
    event.preventDefault();
    event.stopPropagation();
    backButtonTouchState.moved = false;
    backButtonTouchState.cancelled = false;
    backButtonTouchState.armed = false;
    return;
  }

  backButtonTouchState.moved = false;
  backButtonTouchState.cancelled = false;
  backButtonTouchState.armed = false;
  goBackToVehicles("topbarBackButton:click");
});

async function loadVehiclesList() {
  const session = getSession();

  const vehicles = await fetchJson(`/vehicles?user_id=${session.id}`);

  currentVehicles = vehicles;

  const container = document.getElementById("vehicles-list-modal");

  container.innerHTML = vehicles.map(v => `
    <div class="item-row">
      
      <div class="item-info">
        <strong>${v.nombre}</strong>
        <span>${v.patente || ""}</span>
      </div>

      <div class="item-actions">
        <button onclick="viewVehicle(${v.id})" title="Ver">👁</button>
        <button onclick="editVehicle(${v.id})" title="Editar">✏️</button>
        <button onclick="deleteVehicle(${v.id})" title="Eliminar">🗑</button>
      </div>

    </div>
  `).join("");
}

function editVehicle(id) {
  const vehicle = currentVehicles.find(v => v.id === id);
  if (!vehicle) return;

  document.querySelector("#vehicle-form [name=nombre]").value = vehicle.nombre;
  document.querySelector("#vehicle-form [name=modelo]").value = vehicle.modelo;
  document.querySelector("#vehicle-form [name=patente]").value = vehicle.patente;

  editingVehicleId = id;

  document.querySelector("#vehicle-form button").textContent = "Guardar";
}

function viewVehicle(id) {
  const v = currentVehicles.find(v => v.id === id);
  if (!v) return;

  if (typeof openUiModal === "function") {
    openUiModal({
      title: "Detalle del vehiculo",
      bodyHtml: `<div class="vehicle-detail-grid"><div><strong>Nombre:</strong> ${v.nombre}</div><div><strong>Modelo:</strong> ${v.modelo}</div><div><strong>Patente:</strong> ${v.patente}</div></div>`,
    });
  }
}



async function loadLatestRecords() {
  if (!selectedVehicleId) {
    setLatestRecordsState("error", "Primero selecciona un vehiculo.");
    return;
  }

  setLatestRecordsState("loading");

  const session = getSession();
  const params = new URLSearchParams({
    user_id: String(session.id),
    vehiculo_id: String(selectedVehicleId),
    limit: "3",
  });
  const items = await fetchJson(`/maintenance?${params.toString()}`);

  persistMaintenanceImages(items);
  latestRecordsLoaded = true;
  renderLatestMaintenance(items);
}

async function loadMaintenance() {
  if (!selectedVehicleId) {
    maintenanceList.innerHTML = '<div class="empty">Primero selecciona un vehiculo.</div>';
    setStatus("Selecciona un vehiculo");
    return;
  }

  const params = new URLSearchParams();
  const formData = new FormData(filtersForm);

  for (const [key, value] of formData.entries()) {
    const normalized = String(value).trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const usingFilters = params.toString().length > 0;

  setHistoryState("loading");
  const session = getSession();
  params.set("user_id", session.id);
  if (selectedVehicleId) {
    params.set("vehiculo_id", String(selectedVehicleId));
  }

  if (usingFilters) {
    historyTitle.textContent = "Historial filtrado";
    historyCopy.textContent = "Resultados según los filtros aplicados al vehículo seleccionado.";
  } else {
    historyTitle.textContent = "Historial";
    historyCopy.textContent = "Busca mantenimientos por texto o rango de fechas.";
    maintenanceList.innerHTML = '<div class="empty">No hay consulta activa.</div>';
    setStatus("Listo");
    return;
  }

  const query = params.toString();
  const url = query ? `/maintenance?${query}` : "/maintenance";
  const items = await fetchJson(url);
  persistMaintenanceImages(items);

  if (items.length === 0) {
    setHistoryState("empty");
    return;
  }

  renderMaintenance(items);
  historyCopy.textContent = "Resultados segun los filtros aplicados al vehiculo seleccionado.";
  setStatus(`${items.length} registros`);
}

function sanitizeNumericValue(rawValue, { allowDecimal = false } = {}) {
  const normalized = String(rawValue ?? "").replace(",", ".").replace(/\s+/g, "");
  let result = "";
  let hasDecimalSeparator = false;

  for (const character of normalized) {
    if (/\d/.test(character)) {
      result += character;
      continue;
    }

    if (allowDecimal && !hasDecimalSeparator && character === ".") {
      result += character;
      hasDecimalSeparator = true;
    }
  }

  if (!allowDecimal) {
    result = result.replace(/\D/g, "");
  }

  const numericValue = Number(result);

  if (result && Number.isFinite(numericValue) && numericValue > MAX_NUMERIC_FIELD_VALUE) {
    return String(MAX_NUMERIC_FIELD_VALUE);
  }

  return result;
}

function getNumericFieldError(value, { allowDecimal = false, label = "Campo numerico" } = {}) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  const numericPattern = allowDecimal ? /^\d+(\.\d+)?$/ : /^\d+$/;

  if (!numericPattern.test(normalized)) {
    return allowDecimal
      ? `${label} debe contener solo numeros validos.`
      : `${label} debe contener solo numeros enteros.`;
  }

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return `${label} debe ser mayor o igual a 0.`;
  }

  if (numericValue > MAX_NUMERIC_FIELD_VALUE) {
    return `${label} no puede superar ${MAX_NUMERIC_FIELD_VALUE}.`;
  }

  return "";
}

function attachNumericSanitizer(input, config) {
  if (!input) return;

  const applySanitizedValue = (nextValue) => {
    const sanitizedValue = sanitizeNumericValue(nextValue, config);
    if (input.value !== sanitizedValue) {
      input.value = sanitizedValue;
    }
    input.setCustomValidity(getNumericFieldError(input.value, config));
  };

  input.addEventListener("input", () => applySanitizedValue(input.value));
  input.addEventListener("paste", () => {
    window.setTimeout(() => applySanitizedValue(input.value), 0);
  });
  input.addEventListener("blur", () => applySanitizedValue(input.value));
}

function setupNumericFieldValidation() {
  Object.entries(NUMERIC_FIELD_CONFIG).forEach(([fieldName, config]) => {
    document
      .querySelectorAll(`input[name="${fieldName}"]`)
      .forEach((input) => attachNumericSanitizer(input, config));
  });
}

function normalizeNumericPayloadValue(rawValue, config) {
  const sanitizedValue = sanitizeNumericValue(rawValue, config);
  const error = getNumericFieldError(sanitizedValue, config);

  if (error) {
    throw new Error(error);
  }

  return sanitizedValue === "" ? "" : Number(sanitizedValue);
}

function validateSelectedMaintenanceImage(file) {
  if (!file) {
    return { ok: true, message: "", mimeType: "" };
  }

  const normalizedMimeType = String(file.type || "").toLowerCase();

  if (!ALLOWED_MAINTENANCE_IMAGE_TYPES.has(normalizedMimeType)) {
    return {
      ok: false,
      message: "Solo se permiten imagenes PNG, JPG o JPEG.",
      mimeType: "",
    };
  }

  return { ok: true, message: "", mimeType: normalizedMimeType };
}

async function loadDashboardData() {
await loadSelects();
await loadVehiclesList();
await loadPlacesList();
setHistoryState("initial");
setLatestRecordsState("initial");
}

if (togglePasswordButton && passwordInput) {
  togglePasswordButton.addEventListener("click", () => {
    const showingPassword = passwordInput.type === "text";
    passwordInput.type = showingPassword ? "password" : "text";
    togglePasswordButton.setAttribute("aria-pressed", String(!showingPassword));
    togglePasswordButton.setAttribute(
      "aria-label",
      showingPassword ? "Mostrar contrasena" : "Ocultar contrasena"
    );
  });
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    loginMessage.textContent = "Completa email y contrasena para ingresar.";
    return;
  }

  setButtonLoading(loginSubmitButton, true, "Ingresando...");
  loginMessage.textContent = "Validando acceso...";

  try {
    const response = await fetchJson("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    syncSession(response.user);
    loginMessage.textContent = "";

// 👇 NUEVO FLUJO
await loadVehiclesList();
await loadVehiclesScreen();

setView("vehicles", "loginSuccess");
  } catch (error) {
    clearSession();
    updateSessionUI();
    loginMessage.textContent = error.message;
    setHistoryState("error", error.message);
  } finally {
    setButtonLoading(loginSubmitButton, false, "Ingresando...");
  }
});

function logout() {
  clearSession();
  selectedVehicleId = null;
  clearViewState();
  updateSessionUI();
  loginForm.reset();
  profileForm?.reset();
  preferencesForm?.reset();
  passwordForm?.reset();
  passwordInput.type = "password";
  togglePasswordButton.setAttribute("aria-pressed", "false");
  togglePasswordButton.setAttribute("aria-label", "Mostrar contrasena");
  loginMessage.textContent = "Sesion cerrada.";
  if (profileMessage) profileMessage.textContent = "";
  if (preferencesMessage) preferencesMessage.textContent = "";
  if (passwordMessage) passwordMessage.textContent = "";
  setStatus("Bloqueado");
  maintenanceList.innerHTML = '<div class="empty">Selecciona un vehiculo para comenzar.</div>';
  historyTitle.textContent = "Historial";
  historyCopy.textContent = "Busca mantenimientos por texto o rango de fechas.";
  if (latestMaintenanceList) {
    latestMaintenanceList.innerHTML = '<div class="empty">Selecciona un vehiculo para ver sus ultimos registros.</div>';
  }
  if (latestStatusPill) {
    latestStatusPill.textContent = "Sin consulta";
  }
  latestRecordsLoaded = false;
  if (currentVehicleName) currentVehicleName.textContent = "Sin seleccion";
  if (currentVehicleKm) currentVehicleKm.textContent = "Sin dato";
  if (updateKmButton) updateKmButton.disabled = true;
  closeModal("profile-modal");
  closeModal("settings-modal");
  closeMenu();
}


logoutButton?.addEventListener("click", logout);
menuLogoutButton?.addEventListener("click", logout);
settingsLogoutButton?.addEventListener("click", logout);
menuProfileButton?.addEventListener("click", openProfileModal);
menuSettingsButton?.addEventListener("click", openSettingsModal);

vehicleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = getSession();
  const data = Object.fromEntries(new FormData(vehicleForm).entries());

  try {
    data.km_actual = normalizeNumericPayloadValue(data.km_actual, NUMERIC_FIELD_CONFIG.km_actual);
    data.ultimo_service_km = normalizeNumericPayloadValue(data.ultimo_service_km, NUMERIC_FIELD_CONFIG.ultimo_service_km);
    data.intervalo_km = normalizeNumericPayloadValue(data.intervalo_km, NUMERIC_FIELD_CONFIG.intervalo_km);
    showAppLoading("Guardando vehículo...");

    if (editingVehicleId) {
      await fetchJson(`/vehicles/${editingVehicleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });

      editingVehicleId = null;
      vehicleForm.querySelector("button").textContent = "Crear";
    } else {
      await fetchJson(`/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });
    }

    vehicleForm.reset();
    await refreshAllData();
await loadVehiclesScreen(); // 👈 CLAVE
closeModal("vehicles-modal");

  } catch (err) {
    console.error(err);
  } finally {
    hideAppLoading();
  }
});


placeForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = getSession();
  const data = Object.fromEntries(new FormData(placeForm).entries());

  try {
    showAppLoading("Guardando lugar...");

    if (editingPlaceId) {
      await fetchJson(`/places/${editingPlaceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });

      editingPlaceId = null;
      placeForm.querySelector("button").textContent = "Crear";
    } else {
      await fetchJson(`/places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });
    }

    placeForm.reset();
    await refreshAllData();
closeModal("places-modal");

  } catch (err) {
    console.error(err);
  } finally {
    hideAppLoading();
  }
});

maintenanceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedVehicleId) {
    formMessage.textContent = "Primero selecciona un vehículo.";
    return;
  }

  formMessage.textContent = "Guardando mantenimiento...";
  setButtonLoading(maintenanceSubmitButton, true, "Guardando...");

  const formData = new FormData(maintenanceForm);
  const payload = Object.fromEntries(formData.entries());
  const selectedImage = maintenanceImageInput?.files?.[0] || null;
  const imageValidation = validateSelectedMaintenanceImage(selectedImage);

  if (!imageValidation.ok) {
    formMessage.textContent = imageValidation.message;
    setButtonLoading(maintenanceSubmitButton, false, "Guardando...");
    return;
  }

  payload.vehiculo_id = selectedVehicleId;
  payload.lugar_id = Number(payload.lugar_id);

  try {
    payload.km = normalizeNumericPayloadValue(payload.km, NUMERIC_FIELD_CONFIG.km);
    payload.cost = normalizeNumericPayloadValue(payload.cost, NUMERIC_FIELD_CONFIG.cost);
    const imageRef = await fileToDataUrl(selectedImage);
    const session = getSession();

    const created = await fetchJson(`/maintenance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        user_id: session.id,
        image_base64: imageRef || "",
        image_mime_type: imageValidation.mimeType,
      }),
    });

    if (created?.id && created.image?.imageSource) {
      maintenanceImageRefs[created.id] = created.image.imageSource;
      saveMaintenanceImageRefs();
    }

    maintenanceForm.reset();
    clearMaintenanceImagePreview();
    await refreshAllData();
    await loadLatestRecords();
    if (hasActiveFilters()) {
      await loadMaintenance();
    }
    formMessage.textContent = imageRef
      ? "Mantenimiento e imagen guardados correctamente."
      : "Mantenimiento guardado correctamente.";
    setStatus("Mantenimiento guardado");
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    setButtonLoading(maintenanceSubmitButton, false, "Guardando...");
  }
});

filtersForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setButtonLoading(filtersSubmitButton, true, "Buscando...");

  try {
    await loadMaintenance();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonLoading(filtersSubmitButton, false, "Buscando...");
  }
});


updateKmButton?.addEventListener("click", openKmUpdateModal);

latestButton?.addEventListener("click", async () => {
  setButtonLoading(latestButton, true, "Cargando...");
  try {
    await loadLatestRecords();
  } catch (error) {
    setLatestRecordsState("error", error.message);
  } finally {
    setButtonLoading(latestButton, false, "Cargando...");
  }
});

filtersResetButton?.addEventListener("click", () => {
  setHistoryState("initial");
});


async function deleteVehicle(id) {
  const session = getSession();

  const confirmed = typeof openUiModal === "function"
    ? await openUiModal({
        title: "Eliminar vehiculo",
        bodyHtml: "<p>Esta accion no se puede deshacer.</p>",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
        showCancel: true,
        destructive: true,
      })
    : true;

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando vehiculo...");

    await fetchJson(`/vehicles/${id}?user_id=${session.id}`, {
      method: "DELETE",
    });

    await refreshAllData();

  } catch (err) {
    console.error(err);
  } finally {
    hideAppLoading();
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  // Prevent body scroll when modal is open
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  // Restore body scroll when modal is closed
  document.body.classList.remove("modal-open");
}


function viewPlace(id) {
  const place = currentPlaces.find((p) => p.id === id);

  if (!place) return;

  if (typeof openUiModal === "function") {
    openUiModal({
      title: "Detalle del lugar",
      bodyHtml: `
        <div class="place-detail-grid">
          <div><strong>Nombre:</strong> ${place.nombre}</div>
          <div><strong>Ubicacion:</strong> ${place.ubicacion || "Sin dato"}</div>
          <div><strong>Contacto:</strong> ${place.contacto_nombre || "Sin dato"}</div>
          <div><strong>Telefono:</strong> ${place.contacto_numero || "Sin dato"}</div>
        </div>
      `,
    });
    return;
  }

  console.log(place);
}

function editPlace(id) {
  const place = currentPlaces.find(p => p.id === id);
  if (!place) return;

  document.querySelector("#place-form [name=nombre]").value = place.nombre;
  document.querySelector("#place-form [name=ubicacion]").value = place.ubicacion;
  document.querySelector("#place-form [name=contacto_nombre]").value = place.contacto_nombre;
  document.querySelector("#place-form [name=contacto_numero]").value = place.contacto_numero;

  editingPlaceId = id;

  document.querySelector("#place-form button").textContent = "Guardar";
}

async function deletePlace(id) {
  const session = getSession();

  const confirmed = typeof openUiModal === "function"
    ? await openUiModal({
        title: "Eliminar lugar",
        bodyHtml: "<p>Esta accion no se puede deshacer.</p>",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
        showCancel: true,
        destructive: true,
      })
    : true;

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando lugar...");

    await fetchJson(`/places/${id}?user_id=${session.id}`, {
      method: "DELETE",
    });

    await refreshAllData();

  } catch (err) {
    console.error(err);
  } finally {
    hideAppLoading();
  }
}

const appLoading = document.getElementById("app-loading");
const appLoadingText = document.getElementById("app-loading-text");

function showAppLoading(text = "Procesando...") {
  appLoadingText.textContent = text;
  appLoading.classList.remove("hidden");
}

function hideAppLoading() {
  appLoading.classList.add("hidden");
}


async function refreshAllData() {
  await loadSelects();          // 👈 dropdowns
  await loadVehiclesList();     // 👈 modal
  await loadPlacesList();       // 👈 modal
  renderCurrentVehicleKm();
}

document.addEventListener("click", (e) => {
  const modals = document.querySelectorAll(".modal");

  modals.forEach((modal) => {
    if (!modal.classList.contains("hidden") && e.target === modal) {
      closeModal(modal.id);
    }
  });
});

function toggleSection(header, options = {}) {
  const section = header.closest(".collapsible");
  const willOpen = !section.classList.contains("open");
  debugLog("[CARD TOGGLE]", {
    currentView: getCurrentView(),
    section: section?.id || getEventLabel(section),
    willOpen,
  });
  section.classList.toggle("open");

  if (willOpen && options.loadOnOpen === "latest" && !latestRecordsLoaded) {
    loadLatestRecords().catch((error) => {
      setLatestRecordsState("error", error.message);
    });
  }
}

function openVehiclesModal() {
  openModal("vehicles-modal");
  closeMenu();
}

function openPlacesModal() {
  openModal("places-modal");
  closeMenu();
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

function clearMaintenanceImagePreview() {
  if (maintenanceImagePreviewImg) {
    maintenanceImagePreviewImg.src = "";
  }
  maintenanceImagePreview?.classList.add("hidden");
}

maintenanceImageInput?.addEventListener("change", async () => {
  try {
    const selectedImage = maintenanceImageInput.files?.[0];
    const imageValidation = validateSelectedMaintenanceImage(selectedImage);

    if (!imageValidation.ok) {
      maintenanceImageInput.value = "";
      clearMaintenanceImagePreview();
      formMessage.textContent = imageValidation.message;
      return;
    }

    const dataUrl = await fileToDataUrl(selectedImage);
    if (!dataUrl) {
      clearMaintenanceImagePreview();
      return;
    }
    if (maintenanceImagePreviewImg) {
      maintenanceImagePreviewImg.src = dataUrl;
    }
    maintenanceImagePreview?.classList.remove("hidden");
  } catch (error) {
    clearMaintenanceImagePreview();
    formMessage.textContent = error.message;
  }
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getSession();

  if (!session?.id) {
    profileMessage.textContent = "No hay una sesion activa.";
    return;
  }

  const payload = Object.fromEntries(new FormData(profileForm).entries());

  if (!isValidEmail(payload.email)) {
    profileMessage.textContent = "Ingresa un email valido.";
    return;
  }

  if (!isValidPhone(payload.telefono)) {
    profileMessage.textContent = "Ingresa un telefono valido o deja el campo vacio.";
    return;
  }

  profileMessage.textContent = "Guardando perfil...";
  setButtonLoading(profileSaveButton, true, "Guardando...");

  try {
    const response = await fetchJson("/users/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        user_id: session.id,
      }),
    });

    const nextSession = syncSession(response.user);
    fillProfileForm(nextSession);
    profileMessage.textContent = "Perfil actualizado correctamente.";
    setStatus("Perfil actualizado");
  } catch (error) {
    profileMessage.textContent = error.message;
  } finally {
    setButtonLoading(profileSaveButton, false, "Guardando...");
  }
});

profileForm?.elements.profile_photo_url?.addEventListener("input", (event) => {
  const session = getSession() || {};
  const nextName = `${profileForm.elements.nombre.value || session.nombre || ""} ${profileForm.elements.apellido.value || session.apellido || ""}`.trim();
  setProfileAvatar(String(event.target.value || "").trim(), nextName);
});

profileForm?.elements.nombre?.addEventListener("input", () => {
  const nextName = `${profileForm.elements.nombre.value || ""} ${profileForm.elements.apellido.value || ""}`.trim();
  setProfileAvatar(String(profileForm.elements.profile_photo_url.value || "").trim(), nextName);
});

profileForm?.elements.apellido?.addEventListener("input", () => {
  const nextName = `${profileForm.elements.nombre.value || ""} ${profileForm.elements.apellido.value || ""}`.trim();
  setProfileAvatar(String(profileForm.elements.profile_photo_url.value || "").trim(), nextName);
});

preferencesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getSession();

  if (!session?.id) {
    preferencesMessage.textContent = "No hay una sesion activa.";
    return;
  }

  preferencesMessage.textContent = "Guardando preferencias...";
  setButtonLoading(preferencesSaveButton, true, "Guardando...");

  try {
    const response = await fetchJson("/users/preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.id,
        mileage_unit: preferencesForm.elements.mileage_unit.value,
        reminders_enabled: preferencesForm.elements.reminders_enabled.checked,
      }),
    });

    syncSession(response.user);
    fillPreferencesForm(response.user);
    renderCurrentVehicleKm();
    preferencesMessage.textContent = "Preferencias actualizadas.";
    setStatus("Preferencias guardadas");
  } catch (error) {
    preferencesMessage.textContent = error.message;
  } finally {
    setButtonLoading(preferencesSaveButton, false, "Guardando...");
  }
});

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getSession();

  if (!session?.id) {
    passwordMessage.textContent = "No hay una sesion activa.";
    return;
  }

  const payload = Object.fromEntries(new FormData(passwordForm).entries());

  if (String(payload.new_password || "").trim() !== String(payload.confirm_password || "").trim()) {
    passwordMessage.textContent = "La confirmacion no coincide con la nueva contrasena.";
    return;
  }

  passwordMessage.textContent = "Actualizando contrasena...";
  setButtonLoading(passwordSaveButton, true, "Guardando...");

  try {
    await fetchJson("/users/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        user_id: session.id,
      }),
    });

    passwordForm.reset();
    passwordMessage.textContent = "Contrasena actualizada correctamente.";
    setStatus("Contrasena actualizada");
  } catch (error) {
    passwordMessage.textContent = error.message;
  } finally {
    setButtonLoading(passwordSaveButton, false, "Guardando...");
  }
});

function sanitizeFileName(value) {
  return String(value || "historial-mantenimiento")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "historial-mantenimiento";
}

async function exportMaintenanceToPdf() {
  const session = getSession();
  const vehicle = getSelectedVehicle();

  if (!session?.id || !vehicle || !selectedVehicleId) {
    setStatus("Selecciona un vehiculo");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    await openUiModal({
      title: "PDF no disponible",
      bodyHtml: "<p>No se pudo cargar la libreria de exportacion.</p>",
    });
    return;
  }

  setButtonLoading(exportPdfButton, true, "Exportando...");

  try {
    const items = await fetchJson(`/maintenance?user_id=${session.id}&vehiculo_id=${selectedVehicleId}`);
    const sortedItems = [...items].sort((a, b) => {
      const dateDiff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      if (dateDiff !== 0) return dateDiff;
      return Number(a.id) - Number(b.id);
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 56;

    const ensureSpace = (requiredHeight = 36) => {
      if (y + requiredHeight <= pageHeight - 54) {
        return;
      }
      doc.addPage();
      y = 56;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Historial de mantenimiento", 48, y);
    y += 26;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Vehiculo: ${vehicle.nombre} ${vehicle.modelo ? `- ${vehicle.modelo}` : ""}`, 48, y);
    y += 16;
    doc.text(`Patente: ${vehicle.patente || "Sin dato"}`, 48, y);
    y += 16;
    doc.text(`Kilometraje actual: ${formatDistance(vehicle.km_actual)}`, 48, y);
    y += 16;
    doc.text(`Total de registros: ${sortedItems.length}`, 48, y);
    y += 24;

    doc.setDrawColor(206, 214, 224);
    doc.line(48, y, pageWidth - 48, y);
    y += 20;

    if (sortedItems.length === 0) {
      doc.text("No hay mantenimientos cargados para este vehiculo.", 48, y);
    }

    sortedItems.forEach((item, index) => {
      ensureSpace(96);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${index + 1}. ${item.accion}`, 48, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`Fecha: ${item.fecha.slice(0, 10)}`, 48, y);
      y += 14;
      doc.text(`Costo: ${formatCurrency(item.cost)}`, 48, y);
      y += 14;
      doc.text(`Kilometraje: ${formatDistance(item.km)}`, 48, y);
      y += 14;

      const details = doc.splitTextToSize(
        `Taller: ${item.lugar || "Sin dato"} | Descripcion: ${item.accion}`,
        pageWidth - 96
      );
      doc.text(details, 48, y);
      y += details.length * 14 + 10;
      doc.setDrawColor(230, 233, 239);
      doc.line(48, y, pageWidth - 48, y);
      y += 18;
    });

    doc.save(`${sanitizeFileName(vehicle.nombre)}-historial.pdf`);
    setStatus("PDF exportado");
  } catch (error) {
    await openUiModal({
      title: "No se pudo exportar",
      bodyHtml: `<p>${error.message}</p>`,
    });
  } finally {
    setButtonLoading(exportPdfButton, false, "Exportando...");
  }
}

exportPdfButton?.addEventListener("click", exportMaintenanceToPdf);

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("No se pudo registrar el service worker", error);
    });
  });
}



(async function init() {
  setupNumericFieldValidation();
  setupDebugPanel();
  setupDebugObservers();
  window.addEventListener("resize", () => {
    if (getSession()?.email) {
      updateSessionUI();
    }
  });
  registerServiceWorker();
  await playSplashScreen();

  activeView = deriveCurrentViewFromDom();
  const isLoggedIn = updateSessionUI();

  if (!isLoggedIn) {
    setStatus("Bloqueado");
    maintenanceList.innerHTML = '<div class="empty">Accede para continuar.</div>';
    return;
  }

  

  try {
    await loadVehiclesList();
    await loadVehiclesScreen();
    restoreStoredDashboardView();
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    maintenanceList.innerHTML = `<div class="empty">${error.message}</div>`;
  }

  updateDebugCurrentView();
})();
