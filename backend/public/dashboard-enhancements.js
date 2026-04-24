const overviewStatusLabel = document.getElementById("overview-status-label");
const overviewStatusCopy = document.getElementById("overview-status-copy");
const overviewMonthlyTotal = document.getElementById("overview-monthly-total");
const overviewTotalInvested = document.getElementById("overview-total-invested");
const overviewNextService = document.getElementById("overview-next-service");
const remindersList = document.getElementById("reminders-list");
const uiModal = document.getElementById("ui-modal");
const uiModalTitle = document.getElementById("ui-modal-title");
const uiModalBody = document.getElementById("ui-modal-body");
const uiModalCancel = document.getElementById("ui-modal-cancel");
const uiModalConfirm = document.getElementById("ui-modal-confirm");
const uiModalClose = document.getElementById("ui-modal-close");

const hasOverviewUi = Boolean(overviewStatusLabel && overviewStatusCopy && overviewMonthlyTotal && overviewTotalInvested && overviewNextService && remindersList);

let modalResolver = null;

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDateLabel(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusModifier(status) {
  return `is-${String(status || "sin_configurar").replace(/[^a-z_]/g, "")}`;
}

function openUiModal({ title, bodyHtml, confirmLabel = "Aceptar", cancelLabel = "Cancelar", showCancel = false, destructive = false }) {
  if (!uiModal) {
    return Promise.resolve(true);
  }

  uiModalTitle.textContent = title;
  uiModalBody.innerHTML = bodyHtml;
  uiModalConfirm.textContent = confirmLabel;
  uiModalCancel.textContent = cancelLabel;
  uiModalCancel.classList.toggle("hidden", !showCancel);
  uiModalConfirm.classList.toggle("secondary", destructive);
  uiModal.classList.remove("hidden");

  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function closeUiModal(result) {
  if (!uiModal) return;
  uiModal.classList.add("hidden");
  if (modalResolver) {
    modalResolver(result);
    modalResolver = null;
  }
}

uiModalConfirm?.addEventListener("click", () => closeUiModal(true));
uiModalCancel?.addEventListener("click", () => closeUiModal(false));
uiModalClose?.addEventListener("click", () => closeUiModal(false));
uiModal?.addEventListener("click", (event) => {
  if (event.target === uiModal) {
    closeUiModal(false);
  }
});

function renderReminderMeta(reminder) {
  const pieces = [];

  if (reminder.nextKm !== null) {
    pieces.push(`<span>Proximo service: ${Number(reminder.nextKm).toLocaleString("es-AR")} km</span>`);
  }

  if (reminder.kmRemaining !== null) {
    pieces.push(`<span>Restan ${Number(reminder.kmRemaining).toLocaleString("es-AR")} km</span>`);
  }

  if (reminder.nextDate) {
    pieces.push(`<span>Fecha objetivo: ${formatDateLabel(reminder.nextDate)}</span>`);
  }

  if (reminder.daysRemaining !== null) {
    pieces.push(`<span>Faltan ${reminder.daysRemaining} dias</span>`);
  }

  return pieces.join("");
}

function clearOverview() {
  if (!hasOverviewUi) return;
  overviewStatusLabel.textContent = "Sin datos";
  overviewStatusCopy.textContent = "Selecciona un vehiculo para ver el proximo mantenimiento.";
  overviewMonthlyTotal.textContent = formatCurrency(0);
  overviewTotalInvested.textContent = formatCurrency(0);
  overviewNextService.textContent = "Sin calculo";
  remindersList.innerHTML = '<div class="empty">Selecciona un vehiculo para cargar recordatorios y gastos.</div>';
}

function renderOverview(data) {
  if (!hasOverviewUi) return;
  const reminder = data.selectedReminder;

  overviewMonthlyTotal.textContent = formatCurrency(data.monthlySpend);
  overviewTotalInvested.textContent = formatCurrency(data.totalSpend);

  if (!reminder) {
    overviewStatusLabel.textContent = "Sin configuracion";
    overviewStatusCopy.textContent = "Todavia no hay datos suficientes para calcular el proximo mantenimiento.";
    overviewNextService.textContent = "Sin calculo";
  } else {
    overviewStatusLabel.textContent = reminder.statusLabel;
    overviewStatusCopy.textContent = reminder.message;

    if (reminder.nextKm !== null || reminder.nextDate) {
      const pieces = [];
      if (reminder.nextKm !== null) pieces.push(`${Number(reminder.nextKm).toLocaleString("es-AR")} km`);
      if (reminder.nextDate) pieces.push(formatDateLabel(reminder.nextDate));
      overviewNextService.textContent = `Proximo: ${pieces.join(" / ")}`;
    } else {
      overviewNextService.textContent = "Configura intervalos";
    }
  }

  const alerts = data.alerts || [];

  if (alerts.length === 0 && reminder) {
    remindersList.innerHTML = `
      <article class="reminder-alert is-normal">
        <div class="reminder-title-row">
          <h3>${reminder.vehicleName}</h3>
          <span class="status-badge is-normal">Todo al dia</span>
        </div>
        <p class="section-copy">${reminder.message}</p>
        <div class="reminder-meta">${renderReminderMeta(reminder)}</div>
      </article>
    `;
    return;
  }

  if (alerts.length === 0) {
    remindersList.innerHTML = '<div class="empty">No hay alertas activas para mostrar.</div>';
    return;
  }

  remindersList.innerHTML = alerts
    .map(
      (item) => `
        <article class="reminder-alert ${statusModifier(item.status)}">
          <div class="reminder-title-row">
            <h3>${item.vehicleName}</h3>
            <span class="status-badge ${statusModifier(item.status)}">${item.statusLabel}</span>
          </div>
          <p class="section-copy">${item.message}</p>
          <div class="reminder-meta">${renderReminderMeta(item)}</div>
        </article>
      `
    )
    .join("");
}

async function loadDashboardOverview() {
  if (!hasOverviewUi) return;
  const session = getSession?.();

  if (!session?.id || !selectedVehicleId) {
    clearOverview();
    return;
  }

  overviewStatusLabel.textContent = "Cargando...";
  overviewStatusCopy.textContent = "Calculando recordatorios y gastos...";
  overviewNextService.textContent = "Calculando";

  try {
    const data = await fetchJson(`/dashboard/overview?user_id=${session.id}&vehiculo_id=${selectedVehicleId}`);
    renderOverview(data);
  } catch (error) {
    overviewStatusLabel.textContent = "Error";
    overviewStatusCopy.textContent = error.message;
    overviewNextService.textContent = "Sin calculo";
    remindersList.innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

const originalSelectVehicle = selectVehicle;
selectVehicle = function patchedSelectVehicle(id) {
  originalSelectVehicle(id);
  setTimeout(() => {
    loadDashboardOverview().catch(console.error);
  }, 0);
};

const originalGoBackToVehicles = goBackToVehicles;
goBackToVehicles = function patchedGoBackToVehicles() {
  originalGoBackToVehicles();
  clearOverview();
};

const originalRefreshAllData = refreshAllData;
refreshAllData = async function patchedRefreshAllData() {
  await originalRefreshAllData();
  if (selectedVehicleId) {
    await loadDashboardOverview();
  }
};

const originalLoadMaintenance = loadMaintenance;
loadMaintenance = async function patchedLoadMaintenance(options = {}) {
  const result = await originalLoadMaintenance(options);
  if (selectedVehicleId) {
    await loadDashboardOverview();
  }
  return result;
};

showNotAvailable = function patchedShowNotAvailable() {
  closeMenu();
  if (typeof openUiModal !== "function") return;
  openUiModal({
    title: "Proximamente",
    bodyHtml: "<p>Esta seccion todavia no esta disponible, pero el resto del panel sigue funcionando.</p>",
  });
};

viewVehicle = function patchedViewVehicle(id) {
  const vehicle = currentVehicles.find((item) => item.id === id);
  if (!vehicle || typeof openUiModal !== "function") return;

  openUiModal({
    title: "Detalle del vehiculo",
    bodyHtml: `
      <div class="vehicle-detail-grid">
        <div><strong>Nombre:</strong> ${vehicle.nombre}</div>
        <div><strong>Modelo:</strong> ${vehicle.modelo}</div>
        <div><strong>Patente:</strong> ${vehicle.patente}</div>
        <div><strong>KM actual:</strong> ${vehicle.km_actual ?? "Sin dato"}</div>
        <div><strong>Ultimo service (KM):</strong> ${vehicle.ultimo_service_km ?? "Sin dato"}</div>
        <div><strong>Intervalo por KM:</strong> ${vehicle.intervalo_km ?? "Sin dato"}</div>
        <div><strong>Ultimo service (fecha):</strong> ${vehicle.fecha_ultimo_service ? formatDateLabel(vehicle.fecha_ultimo_service) : "Sin dato"}</div>
        <div><strong>Intervalo de tiempo:</strong> ${vehicle.intervalo_tiempo ? `${vehicle.intervalo_tiempo} meses` : "Sin dato"}</div>
      </div>
    `,
  });
};

viewPlace = function patchedViewPlace(id) {
  const place = currentPlaces.find((item) => item.id === id);
  if (!place || typeof openUiModal !== "function") return;

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
};

editVehicle = function patchedEditVehicle(id) {
  const vehicle = currentVehicles.find((item) => item.id === id);
  if (!vehicle) return;

  document.querySelector("#vehicle-form [name=nombre]").value = vehicle.nombre || "";
  document.querySelector("#vehicle-form [name=modelo]").value = vehicle.modelo || "";
  document.querySelector("#vehicle-form [name=patente]").value = vehicle.patente || "";
  document.querySelector("#vehicle-form [name=km_actual]").value = vehicle.km_actual ?? "";
  document.querySelector("#vehicle-form [name=ultimo_service_km]").value = vehicle.ultimo_service_km ?? "";
  document.querySelector("#vehicle-form [name=intervalo_km]").value = vehicle.intervalo_km ?? "";
  document.querySelector("#vehicle-form [name=fecha_ultimo_service]").value = vehicle.fecha_ultimo_service || "";
  document.querySelector("#vehicle-form [name=intervalo_tiempo]").value = vehicle.intervalo_tiempo ?? "";

  editingVehicleId = id;
  document.querySelector("#vehicle-form button").textContent = "Guardar";
  openVehiclesModal();
};

deleteVehicle = async function patchedDeleteVehicle(id) {
  const session = getSession();
  const vehicle = currentVehicles.find((item) => item.id === id);
  const confirmed = await openUiModal({
    title: "Eliminar vehiculo",
    bodyHtml: `<p>Vas a eliminar <strong>${vehicle?.nombre || "este vehiculo"}</strong>. Esta accion no se puede deshacer.</p>`,
    confirmLabel: "Eliminar",
    cancelLabel: "Cancelar",
    showCancel: true,
    destructive: true,
  });

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando vehiculo...");
    await fetchJson(`/vehicles/${id}?user_id=${session.id}`, { method: "DELETE" });
    if (selectedVehicleId === id) {
      goBackToVehicles();
    }
    await refreshAllData();
  } catch (error) {
    await openUiModal({
      title: "No se pudo eliminar",
      bodyHtml: `<p>${error.message}</p>`,
    });
  } finally {
    hideAppLoading();
  }
};

deletePlace = async function patchedDeletePlace(id) {
  const session = getSession();
  const place = currentPlaces.find((item) => item.id === id);
  const confirmed = await openUiModal({
    title: "Eliminar lugar",
    bodyHtml: `<p>Vas a eliminar <strong>${place?.nombre || "este lugar"}</strong>. Esta accion no se puede deshacer.</p>`,
    confirmLabel: "Eliminar",
    cancelLabel: "Cancelar",
    showCancel: true,
    destructive: true,
  });

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando lugar...");
    await fetchJson(`/places/${id}?user_id=${session.id}`, { method: "DELETE" });
    await refreshAllData();
  } catch (error) {
    await openUiModal({
      title: "No se pudo eliminar",
      bodyHtml: `<p>${error.message}</p>`,
    });
  } finally {
    hideAppLoading();
  }
};

maintenanceForm?.addEventListener("submit", () => {
  setTimeout(async () => {
    if (formMessage.textContent.includes("correctamente") && selectedVehicleId) {
      await loadMaintenance({ latestOnly: true });
    }
  }, 450);
});

clearOverview();


if (menuProfileButton) {
  const replacement = menuProfileButton.cloneNode(true);
  menuProfileButton.replaceWith(replacement);
  replacement.addEventListener("click", showNotAvailable);
}

if (menuSettingsButton) {
  const replacement = menuSettingsButton.cloneNode(true);
  menuSettingsButton.replaceWith(replacement);
  replacement.addEventListener("click", showNotAvailable);
}

clearOverview();

