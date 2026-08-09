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
let currentMaintenancePlans = [];

function planDetailText(plan) {
  const parts=[];
  if(plan.km_remaining!==null){
    parts.push(plan.km_remaining<0?`Atrasado por ${Math.abs(plan.km_remaining).toLocaleString("es-AR")} km`:plan.km_remaining===0?"Vence ahora":`Faltan ${plan.km_remaining.toLocaleString("es-AR")} km`);
  }
  if(plan.days_remaining!==null){
    const n=Math.abs(plan.days_remaining); const unit=n===1?"día":"días";
    parts.push(plan.days_remaining<0?`Atrasado por ${n} ${unit}`:plan.days_remaining===0?"Vence hoy":`Faltan ${n} ${unit}`);
  }
  return parts.join(" · ");
}

function planUrgencyRank(plan){return plan.status==="overdue"?0:plan.status==="upcoming"?1:2;}
function sortPlans(plans){return [...plans].sort((a,b)=>planUrgencyRank(a)-planUrgencyRank(b)||(a.km_remaining??Infinity)-(b.km_remaining??Infinity)||(a.days_remaining??Infinity)-(b.days_remaining??Infinity)||a.id-b.id);}

function renderPlanTimeline(plans=currentMaintenancePlans){
  if(!plans.length)return `<div class="maintenance-plans-empty"><strong>Sin planes configurados</strong><span>Creá el primero indicando su base real.</span></div>`;
  return `<div class="maintenance-plans-timeline">${sortPlans(plans).map(plan=>`<article class="maintenance-plan-item is-${plan.status}${plan.is_active?"":" is-inactive"}"><span class="maintenance-plan-node"></span><div><strong>${escapeHtml(plan.name)}</strong><p>${plan.next_service_km==null?"":`Próximo: ${Number(plan.next_service_km).toLocaleString("es-AR")} km`}${plan.next_service_date?` · ${formatDateLabel(String(plan.next_service_date).slice(0,10))}`:""}</p><span>${plan.is_active?planDetailText(plan):"Plan inactivo"}</span><div class="maintenance-plan-actions"><button type="button" onclick="toggleMaintenancePlan(${plan.id})">${plan.is_active?"Pausar":"Activar"}</button><button type="button" class="danger" onclick="deleteMaintenancePlan(${plan.id})">Eliminar</button></div></div><em>${plan.is_active?plan.status_label:"Inactivo"}</em></article>`).join("")}</div>`;
}

async function loadMaintenancePlans(){
  if(!selectedVehicleId){currentMaintenancePlans=[];return [];}
  currentMaintenancePlans=await fetchJson(`/maintenance-plans?vehicle_id=${selectedVehicleId}`);
  const select=document.getElementById("maintenance-plan-select");
  if(select){const selected=select.value;select.innerHTML='<option value="">Eventual · no reinicia ningún plan</option>'+currentMaintenancePlans.filter(p=>p.is_active).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");select.value=selected;}
  const list=document.getElementById("maintenance-plans-list");if(list)list.innerHTML=renderPlanTimeline(currentMaintenancePlans);
  return currentMaintenancePlans;
}

async function createMaintenancePlan(){
  const form=document.getElementById("vehicle-reminders-form"); if(!form||!selectedVehicleId)return;
  const value=(name)=>form.elements[name]?.value||null;
  const payload={vehicle_id:selectedVehicleId,name:value("plan_name"),interval_km:value("plan_interval_km"),notify_km_before:value("plan_notify_km"),initial_service_km:value("plan_initial_km"),interval_months:value("plan_interval_months"),notify_days_before:value("plan_notify_days"),initial_service_date:value("plan_initial_date")};
  try{await fetchJson("/maintenance-plans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});["plan_name","plan_interval_km","plan_initial_km","plan_interval_months","plan_initial_date"].forEach(n=>{if(form.elements[n])form.elements[n].value="";});await loadMaintenancePlans();await loadDashboardOverview();showToast("Plan creado",{tone:"success"});}catch(error){const message=document.getElementById("vehicle-reminders-message");if(message)message.textContent=error.message;}
}

async function toggleMaintenancePlan(id){const plan=currentMaintenancePlans.find(p=>Number(p.id)===Number(id));if(!plan)return;await fetchJson(`/maintenance-plans/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({vehicle_id:plan.vehicle_id,name:plan.name,is_active:!plan.is_active,interval_km:plan.interval_km,notify_km_before:plan.notify_km_before,initial_service_km:plan.initial_service_km,interval_months:plan.interval_months,notify_days_before:plan.notify_days_before,initial_service_date:plan.initial_service_date})});await loadMaintenancePlans();await loadDashboardOverview();}
async function deleteMaintenancePlan(id){const confirmed=await openUiModal({title:"Eliminar plan",bodyHtml:"<p>El historial se conserva como eventual, pero este plan y sus avisos se eliminarán.</p>",showCancel:true,confirmLabel:"Eliminar",destructive:true});if(!confirmed)return;await fetchJson(`/maintenance-plans/${id}`,{method:"DELETE"});await loadMaintenancePlans();await loadDashboardOverview();}

document.getElementById("maintenance-plan-create")?.addEventListener("click",createMaintenancePlan);
document.getElementById("maintenance-plans-view-more")?.addEventListener("click",async()=>{await loadMaintenancePlans();openUiModal({title:"Mantenimientos programados",showConfirm:false,bodyHtml:renderPlanTimeline()});});

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
    const [data,plans] = await Promise.all([fetchJson(`/dashboard/overview?vehiculo_id=${selectedVehicleId}`),loadMaintenancePlans()]);
    renderOverview(data);
    const urgent=sortPlans(plans.filter(p=>p.is_active))[0];
    if(urgent){overviewStatusLabel.textContent=urgent.status_label;overviewStatusLabel.className=`vehicle-detail-status is-${urgent.status}`;overviewNextService.textContent=urgent.name;overviewStatusCopy.textContent=planDetailText(urgent);}
    else{overviewStatusLabel.textContent="Sin planes";overviewStatusLabel.className="vehicle-detail-status";overviewNextService.textContent="Configurá el primero";overviewStatusCopy.textContent="Los recordatorios generales existentes se conservan como legacy.";}
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
