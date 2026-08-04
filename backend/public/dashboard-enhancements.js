const overviewStatusLabel = document.getElementById("overview-status-label");
const overviewStatusCopy = document.getElementById("overview-status-copy");
const overviewMonthlyTotal = document.getElementById("overview-monthly-total");
const overviewTotalInvested = document.getElementById("overview-total-invested");
const overviewNextService = document.getElementById("overview-next-service");
const remindersList = document.getElementById("reminders-list");
const detailRemindersCount = document.getElementById("detail-reminders-count");
const uiModal = document.getElementById("ui-modal");
const uiModalTitle = document.getElementById("ui-modal-title");
const uiModalBody = document.getElementById("ui-modal-body");
const uiModalCancel = document.getElementById("ui-modal-cancel");
const uiModalConfirm = document.getElementById("ui-modal-confirm");
const uiModalClose = document.getElementById("ui-modal-close");

const hasOverviewUi = Boolean(overviewStatusLabel && overviewStatusCopy && overviewMonthlyTotal && overviewTotalInvested && overviewNextService);

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

function renderReminderCount(count) {
  const value = Number(count) || 0;
  [detailRemindersCount].forEach((element) => {
    if (!element) return;
    element.textContent = value > 0 ? String(value) : "";
    element.classList.toggle("hidden", value === 0);
  });
}

function openUiModal({
  title,
  bodyHtml,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  showCancel = false,
  destructive = false,
  showConfirm = true,
  confirmDisabled = false,
  onConfirm = null,
}) {
  if (!uiModal) {
    return Promise.resolve(true);
  }

  uiModalTitle.textContent = title;
  uiModalBody.innerHTML = bodyHtml;
  uiModalConfirm.textContent = confirmLabel;
  uiModalCancel.textContent = cancelLabel;
  uiModalCancel.classList.toggle("hidden", !showCancel);
  uiModalConfirm.classList.toggle("hidden", !showConfirm);
  uiModalConfirm.classList.toggle("secondary", destructive);
  uiModalConfirm.disabled = Boolean(confirmDisabled);
  uiModalConfirm._onConfirm = onConfirm;
  uiModal.classList.remove("hidden");
  if (typeof syncModalBodyState === "function") {
    syncModalBodyState();
  }

  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function closeUiModal(result) {
  if (!uiModal) return;
  uiModal.classList.add("hidden");
  if (typeof syncModalBodyState === "function") {
    syncModalBodyState();
  }
  if (uiModalConfirm) {
    uiModalConfirm._onConfirm = null;
    uiModalConfirm.disabled = false;
  }
  if (modalResolver) {
    modalResolver(result);
    modalResolver = null;
  }
}

uiModalConfirm?.addEventListener("click", async () => {
  if (typeof uiModalConfirm._onConfirm === "function") {
    uiModalConfirm.disabled = true;
    try {
      const shouldClose = await uiModalConfirm._onConfirm();
      if (shouldClose === false) return;
    } finally {
      uiModalConfirm.disabled = false;
    }
  }

  closeUiModal(true);
});
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
  overviewStatusLabel.className = "vehicle-detail-status";
  overviewStatusCopy.textContent = "Selecciona un vehiculo para ver el proximo mantenimiento.";
  overviewMonthlyTotal.textContent = formatCurrency(0);
  overviewTotalInvested.textContent = formatCurrency(0);
  overviewNextService.textContent = "Sin calculo";
  renderReminderCount(0);
}

function renderOverview(data) {
  if (!hasOverviewUi) return;
  const reminder = data.selectedReminder;
  const remindersEnabled = data.remindersEnabled !== false;

  overviewStatusLabel.className = `vehicle-detail-status ${statusModifier(
    !remindersEnabled ? "pausado" : reminder?.status
  )}`;

  overviewMonthlyTotal.textContent = formatCurrency(data.monthlySpend);
  overviewTotalInvested.textContent = formatCurrency(data.totalSpend);

  if (!remindersEnabled) {
    overviewStatusLabel.textContent = "Pausados";
    overviewStatusCopy.textContent = "Los recordatorios estan desactivados en configuracion.";
    overviewNextService.textContent = "Recordatorios desactivados";
  } else if (reminder?.status === "pausado") {
    overviewStatusLabel.textContent = "Pausados";
    overviewStatusCopy.textContent = "Los recordatorios de este vehiculo estan desactivados.";
    overviewNextService.textContent = "Vehiculo en pausa";
  } else if (!reminder) {
    overviewStatusLabel.textContent = "Sin configuracion";
    overviewStatusCopy.textContent = "Todavia no hay datos suficientes para calcular el proximo mantenimiento.";
    overviewNextService.textContent = "Sin calculo";
  } else {
    overviewStatusLabel.textContent = reminder.statusLabel;
    overviewNextService.textContent = reminder.kmRemaining !== null && reminder.kmRemaining !== undefined
      ? `Faltan ${Number(reminder.kmRemaining).toLocaleString("es-AR")} km`
      : reminder.nextKm !== null && reminder.nextKm !== undefined
        ? `Proximo a ${Number(reminder.nextKm).toLocaleString("es-AR")} km`
        : "Sin kilometraje programado";
    overviewStatusCopy.textContent = reminder.nextDate
      ? `o antes del ${formatDateLabel(reminder.nextDate)}`
      : reminder.message || "Sin fecha programada.";
  }

  const alerts = data.alerts || [];

  if (!remindersList) {
    return;
  }

  if (!remindersEnabled) {
    remindersList.innerHTML = '<div class="vehicle-detail-empty">Activa los recordatorios desde Configuracion para ver alertas aqui.</div>';
    renderReminderCount(0);
    return;
  }

  if (alerts.length === 0 && reminder) {
    remindersList.innerHTML = `
        <article class="vehicle-detail-reminder is-normal">
        <div class="vehicle-detail-reminder-icon" aria-hidden="true">${buildIconMarkup("bell")}</div>
        <div class="vehicle-detail-reminder-copy">
          <h3>${reminder.vehicleName}</h3>
          <p>${reminder.message}</p>
          <div class="vehicle-detail-reminder-meta">${renderReminderMeta(reminder)}</div>
        </div>
        <span class="vehicle-detail-reminder-state">Todo al dia</span>
        </article>
      `;
    renderReminderCount(0);
    return;
  }

  if (alerts.length === 0) {
    remindersList.innerHTML = '<div class="vehicle-detail-empty">No hay recordatorios activos para mostrar.</div>';
    renderReminderCount(0);
    return;
  }

  remindersList.innerHTML = alerts
    .map(
      (item) => `
        <article class="vehicle-detail-reminder ${statusModifier(item.status)}">
          <div class="vehicle-detail-reminder-icon" aria-hidden="true">${buildIconMarkup("bell")}</div>
          <div class="vehicle-detail-reminder-copy">
            <h3>${item.vehicleName}</h3>
            <p>${item.message}</p>
            <div class="vehicle-detail-reminder-meta">${renderReminderMeta(item)}</div>
          </div>
          <span class="vehicle-detail-reminder-state ${statusModifier(item.status)}">${item.statusLabel}</span>
        </article>
      `
    )
    .join("");
  renderReminderCount(alerts.length);
}

async function loadDashboardOverview() {
  if (!hasOverviewUi) return;
  const session = getSession?.();

  if (!session?.id || !selectedVehicleId) {
    clearOverview();
    return;
  }

  overviewStatusLabel.textContent = "Cargando...";
  overviewStatusLabel.className = "vehicle-detail-status";
  overviewStatusCopy.textContent = "Calculando recordatorios y gastos...";
  overviewNextService.textContent = "Calculando";

  try {
    const data = await fetchJson(`/dashboard/overview?vehiculo_id=${selectedVehicleId}`);
    renderOverview(data);
  } catch (error) {
    overviewStatusLabel.textContent = "Error";
    overviewStatusLabel.className = "vehicle-detail-status is-atrasado";
    overviewStatusCopy.textContent = error.message;
    overviewNextService.textContent = "Sin calculo";
    if (remindersList) {
      remindersList.innerHTML = `<div class="vehicle-detail-empty">${error.message}</div>`;
    }
    renderReminderCount(0);
  }
}

const originalSelectVehicle = selectVehicle;
selectVehicle = function patchedSelectVehicle(id, origin) {
  originalSelectVehicle(id, origin);
  setTimeout(() => {
    loadDashboardOverview().catch(console.error);
  }, 0);
};

const originalGoBackToVehicles = goBackToVehicles;
goBackToVehicles = function patchedGoBackToVehicles(origin) {
  originalGoBackToVehicles(origin);
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

if (typeof openVehicleDeleteModal !== "function") {
  window.openVehicleDeleteModal = async function patchedOpenVehicleDeleteModal() {
    await openUiModal({
      title: "No se pudo abrir la confirmación",
      bodyHtml: "<p>Actualizá la aplicación e intentá eliminar el vehículo nuevamente.</p>",
    });
  };
}

deletePlace = async function patchedDeletePlace(id) {
  const session = getSession();
  const place = currentPlaces.find((item) => item.id === id);
  const confirmed = await openUiModal({
    title: "Eliminar lugar",
    bodyHtml: `<p>Vas a eliminar <strong>${escapeHtml(place?.nombre || "este lugar")}</strong>. Esta accion no se puede deshacer.</p>`,
    confirmLabel: "Eliminar",
    cancelLabel: "Cancelar",
    showCancel: true,
    destructive: true,
  });

  if (!confirmed) return;

  try {
    showAppLoading("Eliminando lugar...");
    await fetchJson(`/places/${id}`, { method: "DELETE" });
    await refreshAllData();
  } catch (error) {
    hideAppLoading();
    await openUiModal({
      title: error.status === 409 ? "Lugar en uso" : "No se pudo eliminar",
      bodyHtml: buildPlaceDeleteErrorHtml(error),
    });
  } finally {
    hideAppLoading();
  }
};

clearOverview();
