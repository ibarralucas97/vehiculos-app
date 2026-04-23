let selectedVehicleId = null;
let currentPlaces = [];
let currentVehicles = [];
let editingVehicleId = null;
let editingPlaceId = null;
const SESSION_KEY = "mygarage_session";
const MAINTENANCE_IMAGES_KEY = "mygarage_maintenance_images";

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
const maintenanceSubmitButton = document.getElementById("maintenance-submit");
const vehicleSelect = document.getElementById("vehiculo_id");
const placeSelect = document.getElementById("lugar_id");
const menuButton = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");
const menuLogoutButton = document.getElementById("menu-logout");
const menuProfileButton = document.getElementById("menu-profile");
const menuSettingsButton = document.getElementById("menu-settings");
const currentVehicleName = document.getElementById("current-vehicle-name");
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

let maintenanceImageRefs = getMaintenanceImageRefs();

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (_error) {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...user,
      createdAt: new Date().toISOString(),
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
  const inVehicleDetail = !dashboard.classList.contains("hidden");
  topbarBackButton.disabled = !inVehicleDetail;
  topbarBackButton.classList.toggle("is-inactive", !inVehicleDetail);
}

function updateSessionUI() {
  const session = getSession();
  const isLoggedIn = Boolean(session?.email);

  // 👇 estado base
  dashboard.classList.add("hidden");
  welcomeScreen?.classList.toggle("hidden", isLoggedIn);
  topbar?.classList.toggle("hidden", !isLoggedIn);
  loginForm.classList.toggle("hidden", isLoggedIn);
  sessionBox.classList.toggle("hidden", !isLoggedIn);
  logoutButton.classList.add("hidden");

  if (isLoggedIn) {
    // 👇 mostrar pantalla de vehículos
    if (vehiclesScreen) {
      vehiclesScreen.classList.remove("hidden");
    }

    sessionEmail.textContent = session.fullName
      ? `${session.fullName} - ${session.email}`
      : session.email;
    if (topbarUserName) {
      topbarUserName.textContent = session.fullName || session.email;
    }

    sessionCopy.textContent = "";
    loginMessage.textContent = "";

  } else {
    // 👇 ocultar vehículos en logout
    if (vehiclesScreen) {
      vehiclesScreen.classList.add("hidden");
    }

    sessionEmail.textContent = "";
    if (topbarUserName) {
      topbarUserName.textContent = "";
    }
    sessionCopy.textContent = "Ingresa para continuar.";
  }

  updateTopbarContext();
  return isLoggedIn;
}


function goBackToVehicles() {
  selectedVehicleId = null;

  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("vehicles-screen").classList.remove("hidden");
  closeMenu();
  updateTopbarContext();

  loadVehiclesScreen(); // 👈 CLAVE
}

function closeMenu() {
  if (!menuPanel) return;
  menuPanel.classList.add("hidden");
  if (menuButton) menuButton.setAttribute("aria-expanded", "false");
}

function showNotAvailable() {
  setStatus("No disponible");
  alert("No disponible");
  closeMenu();
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

function optionMarkup(items, labelKey) {
  return items
    .map((item) => `<option value="${item.id}">${item[labelKey]}</option>`)
    .join("");
}

function renderMaintenance(items) {
  if (items.length === 0) {
    maintenanceList.innerHTML = '<div class="empty">No hay resultados para mostrar.</div>';
    return;
  }

  maintenanceList.innerHTML = items
    .map(
      (item) => `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${item.accion}</h3>
              <p>${item.vehiculo} ${item.modelo ? `- ${item.modelo}` : ""}</p>
            </div>
            <strong>$${Number(item.cost).toLocaleString("es-AR")}</strong>
          </div>
          ${
            maintenanceImageRefs[item.id]
              ? `<img class="maintenance-thumb" src="${maintenanceImageRefs[item.id]}" alt="Imagen de mantenimiento" />`
              : ""
          }
          <div class="card-meta">
            <span>Fecha: ${item.fecha.slice(0, 10)}</span>
            <span>KM: ${item.km}</span>
            <span>Taller: ${item.lugar}</span>
            <span>Patente: ${item.patente}</span>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadSelects() {
  setStatus("Cargando catalogos...");

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

function selectVehicle(id) {
  selectedVehicleId = id;
  const vehicle = currentVehicles.find((v) => v.id === id);
  if (currentVehicleName) {
    currentVehicleName.textContent = vehicle ? `${vehicle.nombre} ${vehicle.modelo ? `- ${vehicle.modelo}` : ""}` : `ID ${id}`;
  }

  document.getElementById("vehicles-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  closeMenu();
  updateTopbarContext();

  refreshAllData();
  maintenanceList.innerHTML = '<div class="empty">Usa filtros o presiona "Últimos registros" para cargar el historial.</div>';
  historyTitle.textContent = "Historial de vehículo";
  historyCopy.textContent = 'Aún no hay resultados. Usa filtros o presiona "Últimos registros".';
}


if (menuButton && menuPanel) {
  menuButton.addEventListener("click", (e) => {
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

topbarBackButton?.addEventListener("click", () => {
  if (!topbarBackButton.disabled) {
    goBackToVehicles();
  }
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

  alert(`
Nombre: ${v.nombre}
Modelo: ${v.modelo}
Patente: ${v.patente}
  `);
}



async function loadMaintenance(options = {}) {
  if (!selectedVehicleId) {
    maintenanceList.innerHTML = '<div class="empty">Primero selecciona un vehículo.</div>';
    setStatus("Selecciona un vehículo");
    return;
  }

  const { latestOnly = false } = options;
  const params = new URLSearchParams();
  const formData = new FormData(filtersForm);

  for (const [key, value] of formData.entries()) {
    const normalized = String(value).trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const usingFilters = params.toString().length > 0;

  setStatus("Cargando...");
  const session = getSession();
  params.set("user_id", session.id);
  if (selectedVehicleId) {
    params.set("vehiculo_id", String(selectedVehicleId));
  }

  if (latestOnly) {
    params.set("limit", "3");
    historyTitle.textContent = "Últimos registros";
    historyCopy.textContent = "Se muestran los últimos 3 movimientos del vehículo seleccionado.";
  } else if (usingFilters) {
    historyTitle.textContent = "Historial filtrado";
    historyCopy.textContent = "Resultados según los filtros aplicados al vehículo seleccionado.";
  } else {
    historyTitle.textContent = "Historial de vehículo";
    historyCopy.textContent = 'Aún no hay resultados. Usa filtros o presiona "Últimos registros".';
    maintenanceList.innerHTML = '<div class="empty">No hay consulta activa.</div>';
    setStatus("Listo");
    return;
  }

  const query = params.toString();
  const url = query ? `/maintenance?${query}` : "/maintenance";
  const items = await fetchJson(url);
  renderMaintenance(items);
  setStatus(`${items.length} registros`);
}

async function loadDashboardData() {
await loadSelects();
await loadVehiclesList();
await loadPlacesList();
await loadMaintenance({ latestOnly: true });
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

    saveSession(response.user);
updateSessionUI();
loginMessage.textContent = "";

// 👇 NUEVO FLUJO
await loadVehiclesList();
await loadVehiclesScreen();

document.getElementById("vehicles-screen").classList.remove("hidden");
document.getElementById("dashboard").classList.add("hidden");
  } catch (error) {
    clearSession();
    updateSessionUI();
    loginMessage.textContent = error.message;
    setStatus(error.message);
    maintenanceList.innerHTML = `<div class="empty">${error.message}</div>`;
  } finally {
    setButtonLoading(loginSubmitButton, false, "Ingresando...");
  }
});

function logout() {
  clearSession();
  selectedVehicleId = null;
  updateSessionUI();
  loginForm.reset();
  passwordInput.type = "password";
  togglePasswordButton.setAttribute("aria-pressed", "false");
  togglePasswordButton.setAttribute("aria-label", "Mostrar contrasena");
  loginMessage.textContent = "Sesion cerrada.";
  setStatus("Bloqueado");
  maintenanceList.innerHTML = '<div class="empty">Selecciona un vehículo para comenzar.</div>';
  historyTitle.textContent = "Historial de vehículo";
  historyCopy.textContent = 'Aún no hay resultados. Usa filtros o presiona "Últimos registros".';
  if (currentVehicleName) currentVehicleName.textContent = "Sin selección";
  closeMenu();
}

logoutButton?.addEventListener("click", logout);
menuLogoutButton?.addEventListener("click", logout);
menuProfileButton?.addEventListener("click", showNotAvailable);
menuSettingsButton?.addEventListener("click", showNotAvailable);

vehicleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const session = getSession();
  const data = Object.fromEntries(new FormData(vehicleForm).entries());

  try {
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
  payload.vehiculo_id = selectedVehicleId;
  payload.lugar_id = Number(payload.lugar_id);
  payload.km = Number(payload.km);
  payload.cost = Number(payload.cost);
  const imageRef = await fileToDataUrl(maintenanceImageInput?.files?.[0]);

  try {
    const session = getSession();

    const created = await fetchJson(`/maintenance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        user_id: session.id,
      }),
    });

    if (created?.id && imageRef) {
      maintenanceImageRefs[created.id] = imageRef;
      saveMaintenanceImageRefs();
    }


    maintenanceForm.reset();
    clearMaintenanceImagePreview();
    formMessage.textContent = "Mantenimiento guardado correctamente.";
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
    await loadMaintenance({ latestOnly: false });
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonLoading(filtersSubmitButton, false, "Buscando...");
  }
});

latestButton?.addEventListener("click", async () => {
  if (filtersForm) {
    filtersForm.reset();
  }
  setButtonLoading(latestButton, true, "Cargando...");
  try {
    await loadMaintenance({ latestOnly: true });
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonLoading(latestButton, false, "Cargando...");
  }
});


async function deleteVehicle(id) {
  const session = getSession();

  if (!confirm("¿Seguro que querés eliminar este vehículo?")) return;

  try {
    showAppLoading("Eliminando vehículo...");

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
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}


function viewPlace(id) {
  const place = currentPlaces.find(p => p.id === id);

  if (!place) return;

  alert(`
Nombre: ${place.nombre}
Ubicación: ${place.ubicacion}
Contacto: ${place.contacto_nombre}
Teléfono: ${place.contacto_numero}
  `);
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

  if (!confirm("¿Seguro que querés eliminar este lugar?")) return;

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
}

document.addEventListener("click", (e) => {
  const modals = document.querySelectorAll(".modal");

  modals.forEach((modal) => {
    if (!modal.classList.contains("hidden") && e.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

function toggleSection(header) {
  const section = header.closest(".collapsible");
  section.classList.toggle("open");
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
    const dataUrl = await fileToDataUrl(maintenanceImageInput.files?.[0]);
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



(async function init() {
  await playSplashScreen();

  const isLoggedIn = updateSessionUI();

  if (!isLoggedIn) {
    setStatus("Bloqueado");
    maintenanceList.innerHTML = '<div class="empty">Accede para continuar.</div>';
    return;
  }

  

  try {
    await loadVehiclesList();
    await loadVehiclesScreen();
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    maintenanceList.innerHTML = `<div class="empty">${error.message}</div>`;
  }
})();
