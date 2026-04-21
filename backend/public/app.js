let currentPlaces = [];
let currentVehicles = [];
let editingVehicleId = null;
let editingPlaceId = null;
const SESSION_KEY = "mygarage_session";

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
const reloadButton = document.getElementById("reload-button");
const filtersSubmitButton = document.getElementById("filters-submit");
const maintenanceSubmitButton = document.getElementById("maintenance-submit");
const vehicleSelect = document.getElementById("vehiculo_id");
const placeSelect = document.getElementById("lugar_id");

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

function setButtonLoading(button, isLoading) {
  if (!button) return; // 👈 salva todo

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Guardando...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
  }
}

function updateSessionUI() {
  const session = getSession();
  const isLoggedIn = Boolean(session?.email);

  dashboard.classList.toggle("hidden", !isLoggedIn);
  loginForm.classList.toggle("hidden", isLoggedIn);
  sessionBox.classList.toggle("hidden", !isLoggedIn);
  logoutButton.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    sessionEmail.textContent = session.fullName
      ? `${session.fullName} - ${session.email}`
      : session.email;
    sessionCopy.textContent = "Tu cuenta esta activa. Ya puedes trabajar en el panel.";
    loginMessage.textContent = "";
  } else {
    sessionEmail.textContent = "";
    sessionCopy.textContent = "Tu panel se desbloquea despues de iniciar sesion.";
  }

  return isLoggedIn;
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

  vehicleSelect.innerHTML = optionMarkup(vehicles, "nombre");
  placeSelect.innerHTML = optionMarkup(places, "nombre");
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
  const { latestOnly = false } = options;
  const params = new URLSearchParams();
  const formData = new FormData(filtersForm);

  for (const [key, value] of formData.entries()) {
    const normalized = String(value).trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const usingFilters = !latestOnly && params.toString().length > 0;

  if (latestOnly) {
    params.set("limit", "3");
    historyTitle.textContent = "Ultimos registros";
    historyCopy.textContent = "Se muestran los ultimos 3 movimientos. Usa filtros para ver mas.";
  } else if (usingFilters) {
    historyTitle.textContent = "Historial filtrado";
    historyCopy.textContent = "Resultados segun los filtros aplicados.";
  } else {
    params.set("limit", "3");
    historyTitle.textContent = "Ultimos registros";
    historyCopy.textContent = "Se muestran los ultimos 3 movimientos. Usa filtros para ver mas.";
  }

  setStatus("Cargando...");
  const session = getSession();
params.set("user_id", session.id);
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

togglePasswordButton.addEventListener("click", () => {
  const showingPassword = passwordInput.type === "text";
  passwordInput.type = showingPassword ? "password" : "text";
  togglePasswordButton.setAttribute("aria-pressed", String(!showingPassword));
  togglePasswordButton.setAttribute(
    "aria-label",
    showingPassword ? "Mostrar contrasena" : "Ocultar contrasena"
  );
});

loginForm.addEventListener("submit", async (event) => {
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
    loginMessage.textContent = "Acceso concedido.";
    await loadDashboardData();
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

logoutButton.addEventListener("click", () => {
  clearSession();
  updateSessionUI();
  loginForm.reset();
  passwordInput.type = "password";
  togglePasswordButton.setAttribute("aria-pressed", "false");
  togglePasswordButton.setAttribute("aria-label", "Mostrar contrasena");
  loginMessage.textContent = "Sesion cerrada.";
  setStatus("Bloqueado");
  maintenanceList.innerHTML = '<div class="empty">Inicia sesion para ver el historial.</div>';
  historyTitle.textContent = "Ultimos registros";
  historyCopy.textContent = "Se muestran los ultimos 3 movimientos. Usa filtros para ver mas.";
});

vehicleForm.addEventListener("submit", async (e) => {
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
closeModal("vehicles-modal");

  } catch (err) {
    console.error(err);
  } finally {
    hideAppLoading();
  }
});


placeForm.addEventListener("submit", async (e) => {
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

maintenanceForm.addEventListener("submit", async (event) => {
  console.log("SUBMIT mantenimiento"); // 
  event.preventDefault();
  formMessage.textContent = "Guardando mantenimiento...";
  setButtonLoading(maintenanceSubmitButton, true, "Guardando...");

  const formData = new FormData(maintenanceForm);
  const payload = Object.fromEntries(formData.entries());
  payload.vehiculo_id = Number(payload.vehiculo_id);
  payload.lugar_id = Number(payload.lugar_id);
  payload.km = Number(payload.km);
  payload.cost = Number(payload.cost);

  try {
    const session = getSession();

await fetchJson("/maintenance", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    ...payload,
    user_id: session.id
  }),
});


    maintenanceForm.reset();
    formMessage.textContent = "Mantenimiento guardado correctamente.";
    await loadSelects();
    await loadMaintenance({ latestOnly: true });
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    setButtonLoading(maintenanceSubmitButton, false, "Guardando...");
  }
});

filtersForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setButtonLoading(filtersSubmitButton, true, "Buscando...");

  try {
    if (!hasActiveFilters()) {
      await loadMaintenance({ latestOnly: true });
    } else {
      await loadMaintenance({ latestOnly: false });
    }
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonLoading(filtersSubmitButton, false, "Buscando...");
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

reloadButton.addEventListener("click", async () => {
  filtersForm.reset();
  setButtonLoading(reloadButton, true, "Cargando...");

  try {
    await loadMaintenance({ latestOnly: true });
  } finally {
    setButtonLoading(reloadButton, false, "Cargando...");
  }
});

function toggleSection(id) {
  const el = document.getElementById(id);
  el.classList.toggle("hidden");
}

const menuToggle = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");

menuToggle.addEventListener("click", () => {
  menuPanel.classList.toggle("hidden");
});

function openSection(sectionId) {
  document.getElementById("vehicles-panel").classList.add("hidden");
  document.getElementById("places-panel").classList.add("hidden");

  document.getElementById(sectionId).classList.remove("hidden");

  document.getElementById("menu-panel").classList.add("hidden");
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


(async function init() {
  const isLoggedIn = updateSessionUI();

  if (!isLoggedIn) {
    setStatus("Bloqueado");
    maintenanceList.innerHTML = '<div class="empty">Inicia sesion para ver el historial.</div>';
    return;
  }

  try {
    await loadDashboardData();
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    maintenanceList.innerHTML = `<div class="empty">${error.message}</div>`;
  }
})();
