const {
  DEFAULT_REPEAT_DAYS,
  normalizeReminder,
} = require("./reminders");
const { buildNotificationPayload, sendPushToUser } = require("./pushNotifications");
const { calculatePlan } = require("./maintenancePlans");

async function fetchUserPlanRows(pool, userId) {
  const result=await pool.query(`SELECT p.*,v.nombre AS vehicle_name,v.km_actual FROM maintenance_plans p JOIN vehiculos v ON v.id=p.vehicle_id AND v.user_id=p.user_id WHERE p.user_id=$1 AND p.is_active=TRUE ORDER BY p.id`,[userId]);
  return result.rows.map((row)=>calculatePlan(row,{currentKm:row.km_actual}));
}

function buildPlanReminderCandidates(plan) {
  const candidates=[]; const url=buildNotificationIntentUrl({vehicleId:plan.vehicle_id});
  const common={planId:plan.id,vehicleId:plan.vehicle_id};
  if(plan.status==="upcoming"){
    const detail=plan.km_remaining!==null && plan.km_remaining<=Number(plan.notify_km_before||0)
      ? `Faltan ${Math.max(plan.km_remaining,0).toLocaleString("es-AR")} km.`
      : `Vence el ${String(plan.next_service_date).split("-").reverse().join("/")}.`;
    candidates.push({type:"maintenance_plan_upcoming",stage:"upcoming",dueSnapshot:`${plan.next_service_km||"-"}:${plan.next_service_date||"-"}`,dedupeKey:`maintenance_plan_upcoming:${plan.id}:${plan.next_service_km||"-"}:${plan.next_service_date||"-"}`,cooldownDays:DEFAULT_REPEAT_DAYS,notification:buildNotificationPayload({title:`${plan.name} próximo`,body:detail,type:"maintenance_plan_upcoming",tag:`maintenance-plan-upcoming-${plan.id}`,url,data:common})});
  }
  if(plan.status==="overdue"){
    const parts=[]; if(plan.km_remaining!==null&&plan.km_remaining<=0)parts.push(`atrasado por ${Math.abs(plan.km_remaining)} km`); if(plan.days_remaining!==null&&plan.days_remaining<0)parts.push(`atrasado por ${Math.abs(plan.days_remaining)} ${Math.abs(plan.days_remaining)===1?"día":"días"}`);
    candidates.push({type:"maintenance_plan_overdue",stage:"overdue",dueSnapshot:`${plan.next_service_km||"-"}:${plan.next_service_date||"-"}`,dedupeKey:`maintenance_plan_overdue:${plan.id}:${plan.next_service_km||"-"}:${plan.next_service_date||"-"}`,cooldownDays:DEFAULT_REPEAT_DAYS,notification:buildNotificationPayload({title:`${plan.name} atrasado`,body:parts.join(" · "),type:"maintenance_plan_overdue",tag:`maintenance-plan-overdue-${plan.id}`,url,data:common})});
  }
  return candidates;
}

function buildNotificationIntentUrl({ vehicleId = null, maintenanceId = null, view = "dashboard" } = {}) {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (vehicleId) params.set("vehicleId", String(vehicleId));
  if (maintenanceId) params.set("maintenanceId", String(maintenanceId));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

async function fetchUserReminderRows(pool, userId) {
  const result = await pool.query(
    `SELECT
      v.id,
      v.nombre,
      v.modelo,
      v.patente,
      v.km_actual,
      v.km_updated_at,
      v.ultimo_service_km,
      v.intervalo_km,
      v.fecha_ultimo_service,
      v.intervalo_tiempo,
      v.vehicle_reminders_enabled,
      v.notify_days_before,
      v.notify_km_before,
      v.km_update_reminder_days,
      lm.fecha AS latest_fecha,
      lm.km AS latest_km
    FROM vehiculos v
    LEFT JOIN LATERAL (
      SELECT fecha, km
      FROM mantenimiento m
      WHERE m.user_id = $1 AND m.vehiculo_id = v.id
      ORDER BY m.fecha DESC, m.id DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE v.user_id = $1
    ORDER BY v.nombre ASC, v.id ASC`,
    [userId]
  );

  return result.rows;
}

function buildReminderCandidates(reminder) {
  if (!reminder.vehicleRemindersEnabled) {
    return [];
  }

  const vehicleLabel = reminder.vehicleName || "tu vehiculo";
  const url = buildNotificationIntentUrl({ vehicleId: reminder.vehicleId, view: "dashboard" });
  const candidates = [];

  if (reminder.timeReminder.status === "upcoming" && reminder.timeReminder.nextDate) {
    candidates.push({
      type: "maintenance_upcoming_time",
      stage: "upcoming",
      dueSnapshot: `time:${reminder.timeReminder.nextDate}`,
      dedupeKey: `maintenance_upcoming_time:${reminder.vehicleId}:${reminder.timeReminder.nextDate}`,
      cooldownDays: DEFAULT_REPEAT_DAYS,
      notification: buildNotificationPayload({
        title: "Mantenimiento proximo por tiempo",
        body: `${vehicleLabel} necesita atencion pronto. Te avisaremos con ${reminder.notifyDaysBefore} dias de anticipacion.`,
        type: "maintenance_upcoming_time",
        tag: `maintenance-upcoming-time-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    });
  }

  if (reminder.timeReminder.status === "overdue" && reminder.timeReminder.nextDate) {
    candidates.push({
      type: "maintenance_overdue_time",
      stage: "overdue",
      dueSnapshot: `time:${reminder.timeReminder.nextDate}`,
      dedupeKey: `maintenance_overdue_time:${reminder.vehicleId}:${reminder.timeReminder.nextDate}`,
      cooldownDays: DEFAULT_REPEAT_DAYS,
      notification: buildNotificationPayload({
        title: "Mantenimiento vencido por tiempo",
        body: `${vehicleLabel} ya supero la fecha estimada de mantenimiento. Revisalo cuanto antes.`,
        type: "maintenance_overdue_time",
        tag: `maintenance-overdue-time-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    });
  }

  if (reminder.kmReminder.status === "upcoming" && reminder.kmReminder.nextKm !== null) {
    candidates.push({
      type: "maintenance_upcoming_km",
      stage: "upcoming",
      dueSnapshot: `km:${reminder.kmReminder.nextKm}`,
      dedupeKey: `maintenance_upcoming_km:${reminder.vehicleId}:${reminder.kmReminder.nextKm}`,
      cooldownDays: DEFAULT_REPEAT_DAYS,
      notification: buildNotificationPayload({
        title: "Mantenimiento proximo por kilometraje",
        body: `${vehicleLabel} se acerca al proximo service. Te avisaremos con ${reminder.notifyKmBefore.toLocaleString("es-AR")} km de margen.`,
        type: "maintenance_upcoming_km",
        tag: `maintenance-upcoming-km-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    });
  }

  if (reminder.kmReminder.status === "overdue" && reminder.kmReminder.nextKm !== null) {
    candidates.push({
      type: "maintenance_overdue_km",
      stage: "overdue",
      dueSnapshot: `km:${reminder.kmReminder.nextKm}`,
      dedupeKey: `maintenance_overdue_km:${reminder.vehicleId}:${reminder.kmReminder.nextKm}`,
      cooldownDays: DEFAULT_REPEAT_DAYS,
      notification: buildNotificationPayload({
        title: "Mantenimiento vencido por kilometraje",
        body: `${vehicleLabel} ya esta pasado de kilometraje para el proximo service.`,
        type: "maintenance_overdue_km",
        tag: `maintenance-overdue-km-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    });
  }

  if (reminder.kmUpdateReminder.needsUpdate) {
    candidates.push({
      type: "km_update_needed",
      stage: "needs_update",
      dueSnapshot: `km-update:${reminder.kmUpdateReminder.dueSnapshot || "missing"}`,
      dedupeKey: `km_update_needed:${reminder.vehicleId}:${reminder.kmUpdateReminder.dueSnapshot || "missing"}`,
      cooldownDays: reminder.kmUpdateReminder.intervalDays || DEFAULT_REPEAT_DAYS,
      notification: buildNotificationPayload({
        title: "Actualiza el kilometraje",
        body: `Actualiza el kilometraje actual de ${vehicleLabel} para mantener tus recordatorios por kilometraje al dia.`,
        type: "km_update_needed",
        tag: `km-update-needed-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    });
  }

  return candidates;
}

async function upsertNotificationEvent(pool, { userId, vehicleId, planId, notificationType, dedupeKey, payload, stage, dueSnapshot }) {
  const result = await pool.query(
    `INSERT INTO push_notification_events (
      user_id,
      vehicle_id,
      maintenance_plan_id,
      notification_type,
      dedupe_key,
      stage,
      due_snapshot,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    ON CONFLICT (dedupe_key)
    DO UPDATE SET
      maintenance_plan_id = EXCLUDED.maintenance_plan_id,
      notification_type = EXCLUDED.notification_type,
      stage = EXCLUDED.stage,
      due_snapshot = EXCLUDED.due_snapshot,
      payload = EXCLUDED.payload
    RETURNING id, last_sent_at, cooldown_until, send_count`,
    [
      userId,
      vehicleId || null,
      planId || null,
      notificationType,
      dedupeKey,
      stage || null,
      dueSnapshot || null,
      JSON.stringify(payload),
    ]
  );

  return result.rows[0] || null;
}

function isEventInCooldown(eventRow) {
  if (!eventRow?.cooldown_until) {
    return false;
  }

  return new Date(eventRow.cooldown_until).getTime() > Date.now();
}

async function markNotificationEventSent(pool, { eventId, payload, cooldownDays, result }) {
  await pool.query(
    `UPDATE push_notification_events
     SET payload = $2::jsonb,
         last_sent_at = NOW(),
         cooldown_until = NOW() + ($3 * INTERVAL '1 day'),
         send_count = COALESCE(send_count, 0) + 1,
         last_result = $4
     WHERE id = $1`,
    [
      eventId,
      JSON.stringify(payload),
      Math.max(Number(cooldownDays) || DEFAULT_REPEAT_DAYS, 1),
      result,
    ]
  );
}

async function markNotificationEventFailure(pool, { eventId, payload, result }) {
  await pool.query(
    `UPDATE push_notification_events
     SET payload = $2::jsonb,
         last_result = $3
     WHERE id = $1`,
    [eventId, JSON.stringify(payload), result]
  );
}

async function runReminderSweep(pool) {
  const usersResult = await pool.query(
    `SELECT u.id
     FROM users u
     WHERE u.reminders_enabled = TRUE
       AND EXISTS (
         SELECT 1
         FROM push_subscriptions ps
         WHERE ps.user_id = u.id
       )
     ORDER BY u.id ASC`
  );

  const summary = {
    users: usersResult.rowCount,
    candidates: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    pruned: 0,
    cooldownSkipped: 0,
  };

  for (const row of usersResult.rows) {
    const reminderRows = await fetchUserReminderRows(pool, row.id);
    const reminders = reminderRows.map((vehicle) => normalizeReminder(vehicle));
    const plans = await fetchUserPlanRows(pool,row.id);

    for (const reminder of reminders) {
      const candidates = buildReminderCandidates(reminder);

      for (const candidate of candidates) {
        summary.candidates += 1;

        const eventRow = await upsertNotificationEvent(pool, {
          userId: row.id,
          vehicleId: reminder.vehicleId,
          notificationType: candidate.type,
          dedupeKey: candidate.dedupeKey,
          payload: candidate.notification,
          stage: candidate.stage,
          dueSnapshot: candidate.dueSnapshot,
        });

        if (!eventRow) {
          summary.skipped += 1;
          continue;
        }

        if (isEventInCooldown(eventRow)) {
          summary.cooldownSkipped += 1;
          continue;
        }

        const result = await sendPushToUser(pool, {
          userId: row.id,
          notification: candidate.notification,
        });

        summary.sent += result.sent;
        summary.failed += result.failed;
        summary.pruned += result.pruned;

        if (result.sent > 0 || result.pruned > 0) {
          await markNotificationEventSent(pool, {
            eventId: eventRow.id,
            payload: candidate.notification,
            cooldownDays: candidate.cooldownDays,
            result: result.sent > 0 ? "sent" : "pruned",
          });
          continue;
        }

        await markNotificationEventFailure(pool, {
          eventId: eventRow.id,
          payload: candidate.notification,
          result: result.error || "failed",
        });
      }
    }
    for(const plan of plans){
      for(const candidate of buildPlanReminderCandidates(plan)){
        summary.candidates+=1;
        const eventRow=await upsertNotificationEvent(pool,{userId:row.id,vehicleId:plan.vehicle_id,planId:plan.id,notificationType:candidate.type,dedupeKey:candidate.dedupeKey,payload:candidate.notification,stage:candidate.stage,dueSnapshot:candidate.dueSnapshot});
        if(!eventRow||isEventInCooldown(eventRow)){summary.cooldownSkipped+=1;continue;}
        const result=await sendPushToUser(pool,{userId:row.id,notification:candidate.notification});
        summary.sent+=result.sent;summary.failed+=result.failed;summary.pruned+=result.pruned;
        if(result.sent>0||result.pruned>0)await markNotificationEventSent(pool,{eventId:eventRow.id,payload:candidate.notification,cooldownDays:candidate.cooldownDays,result:result.sent>0?"sent":"pruned"});
        else await markNotificationEventFailure(pool,{eventId:eventRow.id,payload:candidate.notification,result:result.error||"failed"});
      }
    }
  }

  return summary;
}

module.exports = {
  buildNotificationIntentUrl,
  buildReminderCandidates,
  buildPlanReminderCandidates,
  fetchUserReminderRows,
  fetchUserPlanRows,
  runReminderSweep,
  upsertNotificationEvent,
};
