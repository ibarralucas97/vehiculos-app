let selectedVehicleId = null;
let currentPlaces = [];
let currentVehicles = [];
let editingVehicleId = null;
let vehicleModalMode = "create";
let editingVehicleReminderId = null;
let editingPlaceId = null;
let editingMaintenanceId = null;
const SESSION_KEY = "mygarage_session";
const MAINTENANCE_IMAGES_KEY = "mygarage_maintenance_images";
const VIEW_STATE_KEY = "mygarage_view_state";
const BACK_BUTTON_MOVE_THRESHOLD = 10;
const BACK_BUTTON_GHOST_CLICK_WINDOW_MS = 700;
const MAX_NUMERIC_FIELD_VALUE = 999999999;
const DEFAULT_NOTIFY_DAYS_BEFORE = 30;
const DEFAULT_NOTIFY_KM_BEFORE = 1000;
const DEFAULT_KM_UPDATE_REMINDER_DAYS = 7;
const ALLOWED_MAINTENANCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_MAINTENANCE_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MAINTENANCE_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAINTENANCE_IMAGE_MAX_DIMENSION = 1600;
const MAINTENANCE_IMAGE_JPEG_QUALITY = 0.82;
const NUMERIC_FIELD_CONFIG = {
  km: { allowDecimal: false, label: "Kilometros" },
  cost: { allowDecimal: false, label: "Costo" },
  km_actual: { allowDecimal: false, label: "KM actual" },
  ultimo_service_km: { allowDecimal: false, label: "Ultimo service (KM)" },
  intervalo_km: { allowDecimal: false, label: "Intervalo KM" },
};

const VEHICLE_TYPE_OPTIONS = [
  { value: "moto", label: "Moto", icon: "vehicleMoto" },
  { value: "bicicleta", label: "Bici", icon: "vehicleBicicleta" },
  { value: "auto", label: "Auto", icon: "vehicleAuto" },
  { value: "camioneta", label: "Camioneta", icon: "vehicleCamioneta" },
  { value: "otro", label: "Otros", icon: "vehicleOtro" },
];

const VEHICLE_COLOR_OPTIONS = [
  { value: "rojo", label: "Rojo", hex: "#d85a56" },
  { value: "azul", label: "Azul", hex: "#2f6fdd" },
  { value: "verde", label: "Verde", hex: "#2f9f6b" },
  { value: "negro", label: "Negro", hex: "#1f2937" },
  { value: "gris", label: "Gris", hex: "#7b8794" },
  { value: "blanco", label: "Blanco", hex: "#f8fafc" },
  { value: "amarillo", label: "Amarillo", hex: "#f2c94c" },
  { value: "naranja", label: "Naranja", hex: "#f2994a" },
  { value: "violeta", label: "Violeta", hex: "#8b5cf6" },
  { value: "celeste", label: "Celeste", hex: "#56ccf2" },
];

const VEHICLE_TYPE_MAP = Object.fromEntries(VEHICLE_TYPE_OPTIONS.map((item) => [item.value, item]));
const VEHICLE_COLOR_MAP = Object.fromEntries(VEHICLE_COLOR_OPTIONS.map((item) => [item.value, item]));
const DEFAULT_VEHICLE_TYPE = "otro";
const DEFAULT_VEHICLE_COLOR = "gris";
const VEHICLE_WIZARD_STEPS = [
  { step: 1, title: "Datos basicos", kicker: "Paso 1 de 4" },
  { step: 2, title: "Tipo de vehiculo", kicker: "Paso 2 de 4" },
  { step: 3, title: "Color y recordatorios", kicker: "Paso 3 de 4" },
  { step: 4, title: "Confirmacion", kicker: "Paso 4 de 4" },
];

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
const vehicleFormMessage = document.getElementById("vehicle-form-message");
const placeFormMessage = document.getElementById("place-form-message");
const vehicleTypeInput = document.getElementById("vehicle_type");
const vehicleColorInput = document.getElementById("vehicle_color");
const vehicleTypeOptions = document.getElementById("vehicle-type-options");
const vehicleColorOptions = document.getElementById("vehicle-color-options");
const vehicleWizardKicker = document.getElementById("vehicle-wizard-kicker");
const vehicleWizardTitle = document.getElementById("vehicle-wizard-title");
const vehicleWizardStepper = document.getElementById("vehicle-wizard-stepper");
const vehicleWizardSummary = document.getElementById("vehicle-wizard-summary");
const vehicleWizardBackButton = document.getElementById("vehicle-wizard-back");
const vehicleWizardNextButton = document.getElementById("vehicle-wizard-next");
const vehicleFormSteps = Array.from(document.querySelectorAll(".vehicle-form-step"));
const vehiclesModalTitle = document.getElementById("vehicles-modal-title");
const vehiclesModalCopy = document.getElementById("vehicles-modal-copy");
const vehiclesListModal = document.getElementById("vehicles-list-modal");
const filtersSubmitButton = document.getElementById("filters-submit");
const latestButton = document.getElementById("latest-button");
const exportPdfButton = document.getElementById("export-pdf-button");
const maintenanceSubmitButton = document.getElementById("maintenance-submit");
const vehicleSaveButton = document.getElementById("vehicle-save-button");
const placeSaveButton = document.getElementById("place-save-button");
const vehicleSelect = document.getElementById("vehiculo_id");
const placeSelect = document.getElementById("lugar_id");
const menuButton = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");
const menuHomeButton = document.getElementById("menu-home");
const menuLogoutButton = document.getElementById("menu-logout");
const menuProfileButton = document.getElementById("menu-profile");
const menuSettingsButton = document.getElementById("menu-settings");
const menuActivityButton = document.getElementById("menu-activity");
const menuCurrentVehicleGroup = document.getElementById("menu-current-vehicle-group");
const menuCurrentVehicleName = document.getElementById("menu-current-vehicle-name");
const menuCurrentDashboardButton = document.getElementById("menu-current-dashboard");
const menuCurrentMaintenanceButton = document.getElementById("menu-current-maintenance");
const menuCurrentPlacesButton = document.getElementById("menu-current-places");
const menuCurrentRemindersButton = document.getElementById("menu-current-reminders");
const menuCurrentActivityButton = document.getElementById("menu-current-activity");
const menuCurrentEditButton = document.getElementById("menu-current-edit");
const menuCurrentDeleteButton = document.getElementById("menu-current-delete");
const menuCurrentSettingsButton = document.getElementById("menu-current-settings");
const currentVehicleName = document.getElementById("current-vehicle-name");
const currentVehicleKm = document.getElementById("current-vehicle-km");
const updateKmButton = document.getElementById("update-km-button");
const vehicleNavDashboardButton = document.getElementById("vehicle-nav-dashboard");
const vehicleNavMaintenanceButton = document.getElementById("vehicle-nav-maintenance");
const vehicleNavPlacesButton = document.getElementById("vehicle-nav-places");
const vehicleNavActivityButton = document.getElementById("vehicle-nav-activity");
const vehicleNavSettingsButton = document.getElementById("vehicle-nav-settings");
const maintenanceImageInput = document.getElementById("maintenance-image");
const maintenanceImagePreview = document.getElementById("maintenance-image-preview");
const maintenanceImagePreviewImg = document.getElementById("maintenance-image-preview-img");
const splashScreen = document.getElementById("splash-screen");
const splashLogoImg = document.getElementById("splash-logo-img");
const splashLogoFallback = document.getElementById("splash-logo-fallback");
const welcomeScreen = document.getElementById("welcome-screen");
const topbar = document.getElementById("app-topbar");
const topbarTitleAction = document.getElementById("topbar-title-action");
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
const notificationsStatus = document.getElementById("notifications-status");
const notificationsInstallHint = document.getElementById("notifications-install-hint");
const notificationsToggleButton = document.getElementById("notifications-toggle-button");
const notificationsTestButton = document.getElementById("notifications-test-button");
const pwaInstallBanner = document.getElementById("pwa-install-banner");
const pwaInstallDismiss = document.getElementById("pwa-install-dismiss");
const refreshFeedback = document.getElementById("refresh-feedback");
const refreshFeedbackText = document.getElementById("refresh-feedback-text");
const toastStack = document.getElementById("toast-stack");

const THEME_PREFERENCE_KEY = "mygarage_theme";
const LIGHT_THEME_COLOR = "#0f6c8d";
const DARK_THEME_COLOR = "#121922";
const PWA_INSTALL_DISMISS_KEY = "mygarage_pwa_install_dismissed";
const LOGIN_LOGO_LIGHT_SRC = "/login-logo.png";
const LOGIN_LOGO_DARK_SRC = "/splash-logo-transparent.png";
const themeMenuButton = document.getElementById("menu-theme-toggle");
const loginBrandLogo = document.getElementById("login-brand-logo");
const footerYear = document.getElementById("footer-year");
const maintenanceDetailModal = document.getElementById("maintenance-detail-modal");
const maintenanceDetailTitle = document.getElementById("maintenance-detail-title");
const maintenanceDetailBody = document.getElementById("maintenance-detail-body");
const maintenanceDetailClose = document.getElementById("maintenance-detail-close");
const maintenanceImageLightbox = document.getElementById("maintenance-image-lightbox");
const maintenanceImageLightboxImg = document.getElementById("maintenance-image-lightbox-img");
const maintenanceImageLightboxClose = document.getElementById("maintenance-image-lightbox-close");
const activityList = document.getElementById("activity-list");
const settingsPushState = document.getElementById("settings-push-state");
const settingsPushCopy = document.getElementById("settings-push-copy");
const settingsPermissionState = document.getElementById("settings-permission-state");
const settingsPermissionCopy = document.getElementById("settings-permission-copy");
const settingsInstallState = document.getElementById("settings-install-state");
const settingsInstallCopy = document.getElementById("settings-install-copy");
const settingsSyncState = document.getElementById("settings-sync-state");
const settingsSyncCopy = document.getElementById("settings-sync-copy");
const settingsReminderFrequency = document.getElementById("settings-reminder-frequency");
const settingsReminderKm = document.getElementById("settings-reminder-km");
const vehicleRemindersForm = document.getElementById("vehicle-reminders-form");
const vehicleRemindersTitle = document.getElementById("vehicle-reminders-title");
const vehicleRemindersSubtitle = document.getElementById("vehicle-reminders-subtitle");
const vehicleRemindersSaveButton = document.getElementById("vehicle-reminders-save-button");
const vehicleRemindersMessage = document.getElementById("vehicle-reminders-message");
const vehicleRemindersSummaryDate = document.getElementById("vehicle-reminders-summary-date");
const vehicleRemindersSummaryKm = document.getElementById("vehicle-reminders-summary-km");
const vehicleRemindersSummaryNote = document.getElementById("vehicle-reminders-summary-note");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

let maintenanceImageRefs = getMaintenanceImageRefs();
let latestRecordsLoaded = false;
let currentMaintenanceRecords = new Map();
let notificationsServerStatus = null;
let notificationStateLoading = false;
let notificationsLastSyncAt = null;
let toastId = 0;
let backButtonTouchState = {
  active: false,
  moved: false,
  cancelled: false,
  armed: false,
  startX: 0,
  startY: 0,
  lastTouchEndAt: 0,
};
let activeView = "unknown";
let currentVehicleWizardStep = 1;
let touchGestureState = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
};
let touchScrollResetTimer = null;
let isTouchScrolling = false;
let refreshFeedbackTimer = null;
const TOUCH_SCROLL_THRESHOLD = 8;

const ICONS = {
  themeDark: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  `,
  themeLight: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </svg>
  `,
  view: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  `,
  edit: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.2l9.9-9.9-4.2-4.2L4 15.8V20Z" />
      <path d="M12.8 6.1l4.2 4.2" />
      <path d="M14.7 4.2l1.2-1.2a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8l-1.2 1.2" />
    </svg>
  `,
  more: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  `,
  delete: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9.5 3.5h5L15 7H9l.5-3.5Z" />
      <path d="M7.5 7l1 13h7l1-13" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  `,
  refresh: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0 1.3 4.4" />
      <path d="M20 4v6h-6" />
    </svg>
  `,
  vehicle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 15l1.5-5h11L19 15" />
      <path d="M4 15h16" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  `,
  place: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  `,
  maintenance: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5a3 3 0 0 0 4 4l-9 9-4 1 1-4 9-9Z" />
      <path d="M13 7l4 4" />
    </svg>
  `,
  history: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  `,
  activity: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16" />
      <path d="M7 15l3-4 3 3 4-6" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="10" cy="11" r="1" />
      <circle cx="13" cy="14" r="1" />
      <circle cx="17" cy="8" r="1" />
    </svg>
  `,
  vehicleMoto: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.2" cy="16.8" r="2.4" />
      <circle cx="17.8" cy="16.8" r="2.4" />
      <path d="M7.8 16.8h4.4l2.3-5.3h2.7l1.8 2.1" />
      <path d="M10 10.8h3.2l1.2 1.6" />
      <path d="M12.6 16.8l-1.9-4h-2.4" />
    </svg>
  `,
  vehicleAuto: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 15l1.6-4.8h10.8L19 15" />
      <path d="M4.2 15h15.6" />
      <path d="M8 10.2h8" />
      <circle cx="7.5" cy="17.2" r="1.6" />
      <circle cx="16.5" cy="17.2" r="1.6" />
    </svg>
  `,
  vehicleCamioneta: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.8 14.5h11.5V9.5H9.5L7.8 12H3.8Z" />
      <path d="M15.3 11.2h3.3l1.6 2.3v1h-4.9" />
      <circle cx="7.1" cy="17.1" r="1.7" />
      <circle cx="17.4" cy="17.1" r="1.7" />
    </svg>
  `,
  vehicleCamion: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 8.8h11.8v6.3H3.5Z" />
      <path d="M15.3 11h3.1l2.1 2.7v1.4h-5.2" />
      <circle cx="7.3" cy="17.2" r="1.8" />
      <circle cx="17.5" cy="17.2" r="1.8" />
    </svg>
  `,
  vehicleBicicleta: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.4" cy="16.8" r="2.5" />
      <circle cx="17.7" cy="16.8" r="2.5" />
      <path d="M8.7 9.6h3l2.4 7.2" />
      <path d="M10.2 16.8h3.5l3.2-4.4" />
      <path d="M12.2 9.6l2.2 2.6h3" />
    </svg>
  `,
  vehicleColectivo: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5h14v8.5H5Z" />
      <path d="M7.2 9.2h2.8M11 9.2h2.8M14.8 9.2h2.2" />
      <circle cx="8" cy="17.3" r="1.5" />
      <circle cx="16" cy="17.3" r="1.5" />
    </svg>
  `,
  vehicleOtro: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.8l7.2 4.1v8.2L12 20.2 4.8 16.1V7.9Z" />
      <path d="M12 8.4v4.5" />
      <circle cx="12" cy="15.9" r="0.8" />
    </svg>
  `,
};

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

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_PREFERENCE_KEY);
  } catch (_error) {
    return null;
  }
}

function getPreferredTheme() {
  const savedTheme = getSavedTheme();
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function buildIconMarkup(name) {
  return ICONS[name] || "";
}


function normalizeVehicleType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VEHICLE_TYPE_MAP[normalized] ? normalized : DEFAULT_VEHICLE_TYPE;
}

function normalizeVehicleColor(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VEHICLE_COLOR_MAP[normalized] ? normalized : DEFAULT_VEHICLE_COLOR;
}

function normalizeVehicleRecord(vehicle = {}) {
  return {
    ...vehicle,
    vehicle_type: normalizeVehicleType(vehicle.vehicle_type),
    vehicle_color: normalizeVehicleColor(vehicle.vehicle_color),
  };
}

function getVehicleTypeConfig(value) {
  return VEHICLE_TYPE_MAP[normalizeVehicleType(value)] || VEHICLE_TYPE_MAP[DEFAULT_VEHICLE_TYPE];
}

function getVehicleColorConfig(value) {
  return VEHICLE_COLOR_MAP[normalizeVehicleColor(value)] || VEHICLE_COLOR_MAP[DEFAULT_VEHICLE_COLOR];
}

function renderVehicleVisualSelectors() {
  if (vehicleTypeOptions) {
    vehicleTypeOptions.innerHTML = VEHICLE_TYPE_OPTIONS.map((item) => `
      <button
        type="button"
        class="vehicle-type-chip"
        data-vehicle-type-option="${item.value}"
        aria-pressed="false"
      >
        <span class="vehicle-type-chip-icon" aria-hidden="true">${buildIconMarkup(item.icon)}</span>
        <span>${item.label}</span>
        <span class="vehicle-type-chip-check" aria-hidden="true"></span>
      </button>
    `).join("");
  }

  if (vehicleColorOptions) {
    vehicleColorOptions.innerHTML = VEHICLE_COLOR_OPTIONS.map((item) => `
      <button
        type="button"
        class="vehicle-color-chip"
        data-vehicle-color-option="${item.value}"
        aria-pressed="false"
        title="${item.label}"
        style="--vehicle-color:${item.hex}"
      >
        <span class="vehicle-color-chip-swatch" style="--vehicle-color:${item.hex}"></span>
        <span class="vehicle-color-chip-check" aria-hidden="true"></span>
        <span class="sr-only">${item.label}</span>
      </button>
    `).join("");
  }

  syncVehicleVisualSelectors();
}

function syncVehicleVisualSelectors() {
  const selectedType = normalizeVehicleType(vehicleTypeInput?.value);
  const selectedColor = normalizeVehicleColor(vehicleColorInput?.value);

  vehicleTypeOptions?.querySelectorAll("[data-vehicle-type-option]").forEach((button) => {
    const isActive = button.getAttribute("data-vehicle-type-option") === selectedType;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  vehicleColorOptions?.querySelectorAll("[data-vehicle-color-option]").forEach((button) => {
    const isActive = button.getAttribute("data-vehicle-color-option") === selectedColor;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function buildVehicleWizardStepper() {
  if (!vehicleWizardStepper) return;
  vehicleWizardStepper.innerHTML = VEHICLE_WIZARD_STEPS.map((item) => `
    <span
      class="vehicle-wizard-dot${item.step === currentVehicleWizardStep ? " is-active" : ""}${item.step < currentVehicleWizardStep ? " is-complete" : ""}"
      aria-hidden="true"
    ></span>
  `).join("");
}

function buildVehicleWizardSummary() {
  if (!vehicleWizardSummary || !vehicleForm) return;
  const formData = Object.fromEntries(new FormData(vehicleForm).entries());
  const typeConfig = getVehicleTypeConfig(formData.vehicle_type);
  const colorConfig = getVehicleColorConfig(formData.vehicle_color);
  vehicleWizardSummary.innerHTML = `
    <div class="vehicle-wizard-summary-card" style="--vehicle-color:${colorConfig.hex}">
      ${buildVehicleIdentityMarkup({
        nombre: formData.nombre,
        modelo: formData.modelo,
        patente: formData.patente,
        vehicle_type: formData.vehicle_type,
        vehicle_color: formData.vehicle_color,
      })}
      <div class="vehicle-wizard-summary-meta">
        <span><strong>Tipo:</strong> ${typeConfig.label}</span>
        <span><strong>Color:</strong> ${colorConfig.label}</span>
        <span><strong>KM actual:</strong> ${formData.km_actual || "Sin dato"}</span>
        <span><strong>Ultimo service:</strong> ${formData.ultimo_service_km || "Sin dato"}</span>
        <span><strong>Intervalo KM:</strong> ${formData.intervalo_km || "Sin dato"}</span>
        <span><strong>Intervalo meses:</strong> ${formData.intervalo_tiempo || "Sin dato"}</span>
      </div>
    </div>
  `;
}

function setVehicleWizardStep(nextStep) {
  const safeStep = Math.min(Math.max(Number(nextStep) || 1, 1), VEHICLE_WIZARD_STEPS.length);
  currentVehicleWizardStep = safeStep;
  const stepConfig = VEHICLE_WIZARD_STEPS.find((item) => item.step === safeStep) || VEHICLE_WIZARD_STEPS[0];

  vehicleFormSteps.forEach((section) => {
    const isActive = Number(section.dataset.step) === safeStep;
    section.classList.toggle("hidden", !isActive);
  });

  if (vehicleWizardKicker) {
    vehicleWizardKicker.textContent = stepConfig.kicker;
  }
  if (vehicleWizardTitle) {
    vehicleWizardTitle.textContent = stepConfig.title;
  }
  if (vehicleWizardBackButton) {
    vehicleWizardBackButton.disabled = safeStep === 1;
  }
  if (vehicleWizardNextButton) {
    vehicleWizardNextButton.classList.toggle("hidden", safeStep === VEHICLE_WIZARD_STEPS.length);
    vehicleWizardNextButton.toggleAttribute("hidden", safeStep === VEHICLE_WIZARD_STEPS.length);
  }
  if (vehicleSaveButton) {
    vehicleSaveButton.classList.toggle("hidden", safeStep !== VEHICLE_WIZARD_STEPS.length);
    vehicleSaveButton.toggleAttribute("hidden", safeStep !== VEHICLE_WIZARD_STEPS.length);
    if (!vehicleSaveButton.classList.contains("hidden")) {
      vehicleSaveButton.textContent = editingVehicleId ? "Guardar cambios" : "Crear vehiculo";
    }
  }

  buildVehicleWizardStepper();
  if (safeStep === VEHICLE_WIZARD_STEPS.length) {
    buildVehicleWizardSummary();
  }
}

function validateVehicleWizardStep(step = currentVehicleWizardStep) {
  if (!vehicleForm) return true;
  if (step === 1) {
    const nameField = vehicleForm.elements.nombre;
    const modelField = vehicleForm.elements.modelo;
    return nameField?.reportValidity() && modelField?.reportValidity();
  }
  return true;
}

function goToVehicleWizardStep(nextStep) {
  if (nextStep > currentVehicleWizardStep && !validateVehicleWizardStep(currentVehicleWizardStep)) {
    return;
  }
  setVehicleWizardStep(nextStep);
}

function buildVehicleIdentityMarkup(vehicle = {}) {
  const typeConfig = getVehicleTypeConfig(vehicle.vehicle_type);
  const colorConfig = getVehicleColorConfig(vehicle.vehicle_color);
  const modelLabel = vehicle.modelo ? escapeHtml(vehicle.modelo) : "";
  const plateLabel = vehicle.patente ? escapeHtml(vehicle.patente) : "Sin patente";
  const showType = normalizeVehicleType(vehicle.vehicle_type) !== DEFAULT_VEHICLE_TYPE;
  const showColor = normalizeVehicleColor(vehicle.vehicle_color) !== DEFAULT_VEHICLE_COLOR;
  const subtitle = [modelLabel, showType ? typeConfig.label : ""].filter(Boolean).join(" · ");

  return `
    <div class="vehicle-card-shell" style="--vehicle-color:${colorConfig.hex}">
      <div class="vehicle-card-head">
        <div class="vehicle-card-icon" aria-hidden="true">${buildIconMarkup(typeConfig.icon)}</div>
        <div class="vehicle-card-copy">
          ${showType ? `<span class="vehicle-card-type">${typeConfig.label}</span>` : ""}
          <strong>${escapeHtml(vehicle.nombre || "Vehiculo")}</strong>
          ${subtitle ? `<span>${subtitle}</span>` : ""}
        </div>
      </div>
      <div class="vehicle-card-meta">
        ${showColor ? `<span class="vehicle-card-color-badge">${colorConfig.label}</span>` : ""}
        <span class="vehicle-card-plate">${plateLabel}</span>
      </div>
    </div>
  `;
}

function buildVehicleListSummaryMarkup(vehicle = {}) {
  const typeConfig = getVehicleTypeConfig(vehicle.vehicle_type);
  const colorConfig = getVehicleColorConfig(vehicle.vehicle_color);
  const showType = normalizeVehicleType(vehicle.vehicle_type) !== DEFAULT_VEHICLE_TYPE;
  const showColor = normalizeVehicleColor(vehicle.vehicle_color) !== DEFAULT_VEHICLE_COLOR;
  const summaryMeta = [showType ? typeConfig.label : "", escapeHtml(vehicle.patente || "Sin patente")].filter(Boolean).join(" · ");
  return `
    <div class="vehicle-list-summary">
      <span class="vehicle-list-summary-icon" style="--vehicle-color:${colorConfig.hex}" aria-hidden="true">${buildIconMarkup(typeConfig.icon)}</span>
      <div class="vehicle-list-summary-copy">
        <strong>${escapeHtml(vehicle.nombre || "Vehiculo")}</strong>
        <span>${typeConfig.label} · ${escapeHtml(vehicle.patente || "Sin patente")}</span>
      </div>
      <span class="vehicle-list-summary-color">${colorConfig.label}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmptyStateMarkup({ icon = "activity", title = "Sin datos", body = "", actionLabel = "", action = "" } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${buildIconMarkup(icon)}</div>
      <div class="empty-state-copy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
      ${
        actionLabel && action
          ? `<button class="ghost empty-state-action" type="button" onclick="${action}">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>
  `;
}

function formatDateTimeLabel(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dismissToast(id) {
  const toast = document.querySelector(`[data-toast-id="${id}"]`);
  if (!toast) return;
  toast.classList.add("is-leaving");
  window.setTimeout(() => toast.remove(), 220);
}

function showToast(message, { tone = "info", duration = 2600 } = {}) {
  if (!toastStack) return;
  toastId += 1;
  const id = String(toastId);
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.dataset.toastId = id;
  toast.innerHTML = `
    <div class="toast-copy">
      <strong>${escapeHtml(
        tone === "success"
          ? "Listo"
          : tone === "error"
            ? "Error"
            : tone === "warning"
              ? "Atencion"
              : "Informacion"
      )}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="toast-close" type="button" aria-label="Cerrar notificacion">${buildIconMarkup("delete")}</button>
  `;
  toast.querySelector(".toast-close")?.addEventListener("click", () => dismissToast(id));
  toastStack.prepend(toast);
  window.setTimeout(() => dismissToast(id), duration);
}

function showRefreshFeedback(message = "Actualizando datos...") {
  if (!refreshFeedback || !refreshFeedbackText) return;
  if (refreshFeedbackTimer) {
    window.clearTimeout(refreshFeedbackTimer);
    refreshFeedbackTimer = null;
  }
  refreshFeedbackText.textContent = message;
  refreshFeedback.classList.remove("hidden", "is-success", "is-error");
  refreshFeedback.classList.add("is-visible");
}

function hideRefreshFeedback({ tone = "", delay = 900 } = {}) {
  if (!refreshFeedback) return;
  refreshFeedback.classList.toggle("is-success", tone === "success");
  refreshFeedback.classList.toggle("is-error", tone === "error");
  if (refreshFeedbackTimer) {
    window.clearTimeout(refreshFeedbackTimer);
  }
  refreshFeedbackTimer = window.setTimeout(() => {
    refreshFeedback.classList.remove("is-visible", "is-success", "is-error");
    refreshFeedback.classList.add("hidden");
    refreshFeedbackTimer = null;
  }, delay);
}

function isModalOpen(id) {
  const modal = document.getElementById(id);
  return Boolean(modal && !modal.classList.contains("hidden"));
}

function syncSelectedVehicleContext() {
  const vehicle = getSelectedVehicle();
  if (!vehicle) {
    if (currentVehicleName) currentVehicleName.textContent = "Sin seleccion";
    if (currentVehicleKm) currentVehicleKm.textContent = "Sin dato";
    return;
  }

  if (currentVehicleName) {
    currentVehicleName.textContent = `${vehicle.nombre}${vehicle.modelo ? ` - ${vehicle.modelo}` : ""}`;
  }
  renderCurrentVehicleKm();
}

function openMaintenanceComposer() {
  if (maintenanceSection && !maintenanceSection.classList.contains("open")) {
    maintenanceSection.classList.add("open");
  }
  maintenanceForm?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReminderSettingsSummary(session = getSession(), status = notificationsServerStatus) {
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const permissionLabel = permission === "granted"
    ? "Permitido"
    : permission === "denied"
      ? "Denegado"
      : permission === "default"
        ? "Pendiente"
        : "No compatible";
  const pushLabel = !isPushSupportedInBrowser()
    ? "No compatible"
    : !status?.pushConfigured
      ? "Servidor incompleto"
      : Number(status?.subscriptionCount || 0) > 0
        ? "Activo"
        : "Disponible";
  const installLabel = isStandaloneApp() ? "Instalada" : isMobileDevice() ? "Recomendada" : "Opcional";

  if (settingsPushState) settingsPushState.textContent = pushLabel;
  if (settingsPushCopy) {
    settingsPushCopy.textContent = Number(status?.subscriptionCount || 0) > 0
      ? `${status.subscriptionCount} dispositivo(s) suscripto(s).`
      : "Activa push y usa Enviar prueba para validarlo.";
  }

  if (settingsPermissionState) settingsPermissionState.textContent = permissionLabel;
  if (settingsPermissionCopy) {
    settingsPermissionCopy.textContent = permission === "denied"
      ? "Rehabilitalo desde la configuracion del navegador."
      : "Lo consulta Rodado Control al abrir esta seccion.";
  }

  if (settingsInstallState) settingsInstallState.textContent = installLabel;
  if (settingsInstallCopy) {
    settingsInstallCopy.textContent = isStandaloneApp()
      ? "La app ya esta instalada en este dispositivo."
      : "Instalar la PWA mejora estabilidad y notificaciones.";
  }

  if (settingsSyncState) settingsSyncState.textContent = notificationsLastSyncAt ? formatDateTimeLabel(notificationsLastSyncAt) : "Sin datos";
  if (settingsSyncCopy) settingsSyncCopy.textContent = status ? "Estado consultado al backend correctamente." : "Se completara al refrescar notificaciones.";

  if (settingsReminderFrequency) {
    settingsReminderFrequency.textContent = "Los recordatorios por meses, kilometraje y actualizacion de km se configuran por vehiculo desde el menu contextual.";
  }

  if (settingsReminderKm) {
    settingsReminderKm.textContent = session?.remindersEnabled === false
      ? "Los recordatorios automaticos estan pausados en tu configuracion."
      : "Mantene activas las notificaciones de este dispositivo para recibir avisos reales.";
  }
}

async function loadActivityHistory() {
  const session = getSession();
  if (!activityList || !session?.id) return;

  activityList.innerHTML = buildEmptyStateMarkup({
    icon: "activity",
    title: "Cargando actividad",
    body: "Estamos consultando las acciones recientes de tu cuenta.",
  });

  const items = await fetchJson(`/activity?user_id=${session.id}&limit=40`);

  if (!Array.isArray(items) || items.length === 0) {
    activityList.innerHTML = buildEmptyStateMarkup({
      icon: "activity",
      title: "Todavia no hay actividad",
      body: "Cuando crees, edites o elimines datos, veras el registro aqui.",
    });
    return;
  }

  activityList.innerHTML = items.map((item) => `
    <article class="activity-item">
      <div class="activity-item-dot" aria-hidden="true"></div>
      <div class="activity-item-body">
        <p class="activity-item-title">${escapeHtml(item.description || item.title || "Actividad registrada")}</p>
        <p class="activity-item-meta">${escapeHtml(item.actorName || "Usuario")} · ${escapeHtml(formatDateTimeLabel(item.createdAt))}</p>
      </div>
    </article>
  `).join("");
}

async function openActivityModal() {
  closeMenu();
  openModal("activity-modal");
  try {
    await loadActivityHistory();
  } catch (error) {
    if (activityList) {
      activityList.innerHTML = buildEmptyStateMarkup({
        icon: "activity",
        title: "No se pudo cargar la actividad",
        body: error.message,
      });
    }
  }
}

async function refreshCurrentContext({ silent = false } = {}) {
  const session = getSession();
  if (!session?.id) return;

  topbarTitleAction?.classList.add("is-refreshing");
  if (!silent) {
    showRefreshFeedback("Actualizando datos...");
    showToast("Actualizando datos...", { tone: "info", duration: 1800 });
  }

  try {
    if (getCurrentView() === "vehicles") {
      await loadVehiclesScreen();
      if (isModalOpen("vehicles-modal")) {
        await loadVehiclesList();
      }
    }

    if (getCurrentView() === "dashboard") {
      await refreshAllData();
      syncSelectedVehicleContext();

      if (typeof loadDashboardOverview === "function") {
        await loadDashboardOverview();
      }

      if (isCollapsibleSectionOpen(latestRecordsSection) || latestRecordsLoaded) {
        await loadLatestRecords();
      }

      if (isCollapsibleSectionOpen(historySection) && hasActiveFilters()) {
        await loadMaintenance();
      }
    }

    if (isModalOpen("places-modal")) {
      await loadPlacesList();
    }

    if (isModalOpen("settings-modal")) {
      const profile = await fetchCurrentProfile();
      fillPreferencesForm(profile);
      await refreshNotificationControls();
      renderReminderSettingsSummary(profile, notificationsServerStatus);
    }

    if (isModalOpen("profile-modal")) {
      const profile = await fetchCurrentProfile();
      fillProfileForm(profile);
    }

    if (isModalOpen("activity-modal")) {
      await loadActivityHistory();
    }

    if (!silent) {
      showRefreshFeedback("Datos actualizados");
      hideRefreshFeedback({ tone: "success", delay: 860 });
      showToast("Datos actualizados", { tone: "success" });
    }
  } catch (error) {
    console.error(error);
    showRefreshFeedback("No se pudieron actualizar los datos");
    hideRefreshFeedback({ tone: "error", delay: 1400 });
    showToast("No se pudieron actualizar los datos", { tone: "error", duration: 3400 });
  } finally {
    window.setTimeout(() => topbarTitleAction?.classList.remove("is-refreshing"), 320);
  }
}

function updateThemeMenuButton(theme = document.body.dataset.theme) {
  if (!themeMenuButton) return;

  const isDark = theme === "dark";
  const nextLabel = isDark ? "Modo claro" : "Modo oscuro";
  const nextIcon = isDark ? "themeLight" : "themeDark";

  themeMenuButton.setAttribute("aria-pressed", String(isDark));
  themeMenuButton.setAttribute("aria-label", `Cambiar a ${nextLabel.toLowerCase()}`);
  themeMenuButton.innerHTML = `
    <span class="menu-button-icon" aria-hidden="true">${buildIconMarkup(nextIcon)}</span>
    <span class="menu-button-label">${nextLabel}</span>
  `;
}

function syncLoginBrandLogo(theme = document.body.dataset.theme) {
  if (!loginBrandLogo) return;

  const nextSrc = theme === "dark" ? LOGIN_LOGO_DARK_SRC : LOGIN_LOGO_LIGHT_SRC;
  if (!loginBrandLogo.getAttribute("src") || loginBrandLogo.getAttribute("src") !== nextSrc) {
    loginBrandLogo.setAttribute("src", nextSrc);
  }
}

function applyTheme(theme) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = resolvedTheme;
  updateThemeMenuButton(resolvedTheme);
  syncLoginBrandLogo(resolvedTheme);

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_PREFERENCE_KEY, theme);
  } catch (_error) {
    // Ignore storage issues on private sessions.
  }
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  persistTheme(nextTheme);
  applyTheme(nextTheme);
  closeMenu();
}

function syncFooterYear() {
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isMobileDevice() {
  return window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 900;
}

function setNotificationStatus(message, tone = "warning") {
  if (!notificationsStatus) return;
  notificationsStatus.textContent = message;
  notificationsStatus.classList.remove("is-success", "is-warning", "is-error");

  if (tone === "success") notificationsStatus.classList.add("is-success");
  if (tone === "warning") notificationsStatus.classList.add("is-warning");
  if (tone === "error") notificationsStatus.classList.add("is-error");
}

function shouldShowPwaInstallBanner() {
  if (!pwaInstallBanner) return false;

  const dismissed = (() => {
    try {
      return localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === "1";
    } catch (_error) {
      return false;
    }
  })();

  return isMobileDevice() && !isStandaloneApp() && !dismissed;
}

function updatePwaInstallBanner() {
  if (!pwaInstallBanner) return;
  pwaInstallBanner.classList.toggle("hidden", !shouldShowPwaInstallBanner());
}

function dismissPwaInstallBanner() {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1");
  } catch (_error) {
    // Ignore storage issues.
  }
  updatePwaInstallBanner();
}

function isPushSupportedInBrowser() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function base64UrlToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(normalized);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function buildDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    standalone: isStandaloneApp(),
    source: "settings",
  };
}

async function fetchNotificationServerStatus() {
  const session = getSession();

  if (!session?.id) {
    return null;
  }

  const status = await fetchJson(`/notifications/status?user_id=${session.id}`);
  notificationsServerStatus = status;
  notificationsLastSyncAt = new Date().toISOString();
  return status;
}

async function getCurrentPushSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function refreshNotificationControls() {
  if (!notificationsStatus || !notificationsToggleButton || !notificationsTestButton) {
    return;
  }

  const session = getSession();
  if (!session?.id) {
    return;
  }

  if (notificationStateLoading) {
    return;
  }

  notificationStateLoading = true;

  try {
    notificationsToggleButton.disabled = true;
    notificationsTestButton.disabled = true;
    notificationsInstallHint?.classList.add("hidden");

    if (!isPushSupportedInBrowser()) {
      setNotificationStatus("Este navegador no soporta notificaciones push reales.", "error");
      return;
    }

    const status = await fetchNotificationServerStatus();
    const subscription = await getCurrentPushSubscription();
    const hasSubscription = Boolean(subscription) && Number(status?.subscriptionCount || 0) > 0;
    const permission = Notification.permission;
    const remindersPaused = session.remindersEnabled === false;

    if (!status?.pushConfigured) {
      setNotificationStatus("El servidor todavia no tiene push configurado.", "error");
      return;
    }

    if (permission === "denied") {
      setNotificationStatus("Permiso denegado. Habilitalo desde la configuracion del navegador.", "error");
    } else if (hasSubscription) {
      setNotificationStatus(
        remindersPaused
          ? "Notificaciones activadas. Los recordatorios automaticos estan pausados en tu configuracion."
          : "Notificaciones activadas.",
        remindersPaused ? "warning" : "success"
      );
    } else if (permission === "granted") {
      setNotificationStatus("Permiso concedido. Falta activar la suscripcion push.", "warning");
    } else {
      setNotificationStatus("Activa las notificaciones para recibir recordatorios reales.", "warning");
    }

    if (isMobileDevice() && !isStandaloneApp()) {
      notificationsInstallHint?.classList.remove("hidden");
    }

    notificationsToggleButton.textContent = hasSubscription ? "Desactivar notificaciones" : "Activar notificaciones";
    notificationsToggleButton.disabled = false;
    notificationsTestButton.disabled = !hasSubscription;
    renderReminderSettingsSummary(session, status);
  } catch (error) {
    setNotificationStatus(error.message, "error");
  } finally {
    notificationStateLoading = false;
  }
}

async function enablePushNotifications() {
  const session = getSession();

  if (!session?.id) {
    throw new Error("No hay una sesion activa.");
  }

  const status = notificationsServerStatus || (await fetchNotificationServerStatus());

  if (!status?.pushConfigured || !status?.vapidPublicKey) {
    throw new Error("El servidor no tiene push configurado.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("No se concedio el permiso para mostrar notificaciones.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(status.vapidPublicKey),
    });
  }

  await fetchJson("/notifications/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: session.id,
      subscription: subscription.toJSON(),
      device_info: buildDeviceInfo(),
    }),
  });
}

async function disablePushNotifications() {
  const session = getSession();

  if (!session?.id) {
    throw new Error("No hay una sesion activa.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription?.endpoint) {
    await fetchJson("/notifications/subscribe", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.id,
        endpoint: subscription.endpoint,
      }),
    });

    await subscription.unsubscribe().catch(() => {});
  }
}

async function handleNotificationToggle() {
  setButtonLoading(notificationsToggleButton, true, "Procesando...");

  try {
    const subscription = isPushSupportedInBrowser() ? await getCurrentPushSubscription() : null;

    if (subscription && Number(notificationsServerStatus?.subscriptionCount || 0) > 0) {
      await disablePushNotifications();
    } else {
      await enablePushNotifications();
    }

    await refreshNotificationControls();
  } catch (error) {
    setNotificationStatus(error.message, "error");
  } finally {
    setButtonLoading(notificationsToggleButton, false, "Procesando...");
  }
}

async function sendPushTestNotification() {
  const session = getSession();

  if (!session?.id) {
    throw new Error("No hay una sesion activa.");
  }

  setButtonLoading(notificationsTestButton, true, "Enviando...");

  try {
    await fetchJson("/notifications/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.id,
      }),
    });

    setNotificationStatus("Notificacion de prueba enviada.", "success");
  } catch (error) {
    setNotificationStatus(error.message, "error");
  } finally {
    setButtonLoading(notificationsTestButton, false, "Enviando...");
  }
}

function applyNotificationIntentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const targetView = params.get("view");
  const vehicleId = Number(params.get("vehicleId") || 0);
  const hasIntent = targetView || vehicleId;

  if (!hasIntent) {
    return;
  }

  if (targetView === "dashboard" && vehicleId) {
    try {
      sessionStorage.setItem(
        VIEW_STATE_KEY,
        JSON.stringify({
          view: "dashboard",
          vehicleId,
        })
      );
    } catch (_error) {
      // Ignore storage issues.
    }
  }

  const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
  history.replaceState({}, document.title, cleanUrl);
}

function syncSession(user) {
  if (!user) return null;
  saveSession(user);
  updateSessionUI();
  return getSession();
}

function setButtonLoading(button, isLoading, loadingText = "Guardando...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
  }
}

function resetVehicleFormState() {
  editingVehicleId = null;
  vehicleModalMode = "create";
  vehicleForm?.reset();
  if (vehicleTypeInput) {
    vehicleTypeInput.value = DEFAULT_VEHICLE_TYPE;
  }
  if (vehicleColorInput) {
    vehicleColorInput.value = DEFAULT_VEHICLE_COLOR;
  }
  syncVehicleVisualSelectors();
  if (vehicleSaveButton) {
    vehicleSaveButton.textContent = "Crear vehiculo";
  }
  if (vehiclesModalTitle) {
    vehiclesModalTitle.textContent = "Crear vehiculo";
  }
  if (vehiclesModalCopy) {
    vehiclesModalCopy.textContent = "Completa los datos y guarda un nuevo vehiculo.";
  }
  if (vehiclesListModal) {
    vehiclesListModal.classList.add("hidden");
    vehiclesListModal.setAttribute("aria-hidden", "true");
  }
  if (vehicleFormMessage) {
    vehicleFormMessage.textContent = "";
  }
  setVehicleWizardStep(1);
}

function setVehicleModalMode(mode, vehicle = null) {
  vehicleModalMode = mode === "edit" ? "edit" : "create";
  const isEditMode = vehicleModalMode === "edit" && Boolean(vehicle);

  if (vehiclesModalTitle) {
    vehiclesModalTitle.textContent = isEditMode ? "Editar vehiculo" : "Crear vehiculo";
  }
  if (vehiclesModalCopy) {
    vehiclesModalCopy.textContent = isEditMode
      ? `Revisa y actualiza los datos de ${vehicle?.nombre || "este vehiculo"}.`
      : "Completa los datos y guarda un nuevo vehiculo.";
  }
  if (vehicleSaveButton) {
    vehicleSaveButton.textContent = isEditMode ? "Guardar cambios" : "Crear vehiculo";
  }
  if (vehiclesListModal) {
    vehiclesListModal.classList.add("hidden");
    vehiclesListModal.setAttribute("aria-hidden", "true");
  }
}

function populateVehicleForm(vehicle) {
  document.querySelector("#vehicle-form [name=nombre]").value = vehicle.nombre || "";
  document.querySelector("#vehicle-form [name=modelo]").value = vehicle.modelo || "";
  document.querySelector("#vehicle-form [name=patente]").value = vehicle.patente || "";
  document.querySelector("#vehicle-form [name=vehicle_type]").value = normalizeVehicleType(vehicle.vehicle_type);
  document.querySelector("#vehicle-form [name=vehicle_color]").value = normalizeVehicleColor(vehicle.vehicle_color);
  document.querySelector("#vehicle-form [name=km_actual]").value = vehicle.km_actual ?? "";
  document.querySelector("#vehicle-form [name=ultimo_service_km]").value = vehicle.ultimo_service_km ?? "";
  document.querySelector("#vehicle-form [name=intervalo_km]").value = vehicle.intervalo_km ?? "";
  document.querySelector("#vehicle-form [name=fecha_ultimo_service]").value = vehicle.fecha_ultimo_service ? String(vehicle.fecha_ultimo_service).slice(0, 10) : "";
  document.querySelector("#vehicle-form [name=intervalo_tiempo]").value = vehicle.intervalo_tiempo ?? "";
  syncVehicleVisualSelectors();
}

function openVehicleCreateModal() {
  resetVehicleFormState();
  openModal("vehicles-modal");
  closeMenu();
}

function openVehicleEditModal(id) {
  const vehicle = currentVehicles.find((item) => Number(item.id) === Number(id));
  if (!vehicle) return;

  resetVehicleFormState();
  editingVehicleId = Number(id);
  populateVehicleForm(vehicle);
  setVehicleModalMode("edit", vehicle);
  if (vehicleFormMessage) {
    vehicleFormMessage.textContent = "Editando vehiculo seleccionado.";
  }
  setVehicleWizardStep(1);
  openModal("vehicles-modal");
  closeMenu();
}

function resetPlaceFormState() {
  editingPlaceId = null;
  placeForm?.reset();
  if (placeSaveButton) {
    placeSaveButton.textContent = "Crear";
  }
  if (placeFormMessage) {
    placeFormMessage.textContent = "";
  }
}

function resetMaintenanceFormState() {
  editingMaintenanceId = null;
  maintenanceForm?.reset();
  clearMaintenanceImagePreview();
  if (maintenanceSubmitButton) {
    maintenanceSubmitButton.textContent = "Guardar mantenimiento";
  }
  if (formMessage) {
    formMessage.textContent = "";
  }
}


const vehiclesScreen = document.getElementById("vehicles-screen");

function updateTopbarContext() {
  if (!topbarBackButton) return;
  const inVehicleDetail = getCurrentView() === "dashboard";
  topbarBackButton.disabled = !inVehicleDetail;
  topbarBackButton.classList.toggle("is-inactive", !inVehicleDetail);
}

function getSelectedVehicle() {
  return currentVehicles.find((vehicle) => Number(vehicle.id) === Number(selectedVehicleId)) || null;
}

function updateMenuContext() {
  const selectedVehicle = getSelectedVehicle();
  const hasCurrentVehicle = Boolean(selectedVehicle) && getCurrentView() === "dashboard";

  menuCurrentVehicleGroup?.classList.toggle("hidden", !hasCurrentVehicle);

  if (menuCurrentVehicleName) {
    menuCurrentVehicleName.textContent = hasCurrentVehicle
      ? `${selectedVehicle.nombre || "Vehiculo"}${selectedVehicle.modelo ? ` · ${selectedVehicle.modelo}` : ""}`
      : "Sin vehiculo abierto";
  }

  menuHomeButton?.classList.toggle("hidden", getCurrentView() === "vehicles");
}

function updateVehicleContextTabs(activeTab = "dashboard") {
  const tabs = [
    [vehicleNavDashboardButton, "dashboard"],
    [vehicleNavMaintenanceButton, "maintenance"],
    [vehicleNavPlacesButton, "places"],
    [vehicleNavActivityButton, "activity"],
    [vehicleNavSettingsButton, "settings"],
  ];

  tabs.forEach(([button, key]) => {
    if (!button) return;
    button.classList.toggle("is-active", key === activeTab);
  });
}

function focusDashboardSection(section) {
  if (!section) return;
  section.classList.add("open");
  updateVehicleContextTabs(section === maintenanceSection ? "maintenance" : "dashboard");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openCurrentVehicleDashboard() {
  closeMenu();
  updateVehicleContextTabs("dashboard");
  dashboard?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openCurrentVehicleMaintenance() {
  closeMenu();
  focusDashboardSection(maintenanceSection);
}

function openCurrentVehiclePlaces() {
  closeMenu();
  updateVehicleContextTabs("places");
  openPlacesModal();
}

function openCurrentVehicleReminders() {
  const selectedVehicle = getSelectedVehicle();
  if (!selectedVehicle) return;

  closeMenu();
  openVehicleRemindersModal(selectedVehicle.id);
}

function openCurrentVehicleActivity() {
  closeMenu();
  updateVehicleContextTabs("activity");
  openActivityModal();
}

function openCurrentVehicleSettings() {
  const selectedVehicle = getSelectedVehicle();
  if (!selectedVehicle) return;

  closeMenu();
  openVehicleEditModal(selectedVehicle.id);
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
      if (!hasCurrentVehicle) {
        setView("vehicles", "updateSessionUI", null, { reason: "noCurrentVehicle" });
      }
    } else if (currentView === "vehicles") {
      // UI only: no navigation needed.
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
  updateMenuContext();
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
  return {
    source: origin,
    target: destination,
    currentView: getCurrentView(),
    timestamp: new Date().toISOString(),
    ...details,
  };
}

function isTouchCapableDevice() {
  return window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0;
}

function updateDebugCurrentView() {}

function debugLog() {}

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
  }, 160);
}

function setView(nextView, source, event = null, extra = {}) {
  const previousView = getCurrentView();

  if (
    previousView === "dashboard" &&
    nextView === "vehicles" &&
    isTouchScrolling &&
    source !== "explicitBackButton"
  ) {
    return false;
  }

  if (nextView === previousView) {
    return true;
  }

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
  updateTopbarContext();
  updateMenuContext();
  updateDebugCurrentView(nextView);
  return true;
}

function setupTouchScrollTracking() {
  const trackTouchScroll = (event) => {
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
  };

  document.addEventListener("touchstart", trackTouchScroll, { passive: true, capture: true });
  document.addEventListener("touchmove", trackTouchScroll, { passive: true, capture: true });
  document.addEventListener("touchend", trackTouchScroll, { passive: true, capture: true });
  document.addEventListener("touchcancel", trackTouchScroll, { passive: true, capture: true });
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
  updateVehicleContextTabs("dashboard");
  resetMaintenanceFormState();

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
    await refreshNotificationControls();
    renderReminderSettingsSummary(profile, notificationsServerStatus);
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


async function fetchJson(url, options = {}) {
  const method = String(options?.method || "GET").toUpperCase();
  const requestOptions = {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  };

  let requestUrl = url;

  if (method === "GET") {
    requestOptions.cache = "no-store";
    const separator = String(url).includes("?") ? "&" : "?";
    requestUrl = `${url}${separator}_ts=${Date.now()}`;
  }

  const response = await fetch(requestUrl, requestOptions);
  const rawBody = await response.text();
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch (_error) {
      data = { error: response.status === 413 ? getMaintenanceImageSizeMessage() : "" };
    }
  }

  if (!response.ok) {
    console.error("[API ERROR]", method, requestUrl, response.status, data);
    const message = Array.isArray(data?.errors)
      ? data.errors.join(", ")
      : data?.message || data?.error || (response.status === 413 ? getMaintenanceImageSizeMessage() : `Error ${response.status}`) || "Ocurrio un error";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function buildPlaceDeleteErrorHtml(error) {
  const data = error?.data || {};
  const message =
    data.message ||
    error?.message ||
    "No se pudo eliminar este lugar. Intentalo nuevamente.";
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles.filter(Boolean) : [];
  const vehicleList = vehicles.length
    ? `<ul>${vehicles.map((vehicle) => `<li>${escapeHtml(vehicle)}</li>`).join("")}</ul><p>Primero elimina o edita esos mantenimientos y luego intentalo nuevamente.</p>`
    : "";

  return `<p>${escapeHtml(message)}</p>${vehicleList}`;
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
  return currentVehicles.find((item) => Number(item.id) === Number(selectedVehicleId)) || null;
}

function formatKmValue(value) {
  return formatDistance(value);
}

function normalizeReminderNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatReminderDate(value) {
  if (!value) return "sin fecha aun";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildVehicleReminderSummary(reminder, vehicle) {
  if (!reminder) {
    return {
      dateText: "Proximo mantenimiento estimado: sin fecha aun.",
      kmText: "Faltan aproximadamente km por calcular.",
      noteText: "Completa los intervalos del vehiculo para empezar a calcular avisos.",
    };
  }

  const nextDateText = reminder.nextDate
    ? `Proximo mantenimiento estimado: ${formatReminderDate(reminder.nextDate)}.`
    : "Proximo mantenimiento estimado: sin fecha aun.";

  let kmText = "Faltan aproximadamente km por calcular.";
  if (reminder.kmRemaining !== null && reminder.kmRemaining !== undefined) {
    kmText = `Faltan aproximadamente ${Number(reminder.kmRemaining).toLocaleString("es-AR")} km.`;
  } else if (reminder.nextKm !== null && reminder.nextKm !== undefined) {
    kmText = `Proximo mantenimiento estimado cerca de ${Number(reminder.nextKm).toLocaleString("es-AR")} km.`;
  }

  let noteText = reminder.message || "Completa los datos base del vehiculo para mejorar los avisos.";

  if (vehicle?.intervalo_km && (vehicle?.km_actual === null || vehicle?.km_actual === undefined)) {
    noteText = "Para calcular recordatorios por km, actualiza el kilometraje actual.";
  } else if (vehicle?.intervalo_tiempo && !vehicle?.fecha_ultimo_service) {
    noteText = "Para calcular recordatorios por tiempo, carga la fecha del ultimo service.";
  }

  return {
    dateText: nextDateText,
    kmText,
    noteText,
  };
}

function fillVehicleRemindersForm(vehicle) {
  if (!vehicleRemindersForm || !vehicle) return;

  vehicleRemindersForm.elements.vehicle_reminders_enabled.checked = vehicle.vehicle_reminders_enabled !== false;
  vehicleRemindersForm.elements.intervalo_tiempo.value = vehicle.intervalo_tiempo ?? "";
  vehicleRemindersForm.elements.notify_days_before.value = normalizeReminderNumber(
    vehicle.notify_days_before,
    DEFAULT_NOTIFY_DAYS_BEFORE
  );
  vehicleRemindersForm.elements.intervalo_km.value = vehicle.intervalo_km ?? "";
  vehicleRemindersForm.elements.notify_km_before.value = normalizeReminderNumber(
    vehicle.notify_km_before,
    DEFAULT_NOTIFY_KM_BEFORE
  );
  vehicleRemindersForm.elements.km_update_reminder_days.value = normalizeReminderNumber(
    vehicle.km_update_reminder_days,
    DEFAULT_KM_UPDATE_REMINDER_DAYS
  );
}

function renderVehicleRemindersSummary(reminder, vehicle) {
  const summary = buildVehicleReminderSummary(reminder, vehicle);
  if (vehicleRemindersSummaryDate) vehicleRemindersSummaryDate.textContent = summary.dateText;
  if (vehicleRemindersSummaryKm) vehicleRemindersSummaryKm.textContent = summary.kmText;
  if (vehicleRemindersSummaryNote) vehicleRemindersSummaryNote.textContent = summary.noteText;
}

async function loadVehicleReminderSummary(vehicleId) {
  const session = getSession();
  if (!session?.id || !vehicleId) {
    return null;
  }

  const data = await fetchJson(`/dashboard/overview?user_id=${session.id}&vehiculo_id=${vehicleId}`);
  return data.selectedReminder || null;
}

async function openVehicleRemindersModal(id = selectedVehicleId) {
  const vehicle = currentVehicles.find((item) => Number(item.id) === Number(id));
  if (!vehicle || !vehicleRemindersForm) {
    return;
  }

  if (typeof closeUiModal === "function") {
    const uiModalElement = document.getElementById("ui-modal");
    if (uiModalElement && !uiModalElement.classList.contains("hidden")) {
      closeUiModal(false);
    }
  }

  editingVehicleReminderId = Number(vehicle.id);
  fillVehicleRemindersForm(vehicle);
  if (vehicleRemindersTitle) vehicleRemindersTitle.textContent = `Recordatorios de ${vehicle.nombre || "vehiculo"}`;
  if (vehicleRemindersSubtitle) {
    vehicleRemindersSubtitle.textContent = `${vehicle.modelo || "Tu vehiculo"}${vehicle.patente ? ` · ${vehicle.patente}` : ""}`;
  }
  if (vehicleRemindersMessage) vehicleRemindersMessage.textContent = "";
  renderVehicleRemindersSummary(null, vehicle);
  openModal("vehicle-reminders-modal");

  try {
    const reminder = await loadVehicleReminderSummary(vehicle.id);
    renderVehicleRemindersSummary(reminder, vehicle);
  } catch (error) {
    if (vehicleRemindersSummaryNote) {
      vehicleRemindersSummaryNote.textContent = error.message;
    }
  }
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
  openUiModal({
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
    onConfirm: async () => saveKmUpdateFromModal(vehicle),
  });

  setTimeout(() => {
    const input = document.getElementById("km-update-input");
    attachNumericSanitizer(input, NUMERIC_FIELD_CONFIG.km_actual);
    input?.focus();
    input?.select();
  }, 0);
}

async function saveKmUpdateFromModal(vehicle) {
  const input = document.getElementById("km-update-input");
  const feedback = document.getElementById("km-update-feedback");
  const rawValue = String(input?.value || "").trim();
  const errorMessage = getNumericFieldError(rawValue, NUMERIC_FIELD_CONFIG.km_actual);

  if (errorMessage) {
    if (feedback) feedback.textContent = errorMessage;
    return false;
  }

  const nextKm = Number(rawValue);

  if (!rawValue) {
    if (feedback) feedback.textContent = "Ingresa un kilometraje valido mayor o igual a 0.";
    return false;
  }

  if (vehicle.km_actual !== null && vehicle.km_actual !== undefined && nextKm < Number(vehicle.km_actual)) {
    if (feedback) feedback.textContent = "No puedes bajar el kilometraje actual.";
    return false;
  }

  const session = getSession();

  try {
    showAppLoading("Actualizando kilometraje...");
    if (feedback) feedback.textContent = "";
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
    syncSelectedVehicleContext();
    if (typeof loadDashboardOverview === "function") {
      await loadDashboardOverview();
    }
    setStatus("KM actualizado");
    showToast("Kilometraje actualizado correctamente", { tone: "success" });
    return true;
  } catch (error) {
    if (feedback) feedback.textContent = error.message || "No se pudo actualizar el kilometraje.";
    showToast(error.message || "No se pudo actualizar el kilometraje", { tone: "error" });
    return false;
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
      body: buildEmptyStateMarkup({
        icon: "history",
        title: "Todavia no hay una consulta",
        body: "Aplica filtros para buscar mantenimientos del vehiculo seleccionado.",
      }),
    },
    loading: {
      pill: "Cargando",
      copy: "Cargando historial...",
      body: buildEmptyStateMarkup({
        icon: "history",
        title: "Cargando historial",
        body: "Estamos buscando los mantenimientos que coinciden con tu consulta.",
      }),
    },
    empty: {
      pill: "Sin resultados",
      copy: "No se encontraron registros",
      body: buildEmptyStateMarkup({
        icon: "history",
        title: "Sin resultados",
        body: "No encontramos mantenimientos con esos filtros. Prueba otro texto o rango de fechas.",
      }),
    },
    error: {
      pill: "Error",
      copy: detail || "Ocurrio un error",
      body: buildEmptyStateMarkup({
        icon: "history",
        title: "No se pudo cargar el historial",
        body: detail || "Ocurrio un error",
      }),
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
      body: buildEmptyStateMarkup({
        icon: "maintenance",
        title: "Todavia no se consultaron registros",
        body: "Abre este modulo para traer los ultimos mantenimientos del vehiculo actual.",
      }),
    },
    loading: {
      pill: "Cargando",
      body: buildEmptyStateMarkup({
        icon: "maintenance",
        title: "Cargando ultimos registros",
        body: "Estamos trayendo los mantenimientos mas recientes del vehiculo seleccionado.",
      }),
    },
    empty: {
      pill: "Sin resultados",
      body: buildEmptyStateMarkup({
        icon: "maintenance",
        title: "No hay mantenimientos todavia",
        body: "Crea tu primer mantenimiento para empezar a ver este resumen.",
        actionLabel: "Cargar mantenimiento",
        action: "openMaintenanceComposer()",
      }),
    },
    error: {
      pill: "Error",
      body: buildEmptyStateMarkup({
        icon: "maintenance",
        title: "No se pudieron cargar los registros",
        body: detail || "Ocurrio un error",
      }),
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

function buildItemActionButton({ action, icon, label, variant = "default" }) {
  return `
    <button
      type="button"
      class="icon-button"
      data-variant="${variant}"
      onclick="${action}"
      aria-label="${label}"
      title="${label}"
    >
      ${buildIconMarkup(icon)}
    </button>
  `;
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

function cacheMaintenanceItems(items = []) {
  items.forEach((item) => {
    if (!item?.id) return;
    currentMaintenanceRecords.set(Number(item.id), {
      ...currentMaintenanceRecords.get(Number(item.id)),
      ...item,
      image_source: getMaintenanceImageSource(item),
    });
  });
}

function removeCachedMaintenance(id) {
  currentMaintenanceRecords.delete(Number(id));
  delete maintenanceImageRefs[id];
  saveMaintenanceImageRefs();
}

function getMaintenanceImageSource(item) {
  return item?.image_source || maintenanceImageRefs[item?.id] || "";
}

function getMaintenanceRecord(id) {
  return currentMaintenanceRecords.get(Number(id)) || null;
}

function formatMaintenanceDate(value) {
  if (!value) return "Sin fecha";

  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMaintenanceListKm(value) {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Sin dato";
  }

  return numericValue.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function buildMaintenanceDetailMarkup(item) {
  const session = normalizeSessionUser(getSession() || {});
  const imageSource = getMaintenanceImageSource(item);
  const userLabel = buildFullName(session) || session.email || "Sin dato";
  const observations = item.observaciones || item.observacion || "Sin observaciones";

  return `
    <div class="maintenance-detail-grid">
      <div class="maintenance-detail-item"><strong>Tipo</strong><span>${item.accion || "Sin dato"}</span></div>
      <div class="maintenance-detail-item"><strong>Fecha</strong><span>${formatMaintenanceDate(item.fecha)}</span></div>
      <div class="maintenance-detail-item"><strong>Kilometraje</strong><span>${formatDistance(item.km)}</span></div>
      <div class="maintenance-detail-item"><strong>Costo</strong><span>${formatCurrency(item.cost)}</span></div>
      <div class="maintenance-detail-item"><strong>Vehiculo</strong><span>${item.vehiculo || "Sin dato"}${item.modelo ? ` - ${item.modelo}` : ""}</span></div>
      <div class="maintenance-detail-item"><strong>Patente</strong><span>${item.patente || "Sin dato"}</span></div>
      <div class="maintenance-detail-item"><strong>Taller / lugar</strong><span>${item.lugar || "Sin dato"}</span></div>
      <div class="maintenance-detail-item"><strong>Usuario</strong><span>${userLabel}</span></div>
      <div class="maintenance-detail-item"><strong>Descripcion</strong><span>${item.accion || "Sin dato"}</span></div>
      <div class="maintenance-detail-item"><strong>Observaciones</strong><span>${observations}</span></div>
    </div>
    <div class="maintenance-detail-media">
      ${
        imageSource
          ? `
            <button type="button" class="maintenance-image-button" onclick="openMaintenanceImageLightboxById(${Number(item.id)})">
              <img src="${imageSource}" alt="Imagen del mantenimiento ${item.accion || ""}" />
            </button>
            <p class="maintenance-image-caption">Toca la imagen para ampliarla.</p>
          `
          : '<div class="empty">Sin imagen adjunta</div>'
      }
    </div>
    <div class="maintenance-detail-actions-footer">
      <button class="ghost maintenance-card-button" type="button" onclick="editMaintenance(${Number(item.id)})">Editar</button>
      <button class="ghost maintenance-card-button danger" type="button" onclick="deleteMaintenance(${Number(item.id)})">Eliminar</button>
    </div>
  `;
}

function openMaintenanceDetail(id) {
  const item = getMaintenanceRecord(id);
  if (!item || !maintenanceDetailModal || !maintenanceDetailBody) return;

  maintenanceDetailTitle.textContent = item.accion || "Detalle de mantenimiento";
  maintenanceDetailBody.innerHTML = buildMaintenanceDetailMarkup(item);
  openModal("maintenance-detail-modal");
}

function closeMaintenanceDetail() {
  closeModal("maintenance-detail-modal");
  if (maintenanceDetailBody) {
    maintenanceDetailBody.innerHTML = "";
  }
}

function openMaintenanceImageLightboxById(id) {
  const item = getMaintenanceRecord(id);
  const imageSource = getMaintenanceImageSource(item);
  if (!imageSource || !maintenanceImageLightboxImg) return;

  maintenanceImageLightboxImg.src = imageSource;
  openModal("maintenance-image-lightbox");
}

function closeMaintenanceImageLightbox() {
  if (maintenanceImageLightboxImg) {
    maintenanceImageLightboxImg.removeAttribute("src");
  }
  closeModal("maintenance-image-lightbox");
}

function editMaintenance(id) {
  const item = getMaintenanceRecord(id);
  if (!item || !maintenanceForm) return;

  editingMaintenanceId = Number(id);
  maintenanceForm.elements.fecha.value = item.fecha ? String(item.fecha).slice(0, 10) : "";
  maintenanceForm.elements.lugar_id.value = item.lugar_id ? String(item.lugar_id) : "";
  maintenanceForm.elements.accion.value = item.accion || "";
  maintenanceForm.elements.km.value = item.km ?? "";
  maintenanceForm.elements.cost.value = item.cost ?? "";
  clearMaintenanceImagePreview();
  closeMaintenanceDetail();
  if (maintenanceSubmitButton) {
    maintenanceSubmitButton.textContent = "Guardar cambios";
  }
  if (formMessage) {
    formMessage.textContent = "Editando mantenimiento seleccionado.";
  }
  focusDashboardSection(maintenanceSection);
  maintenanceForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshMaintenanceViewsAfterMutation() {
  latestRecordsLoaded = false;

  if (selectedVehicleId) {
    try {
      await loadLatestRecords();
    } catch (error) {
      setLatestRecordsState("error", error.message);
    }
  } else {
    setLatestRecordsState("initial");
  }

  if (hasActiveFilters()) {
    try {
      await loadMaintenance();
    } catch (error) {
      setHistoryState("error", error.message);
    }
  } else {
    setHistoryState("initial");
  }

  if (typeof loadDashboardOverview === "function" && selectedVehicleId) {
    await loadDashboardOverview();
  }
}

function renderMaintenanceCards(items, container) {
  cacheMaintenanceItems(items);
  if (!container) return;

  if (items.length === 0) {
    return;
  }

  container.innerHTML = items
    .map(
      (item) => {
        const placeMarkup = item.lugar ? `<span>Taller: ${item.lugar}</span>` : "";

        return `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${item.accion}</h3>
            </div>
            <strong>${formatCurrency(item.cost)}</strong>
          </div>
          <div class="card-meta">
            <span>Fecha: ${formatMaintenanceDate(item.fecha)}</span>
            <span>Km: ${formatMaintenanceListKm(item.km)}</span>
            ${placeMarkup}
          </div>
          <div class="maintenance-card-actions">
            <button class="ghost maintenance-card-button" type="button" onclick="openMaintenanceDetail(${Number(item.id)})">Ver detalle</button>
          </div>
        </article>
      `;
      }
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

  currentPlaces = places;

  const container = document.getElementById("places-list");

  if (places.length === 0) {
    container.innerHTML = buildEmptyStateMarkup({
      icon: "place",
      title: "No hay lugares registrados",
      body: "Agrega talleres o ubicaciones frecuentes para ahorrar tiempo al cargar mantenimientos.",
      actionLabel: "Crear lugar",
      action: "openPlacesModal()",
    });
    return;
  }

  container.innerHTML = places.map(p => `
    <div class="item-row">
      
      <div class="item-info">
        <strong>${p.nombre}</strong>
        <span>${p.ubicacion || ""}</span>
      </div>

      <div class="item-actions">
        ${buildItemActionButton({ action: `viewPlace(${p.id})`, icon: "view", label: "Ver lugar" })}
        ${buildItemActionButton({ action: `editPlace(${p.id})`, icon: "edit", label: "Editar lugar" })}
        ${buildItemActionButton({ action: `deletePlace(${p.id})`, icon: "delete", label: "Eliminar lugar", variant: "danger" })}
      </div>

    </div>
  `).join("");
}




async function loadVehiclesScreen() {
  const session = getSession();

  const vehicles = (await fetchJson(`/vehicles?user_id=${session.id}`)).map(normalizeVehicleRecord);
  currentVehicles = vehicles;

  const container = document.getElementById("vehicles-grid");

  if (vehicles.length === 0) {
    container.innerHTML = buildEmptyStateMarkup({
      icon: "vehicle",
      title: "Todavia no hay vehiculos",
      body: "Crea tu primer vehiculo para empezar a registrar kilometraje y mantenimientos.",
      actionLabel: "Crear vehiculo",
      action: "openVehicleCreateModal()",
    });
    return;
  }

  container.innerHTML = vehicles.map((v) => `
  <article class="vehicle-card card border-0 shadow-sm">
    <button class="vehicle-card-main" type="button" onclick="selectVehicle(${v.id})" aria-label="Abrir ${escapeHtml(v.nombre || "vehiculo")}">
      ${buildVehicleIdentityMarkup(v)}
    </button>
  </article>
`).join("");
}

buildVehicleIdentityMarkup = function patchedBuildVehicleIdentityMarkup(vehicle = {}) {
  const typeConfig = getVehicleTypeConfig(vehicle.vehicle_type);
  const colorConfig = getVehicleColorConfig(vehicle.vehicle_color);
  const modelLabel = vehicle.modelo ? escapeHtml(vehicle.modelo) : "";
  const plateLabel = vehicle.patente ? escapeHtml(vehicle.patente) : "Sin patente";
  const showColor = normalizeVehicleColor(vehicle.vehicle_color) !== DEFAULT_VEHICLE_COLOR;

  return `
    <div class="vehicle-card-shell" style="--vehicle-color:${colorConfig.hex}">
      <div class="vehicle-card-head">
        <div class="vehicle-card-icon" aria-hidden="true">${buildIconMarkup(typeConfig.icon)}</div>
        <div class="vehicle-card-copy">
          <strong>${escapeHtml(vehicle.nombre || "Vehiculo")}</strong>
          ${modelLabel ? `<span class="vehicle-card-model">${modelLabel}</span>` : ""}
        </div>
      </div>
      <div class="vehicle-card-meta">
        ${showColor ? `<span class="vehicle-card-color-dot" aria-label="Color ${colorConfig.label}" title="${colorConfig.label}"></span>` : ""}
        <span class="vehicle-card-plate">${plateLabel}</span>
      </div>
    </div>
  `;
};

loadVehiclesScreen = async function patchedLoadVehiclesScreen() {
  const session = getSession();

  const vehicles = (await fetchJson(`/vehicles?user_id=${session.id}`)).map(normalizeVehicleRecord);
  currentVehicles = vehicles;

  const container = document.getElementById("vehicles-grid");

  if (vehicles.length === 0) {
    container.innerHTML = buildEmptyStateMarkup({
      icon: "vehicle",
      title: "Todavia no hay vehiculos",
      body: "Crea tu primer vehiculo para empezar a registrar kilometraje y mantenimientos.",
      actionLabel: "Crear vehiculo",
      action: "openVehicleCreateModal()",
    });
    return;
  }

  container.innerHTML = vehicles.map((v) => `
    <article class="vehicle-card card border-0 shadow-sm">
      <button class="vehicle-card-main" type="button" onclick="selectVehicle(${v.id})" aria-label="Abrir ${escapeHtml(v.nombre || "vehiculo")}">
        ${buildVehicleIdentityMarkup(v)}
      </button>
    </article>
  `).join("");
};

function selectVehicle(id, origin = "selectVehicle") {
  logNavigation(origin, "dashboard", { vehicleId: id });
  selectedVehicleId = id;
  persistViewState();
  const vehicle = currentVehicles.find((v) => v.id === id);
  if (currentVehicleName) {
    const typeLabel = vehicle ? getVehicleTypeConfig(vehicle.vehicle_type).label : "Vehiculo";
    currentVehicleName.textContent = vehicle ? `${typeLabel} · ${vehicle.nombre}${vehicle.modelo ? ` - ${vehicle.modelo}` : ""}` : `ID ${id}`;
  }
  renderCurrentVehicleKm();
  updateVehicleContextTabs("dashboard");

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
  if (!vehiclesListModal) return;

  const vehicles = (await fetchJson(`/vehicles?user_id=${session.id}`)).map(normalizeVehicleRecord);

  currentVehicles = vehicles;

  const container = vehiclesListModal;

  if (vehicles.length === 0) {
    container.innerHTML = buildEmptyStateMarkup({
      icon: "vehicle",
      title: "Todavia no hay vehiculos",
      body: "Crea tu primer vehiculo y personalizalo con un tipo y color.",
      actionLabel: "Crear vehiculo",
      action: "openVehicleCreateModal()",
    });
    return;
  }

  container.innerHTML = vehicles.map((v) => `
    <div class="item-row">
      <div class="item-info item-info-vehicle">
        ${buildVehicleListSummaryMarkup(v)}
      </div>

      <div class="item-actions">
        ${buildItemActionButton({ action: `viewVehicle(${v.id})`, icon: "view", label: "Ver vehiculo" })}
        ${buildItemActionButton({ action: `openVehicleEditModal(${v.id})`, icon: "edit", label: "Editar vehiculo" })}
        ${buildItemActionButton({ action: `openVehicleDeleteModal(${v.id})`, icon: "delete", label: "Eliminar vehiculo", variant: "danger" })}
      </div>

    </div>
  `).join("");
}

function openVehicleEditor(id) {
  openVehicleEditModal(id);
}

function openVehicleConfigurationModal(id) {
  const vehicle = currentVehicles.find((item) => Number(item.id) === Number(id));
  if (!vehicle || typeof openUiModal !== "function") return;

  const typeConfig = getVehicleTypeConfig(vehicle.vehicle_type);
  const colorConfig = getVehicleColorConfig(vehicle.vehicle_color);
  const showType = normalizeVehicleType(vehicle.vehicle_type) !== DEFAULT_VEHICLE_TYPE;
  const showColor = normalizeVehicleColor(vehicle.vehicle_color) !== DEFAULT_VEHICLE_COLOR;
  const identityMeta = [showType ? typeConfig.label : "", showColor ? colorConfig.label : ""].filter(Boolean).join(" · ");

  openUiModal({
    title: "Configuracion del vehiculo",
    showConfirm: false,
    bodyHtml: `
      <div class="vehicle-settings-sheet" style="--vehicle-color:${colorConfig.hex}">
        <div class="vehicle-settings-hero">
          <div class="vehicle-settings-icon" aria-hidden="true">${buildIconMarkup(typeConfig.icon)}</div>
          <div class="vehicle-settings-copy">
            <h3>${escapeHtml(vehicle.nombre || "Vehiculo")}</h3>
            ${identityMeta ? `<p>${escapeHtml(identityMeta)}</p>` : ""}
            <span>${escapeHtml(vehicle.patente || "Sin patente")}</span>
          </div>
        </div>
        <div class="vehicle-settings-actions">
          <button class="ghost" type="button" onclick="openVehicleRemindersModal(${Number(vehicle.id)})">Recordatorios</button>
          <button class="ghost" type="button" onclick="openVehicleEditModal(${Number(vehicle.id)})">Editar vehiculo</button>
        </div>
      </div>
    `,
  });
}

function editVehicle(id) {
  openVehicleEditModal(id);
}

function viewVehicle(id) {
  const v = currentVehicles.find(v => v.id === id);
  if (!v) return;

  if (typeof openUiModal === "function") {
    openUiModal({
      title: "Detalle del vehiculo",
      bodyHtml: `<div class="vehicle-detail-grid"><div><strong>Nombre:</strong> ${v.nombre}</div><div><strong>Modelo:</strong> ${v.modelo}</div><div><strong>Patente:</strong> ${v.patente}</div><div><strong>Tipo:</strong> ${getVehicleTypeConfig(v.vehicle_type).label}</div><div><strong>Color:</strong> ${getVehicleColorConfig(v.vehicle_color).label}</div></div>`,
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
    historyCopy.textContent = "Resultados segun los filtros aplicados al vehiculo seleccionado.";
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

function normalizeOptionalPositiveInteger(rawValue, label, fallback = null) {
  const normalized = String(rawValue ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} debe contener solo numeros enteros.`);
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser un entero positivo.`);
  }

  return parsed;
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

  if (file.size > MAX_MAINTENANCE_IMAGE_FILE_BYTES) {
    return {
      ok: false,
      message: getMaintenanceImageSizeMessage(),
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
menuHomeButton?.addEventListener("click", () => goBackToVehicles("menuHome"));
menuLogoutButton?.addEventListener("click", logout);
settingsLogoutButton?.addEventListener("click", logout);
menuProfileButton?.addEventListener("click", openProfileModal);
menuSettingsButton?.addEventListener("click", openSettingsModal);
menuActivityButton?.addEventListener("click", openActivityModal);
menuCurrentDashboardButton?.addEventListener("click", openCurrentVehicleDashboard);
menuCurrentMaintenanceButton?.addEventListener("click", openCurrentVehicleMaintenance);
menuCurrentPlacesButton?.addEventListener("click", openCurrentVehiclePlaces);
menuCurrentRemindersButton?.addEventListener("click", openCurrentVehicleReminders);
menuCurrentActivityButton?.addEventListener("click", openCurrentVehicleActivity);
menuCurrentEditButton?.addEventListener("click", () => {
  const vehicle = getSelectedVehicle();
  if (vehicle) {
    openVehicleEditModal(vehicle.id);
  }
});
menuCurrentDeleteButton?.addEventListener("click", () => {
  const vehicle = getSelectedVehicle();
  if (vehicle) {
    openVehicleDeleteModal(vehicle.id);
  }
});
menuCurrentSettingsButton?.addEventListener("click", openCurrentVehicleSettings);
vehicleNavDashboardButton?.addEventListener("click", openCurrentVehicleDashboard);
vehicleNavMaintenanceButton?.addEventListener("click", openCurrentVehicleMaintenance);
vehicleNavPlacesButton?.addEventListener("click", openCurrentVehiclePlaces);
vehicleNavActivityButton?.addEventListener("click", openCurrentVehicleActivity);
vehicleNavSettingsButton?.addEventListener("click", openCurrentVehicleSettings);
vehicleTypeOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-vehicle-type-option]");
  if (!button || !vehicleTypeInput) return;
  vehicleTypeInput.value = button.getAttribute("data-vehicle-type-option") || DEFAULT_VEHICLE_TYPE;
  syncVehicleVisualSelectors();
});
vehicleColorOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-vehicle-color-option]");
  if (!button || !vehicleColorInput) return;
  vehicleColorInput.value = button.getAttribute("data-vehicle-color-option") || DEFAULT_VEHICLE_COLOR;
  syncVehicleVisualSelectors();
});

vehicleWizardBackButton?.addEventListener("click", () => {
  goToVehicleWizardStep(currentVehicleWizardStep - 1);
});

vehicleWizardNextButton?.addEventListener("click", () => {
  goToVehicleWizardStep(currentVehicleWizardStep + 1);
});

vehicleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = getSession();
  const data = Object.fromEntries(new FormData(vehicleForm).entries());
  const isEditing = Boolean(editingVehicleId);

  if (vehicleFormMessage) {
    vehicleFormMessage.textContent = isEditing ? "Guardando cambios del vehiculo..." : "Creando vehiculo...";
  }

  try {
    data.vehicle_type = normalizeVehicleType(data.vehicle_type);
    data.vehicle_color = normalizeVehicleColor(data.vehicle_color);
    data.km_actual = normalizeNumericPayloadValue(data.km_actual, NUMERIC_FIELD_CONFIG.km_actual);
    data.ultimo_service_km = normalizeNumericPayloadValue(data.ultimo_service_km, NUMERIC_FIELD_CONFIG.ultimo_service_km);
    data.intervalo_km = normalizeNumericPayloadValue(data.intervalo_km, NUMERIC_FIELD_CONFIG.intervalo_km);
    showAppLoading(isEditing ? "Actualizando vehiculo..." : "Guardando vehiculo...");
    setButtonLoading(vehicleSaveButton, true, isEditing ? "Guardando..." : "Creando...");

    if (isEditing) {
      await fetchJson(`/vehicles/${editingVehicleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });
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

    await refreshAllData();
    await loadVehiclesScreen();
    resetVehicleFormState();
    closeModal("vehicles-modal");
    setStatus(isEditing ? "Vehiculo actualizado" : "Vehiculo creado");
    showToast(isEditing ? "Vehiculo actualizado correctamente" : "Vehiculo creado correctamente", { tone: "success" });
  } catch (err) {
    console.error(err);
    if (vehicleFormMessage) {
      vehicleFormMessage.textContent = err.message || "No se pudo guardar el vehiculo.";
    }
  } finally {
    setButtonLoading(vehicleSaveButton, false, isEditing ? "Guardando..." : "Creando...");
    hideAppLoading();
  }
});


placeForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = getSession();
  const data = Object.fromEntries(new FormData(placeForm).entries());
  const isEditing = Boolean(editingPlaceId);

  if (placeFormMessage) {
    placeFormMessage.textContent = isEditing ? "Guardando cambios del lugar..." : "Creando lugar...";
  }

  try {
    showAppLoading(isEditing ? "Actualizando lugar..." : "Guardando lugar...");
    setButtonLoading(placeSaveButton, true, isEditing ? "Guardando..." : "Creando...");

    if (isEditing) {
      await fetchJson(`/places/${editingPlaceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          user_id: session.id,
        }),
      });
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

    await refreshAllData();
    resetPlaceFormState();
    closeModal("places-modal");
    setStatus(isEditing ? "Lugar actualizado" : "Lugar creado");
    showToast(isEditing ? "Lugar actualizado correctamente" : "Lugar creado correctamente", { tone: "success" });
  } catch (err) {
    console.error(err);
    if (placeFormMessage) {
      placeFormMessage.textContent = err.message || "No se pudo guardar el lugar.";
    }
  } finally {
    setButtonLoading(placeSaveButton, false, isEditing ? "Guardando..." : "Creando...");
    hideAppLoading();
  }
});

maintenanceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedVehicleId) {
    formMessage.textContent = "Primero selecciona un vehiculo.";
    return;
  }

  const isEditingMaintenance = Boolean(editingMaintenanceId);
  formMessage.textContent = isEditingMaintenance ? "Guardando cambios del mantenimiento..." : "Guardando mantenimiento...";
  setButtonLoading(maintenanceSubmitButton, true, isEditingMaintenance ? "Guardando..." : "Guardando...");

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
    const preparedImage = await prepareMaintenanceImageData(selectedImage);
    const imageRef = preparedImage.dataUrl;
    const session = getSession();

    const requestBody = JSON.stringify({
      ...payload,
      user_id: session.id,
      image_base64: imageRef || "",
      image_mime_type: preparedImage.mimeType,
    });

    const savedMaintenance = await fetchJson(isEditingMaintenance ? `/maintenance/${editingMaintenanceId}` : `/maintenance`, {
      method: isEditingMaintenance ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!isEditingMaintenance && savedMaintenance?.id && savedMaintenance.image?.imageSource) {
      maintenanceImageRefs[savedMaintenance.id] = savedMaintenance.image.imageSource;
      saveMaintenanceImageRefs();
    }

    resetMaintenanceFormState();
    await refreshAllData();
    await loadLatestRecords();
    if (hasActiveFilters()) {
      await loadMaintenance();
    }
    formMessage.textContent = isEditingMaintenance
      ? "Mantenimiento actualizado correctamente."
      : imageRef
        ? "Mantenimiento e imagen guardados correctamente."
        : "Mantenimiento guardado correctamente.";
    setStatus(isEditingMaintenance ? "Mantenimiento actualizado" : "Mantenimiento guardado");
    showToast(
      isEditingMaintenance
        ? "Mantenimiento actualizado"
        : imageRef
          ? "Mantenimiento e imagen guardados"
          : "Mantenimiento guardado",
      { tone: "success" }
    );
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    setButtonLoading(maintenanceSubmitButton, false, isEditingMaintenance ? "Guardando..." : "Guardando...");
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


async function deleteMaintenance(id) {
  const session = getSession();
  const confirmed = typeof openUiModal === "function"
    ? await openUiModal({
        title: "Eliminar este mantenimiento?",
        bodyHtml: "<p>Esta accion no se puede deshacer.</p>",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
        showCancel: true,
        destructive: true,
      })
    : true;

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando mantenimiento...");

    await fetchJson(`/maintenance/${id}?user_id=${session.id}`, {
      method: "DELETE",
    });

    if (editingMaintenanceId === Number(id)) {
      resetMaintenanceFormState();
    }
    removeCachedMaintenance(id);
    closeMaintenanceDetail();
    closeMaintenanceImageLightbox();
    await refreshMaintenanceViewsAfterMutation();
    setStatus("Mantenimiento eliminado");
    showToast("Mantenimiento eliminado correctamente", { tone: "success" });
  } catch (error) {
    if (typeof openUiModal === "function") {
      await openUiModal({
        title: "No se pudo eliminar",
        bodyHtml: `<p>${error.message}</p>`,
      });
    }
    throw error;
  } finally {
    hideAppLoading();
  }
}

function setVehicleDeleteModalError(message) {
  const errorNode = document.getElementById("vehicle-delete-modal-error");
  if (errorNode) {
    errorNode.textContent = message || "";
  }
}

function setVehicleDeleteModalStatus(message) {
  const statusNode = document.getElementById("vehicle-delete-modal-status");
  if (statusNode) {
    statusNode.textContent = message || "";
  }
}

function syncVehicleDeleteConfirmation() {
  const input = document.getElementById("vehicle-delete-confirm-input");
  const confirmButton = document.getElementById("ui-modal-confirm");
  if (!input || !confirmButton) return;

  confirmButton.disabled = input.value.trim() !== "ELIMINAR";
}

function buildCsvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function exportMaintenanceToCsv({ vehicleId = selectedVehicleId } = {}) {
  const session = getSession();
  const effectiveVehicleId = Number(vehicleId);
  const vehicle = currentVehicles.find((item) => Number(item.id) === effectiveVehicleId) || getSelectedVehicle();

  if (!session?.id || !vehicle || !effectiveVehicleId) {
    return false;
  }

  const items = await fetchJson(`/maintenance?user_id=${session.id}&vehiculo_id=${effectiveVehicleId}`);
  const sortedItems = [...items].sort((a, b) => {
    const dateDiff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    if (dateDiff !== 0) return dateDiff;
    return Number(a.id) - Number(b.id);
  });
  const headers = ["fecha", "accion_mantenimiento", "km", "costo", "lugar_taller", "observaciones", "patente", "vehiculo"];
  const rows = sortedItems.map((item) => [
    item.fecha ? String(item.fecha).slice(0, 10) : "",
    item.accion || "",
    item.km ?? "",
    item.cost ?? "",
    item.lugar || "",
    item.observaciones || item.observacion || "",
    item.patente || vehicle.patente || "",
    `${item.vehiculo || vehicle.nombre || ""}${item.modelo || vehicle.modelo ? ` - ${item.modelo || vehicle.modelo}` : ""}`,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(buildCsvValue).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFileName(vehicle.nombre)}-historial.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setStatus("CSV exportado");
  return true;
}

async function exportVehicleMaintenanceBeforeDelete(id) {
  const button = document.getElementById("vehicle-delete-export-button");
  setVehicleDeleteModalError("");
  setVehicleDeleteModalStatus("Preparando respaldo...");

  const exported = await exportMaintenanceToPdf({
    vehicleId: id,
    triggerButton: button,
    showModalErrors: false,
  });

  if (exported) {
    setVehicleDeleteModalStatus("Respaldo PDF descargado. Podés cancelar o continuar con la eliminación.");
    return;
  }

  try {
    setButtonLoading(button, true, "Exportando CSV...");
    const csvExported = await exportMaintenanceToCsv({ vehicleId: id });
    if (csvExported) {
      setVehicleDeleteModalStatus("No se pudo generar PDF, se descargó un respaldo CSV.");
      return;
    }
    setVehicleDeleteModalError("No se pudo exportar el historial. Revisa tu conexion e intentalo de nuevo.");
    setVehicleDeleteModalStatus("");
  } catch (error) {
    console.error(error);
    setVehicleDeleteModalError(error.message || "No se pudo exportar el historial. Revisa tu conexion e intentalo de nuevo.");
    setVehicleDeleteModalStatus("");
  } finally {
    setButtonLoading(button, false, "Exportando CSV...");
  }
}

async function deleteVehicle(id) {
  const session = getSession();
  const shouldLeaveDashboard = Number(selectedVehicleId) === Number(id);

  if (!session?.id) {
    throw new Error("No hay una sesion activa.");
  }

  showAppLoading("Eliminando vehiculo...");

  await fetchJson(`/vehicles/${id}?user_id=${session.id}`, {
    method: "DELETE",
  });

  if (editingVehicleId === Number(id)) {
    resetVehicleFormState();
    closeModal("vehicles-modal");
  }

  if (shouldLeaveDashboard) {
    selectedVehicleId = null;
    persistViewState();
    resetMaintenanceFormState();
    if (currentVehicleKm) currentVehicleKm.textContent = "Sin dato";
    if (updateKmButton) updateKmButton.disabled = true;
    setView("vehicles", "deleteVehicle");
  }

  await refreshAllData();
  await loadVehiclesScreen();
  showToast("Vehículo eliminado", { tone: "success" });
}

async function openVehicleDeleteModal(id) {
  const vehicle = currentVehicles.find((item) => Number(item.id) === Number(id));
  if (!vehicle) return;

  closeMenu();

  if (typeof openUiModal !== "function") {
    setStatus("No se pudo abrir la confirmación de eliminación.");
    showToast("No se pudo abrir la confirmación de eliminación", { tone: "error" });
    return;
  }

  await openUiModal({
    title: "Eliminar vehículo",
    bodyHtml: `
      <div class="vehicle-delete-warning">
        <section class="vehicle-delete-section vehicle-delete-alert">
          <p><strong>Vas a eliminar este vehículo y toda su información asociada:</strong></p>
          <ul>
            <li>Mantenimientos.</li>
            <li>Imágenes.</li>
            <li>Historial.</li>
            <li>Recordatorios.</li>
          </ul>
          <p>Esta acción no se puede deshacer.</p>
        </section>
        <section class="vehicle-delete-section vehicle-delete-summary">
          <span>Vehículo</span>
          <strong>${escapeHtml(vehicle.nombre || "Vehículo")}</strong>
          <p>${escapeHtml(vehicle.modelo || "Sin modelo")} · ${escapeHtml(vehicle.patente || "Sin patente")}</p>
        </section>
        <section class="vehicle-delete-section vehicle-delete-backup">
          <button id="vehicle-delete-export-button" class="vehicle-delete-export-button" type="button" onclick="exportVehicleMaintenanceBeforeDelete(${Number(id)})">Descargar respaldo antes de eliminar</button>
          <p>Podés exportar los mantenimientos antes de continuar. No es obligatorio, pero es recomendado.</p>
          <p id="vehicle-delete-modal-status" class="vehicle-delete-status" role="status"></p>
        </section>
        <section class="vehicle-delete-section vehicle-delete-confirmation">
          <label for="vehicle-delete-confirm-input">Para habilitar la eliminación, escribí <strong>ELIMINAR</strong></label>
          <input id="vehicle-delete-confirm-input" type="text" autocomplete="off" inputmode="text" placeholder="ELIMINAR" oninput="syncVehicleDeleteConfirmation()" />
        </section>
        <p id="vehicle-delete-modal-error" class="vehicle-delete-error" role="alert"></p>
      </div>
    `,
    confirmLabel: "Eliminar definitivamente",
    cancelLabel: "Cancelar",
    showCancel: true,
    destructive: true,
    confirmDisabled: true,
    onConfirm: async () => {
      setVehicleDeleteModalError("");
      if (document.getElementById("vehicle-delete-confirm-input")?.value.trim() !== "ELIMINAR") {
        setVehicleDeleteModalError("Escribí ELIMINAR para confirmar la eliminación.");
        syncVehicleDeleteConfirmation();
        return false;
      }
      try {
        await deleteVehicle(id);
        return true;
      } catch (error) {
        console.error(error);
        setVehicleDeleteModalError(error.message || "No se pudo eliminar el vehículo. Intentalo de nuevo.");
        return false;
      } finally {
        hideAppLoading();
      }
    },
  });
}

function syncModalBodyState() {
  const hasVisibleModal = Array.from(document.querySelectorAll(".modal")).some((modal) => !modal.classList.contains("hidden"));
  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  syncModalBodyState();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  syncModalBodyState();
}

maintenanceDetailClose?.addEventListener("click", closeMaintenanceDetail);
maintenanceImageLightboxClose?.addEventListener("click", closeMaintenanceImageLightbox);
themeMenuButton?.addEventListener("click", toggleTheme);
notificationsToggleButton?.addEventListener("click", () => {
  handleNotificationToggle().then(() => {
    showToast("Estado de notificaciones actualizado", { tone: "info" });
  }).catch((error) => {
    setNotificationStatus(error.message, "error");
    showToast(error.message, { tone: "error", duration: 3400 });
  });
});
notificationsTestButton?.addEventListener("click", () => {
  sendPushTestNotification().then(() => {
    showToast("Notificacion de prueba enviada", { tone: "success" });
  }).catch((error) => {
    setNotificationStatus(error.message, "error");
    showToast(error.message, { tone: "error", duration: 3400 });
  });
});
pwaInstallDismiss?.addEventListener("click", dismissPwaInstallBanner);

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

  document.querySelector("#place-form [name=nombre]").value = place.nombre || "";
  document.querySelector("#place-form [name=ubicacion]").value = place.ubicacion || "";
  document.querySelector("#place-form [name=contacto_nombre]").value = place.contacto_nombre || "";
  document.querySelector("#place-form [name=contacto_numero]").value = place.contacto_numero || "";

  editingPlaceId = id;

  if (placeSaveButton) {
    placeSaveButton.textContent = "Guardar";
  }
  if (placeFormMessage) {
    placeFormMessage.textContent = "Editando lugar seleccionado.";
  }
  openModal("places-modal");
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
    showToast("Lugar eliminado correctamente", { tone: "success" });

  } catch (err) {
    console.error(err);
    if (typeof openUiModal === "function") {
      await openUiModal({
        title: err.status === 409 ? "Lugar en uso" : "No se pudo eliminar",
        bodyHtml: buildPlaceDeleteErrorHtml(err),
      });
    } else {
      showToast(err.message || "No se pudo eliminar el lugar", { tone: "error", duration: 4200 });
    }
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
  await loadSelects();          // ðŸ‘ˆ dropdowns
  await loadVehiclesList();     // ðŸ‘ˆ modal
  await loadPlacesList();       // ðŸ‘ˆ modal
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
  section.classList.toggle("open");

  if (willOpen && options.loadOnOpen === "latest" && !latestRecordsLoaded) {
    loadLatestRecords().catch((error) => {
      setLatestRecordsState("error", error.message);
    });
  }
}

function openVehiclesModal() {
  openVehicleCreateModal();
}

function openPlacesModal() {
  resetPlaceFormState();
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

function getMaintenanceImageSizeMessage() {
  const maxMb = Math.floor(MAX_MAINTENANCE_IMAGE_FILE_BYTES / (1024 * 1024));
  return `La imagen es demasiado grande. Proba con una imagen menor a ${maxMb} MB.`;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada."));
    image.src = src;
  });
}

async function prepareMaintenanceImageData(file) {
  if (!file) {
    return { dataUrl: "", mimeType: "" };
  }

  const originalDataUrl = await fileToDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const largestSide = Math.max(width, height);

  if (largestSide <= MAINTENANCE_IMAGE_MAX_DIMENSION && originalDataUrl.length <= MAX_MAINTENANCE_IMAGE_DATA_URL_LENGTH) {
    return { dataUrl: originalDataUrl, mimeType: String(file.type || "").toLowerCase() };
  }

  const scale = largestSide > MAINTENANCE_IMAGE_MAX_DIMENSION ? MAINTENANCE_IMAGE_MAX_DIMENSION / largestSide : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo procesar la imagen seleccionada.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressedDataUrl = canvas.toDataURL("image/jpeg", MAINTENANCE_IMAGE_JPEG_QUALITY);

  if (compressedDataUrl.length > MAX_MAINTENANCE_IMAGE_DATA_URL_LENGTH) {
    throw new Error(getMaintenanceImageSizeMessage());
  }

  return { dataUrl: compressedDataUrl, mimeType: "image/jpeg" };
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

    const preparedImage = await prepareMaintenanceImageData(selectedImage);
    const dataUrl = preparedImage.dataUrl;
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
    await refreshNotificationControls();
    renderReminderSettingsSummary(response.user, notificationsServerStatus);
    preferencesMessage.textContent = "Preferencias actualizadas.";
    setStatus("Preferencias guardadas");
    showToast("Preferencias actualizadas", { tone: "success" });
  } catch (error) {
    preferencesMessage.textContent = error.message;
  } finally {
    setButtonLoading(preferencesSaveButton, false, "Guardando...");
  }
});

vehicleRemindersForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = getSession();

  if (!session?.id || !editingVehicleReminderId) {
    if (vehicleRemindersMessage) {
      vehicleRemindersMessage.textContent = "No hay un vehiculo seleccionado para configurar.";
    }
    return;
  }

  if (vehicleRemindersMessage) {
    vehicleRemindersMessage.textContent = "Guardando recordatorios...";
  }
  setButtonLoading(vehicleRemindersSaveButton, true, "Guardando...");

  try {
    const payload = {
      user_id: session.id,
      vehicle_reminders_enabled: vehicleRemindersForm.elements.vehicle_reminders_enabled.checked,
      intervalo_tiempo: normalizeOptionalPositiveInteger(
        vehicleRemindersForm.elements.intervalo_tiempo.value,
        "Cada cuantos meses quieres hacer mantenimiento",
        null
      ),
      notify_days_before: normalizeOptionalPositiveInteger(
        vehicleRemindersForm.elements.notify_days_before.value,
        "Cuantos dias antes quieres que te avise",
        DEFAULT_NOTIFY_DAYS_BEFORE
      ),
      intervalo_km: normalizeOptionalPositiveInteger(
        vehicleRemindersForm.elements.intervalo_km.value,
        "Cada cuantos km corresponde mantenimiento",
        null
      ),
      notify_km_before: normalizeOptionalPositiveInteger(
        vehicleRemindersForm.elements.notify_km_before.value,
        "Cuantos km antes quieres que te avise",
        DEFAULT_NOTIFY_KM_BEFORE
      ),
      km_update_reminder_days: normalizeOptionalPositiveInteger(
        vehicleRemindersForm.elements.km_update_reminder_days.value,
        "Cada cuantos dias quieres que te recuerde actualizar km",
        DEFAULT_KM_UPDATE_REMINDER_DAYS
      ),
    };

    const updatedVehicle = await fetchJson(`/vehicles/${editingVehicleReminderId}/reminders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    currentVehicles = currentVehicles.map((item) => (
      Number(item.id) === Number(updatedVehicle.id) ? { ...item, ...updatedVehicle } : item
    ));

    syncSelectedVehicleContext();
    await refreshAllData(true);

    const reminder = await loadVehicleReminderSummary(updatedVehicle.id);
    renderVehicleRemindersSummary(reminder, updatedVehicle);

    if (vehicleRemindersMessage) {
      vehicleRemindersMessage.textContent = "Recordatorios actualizados.";
    }
    setStatus("Recordatorios guardados");
    showToast("Recordatorios del vehiculo actualizados", { tone: "success" });
  } catch (error) {
    if (vehicleRemindersMessage) {
      vehicleRemindersMessage.textContent = error.message;
    }
  } finally {
    setButtonLoading(vehicleRemindersSaveButton, false, "Guardando...");
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
    showToast("Contrasena actualizada", { tone: "success" });
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

async function exportMaintenanceToPdf({
  vehicleId = selectedVehicleId,
  triggerButton = exportPdfButton,
  showModalErrors = true,
} = {}) {
  const session = getSession();
  const effectiveVehicleId = Number(vehicleId);
  const vehicle = currentVehicles.find((item) => Number(item.id) === effectiveVehicleId) || getSelectedVehicle();

  if (!session?.id || !vehicle || !effectiveVehicleId) {
    setStatus("Selecciona un vehiculo");
    return false;
  }

  if (!window.jspdf?.jsPDF) {
    if (showModalErrors) {
      await openUiModal({
        title: "PDF no disponible",
        bodyHtml: "<p>No se pudo cargar la libreria de exportacion.</p>",
      });
    }
    return false;
  }

  setButtonLoading(triggerButton, true, "Exportando...");

  try {
    const items = await fetchJson(`/maintenance?user_id=${session.id}&vehiculo_id=${effectiveVehicleId}`);
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
    return true;
  } catch (error) {
    if (showModalErrors) {
      await openUiModal({
        title: "No se pudo exportar",
        bodyHtml: `<p>${error.message}</p>`,
      });
    }
    return false;
  } finally {
    setButtonLoading(triggerButton, false, "Exportando...");
  }
}

exportPdfButton?.addEventListener("click", exportMaintenanceToPdf);
topbarTitleAction?.addEventListener("click", () => {
  refreshCurrentContext().catch(console.error);
});
topbarTitleAction?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    refreshCurrentContext().catch(console.error);
  }
});

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
  renderVehicleVisualSelectors();
  setVehicleWizardStep(1);
  setupTouchScrollTracking();
  applyTheme(getPreferredTheme());
  syncFooterYear();
  applyNotificationIntentFromUrl();
  updatePwaInstallBanner();
  window.addEventListener("resize", () => {
    updatePwaInstallBanner();
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
