const { normalizeReminder } = require("./reminders");
const { buildNotificationPayload, sendPushToUser } = require("./pushNotifications");

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
      v.ultimo_service_km,
      v.intervalo_km,
      v.fecha_ultimo_service,
      v.intervalo_tiempo,
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

function buildReminderCandidate(reminder) {
  const vehicleLabel = reminder.vehicleName || "tu vehiculo";
  const url = buildNotificationIntentUrl({ vehicleId: reminder.vehicleId, view: "dashboard" });

  if (reminder.currentKm === null && reminder.intervalKm !== null) {
    return {
      type: "km-update",
      dedupeKey: `km-update:${reminder.vehicleId}:${reminder.intervalKm}:${reminder.intervalMonths ?? "na"}`,
      notification: buildNotificationPayload({
        title: "Actualiza el kilometraje",
        body: `Actualiza el kilometraje actual de ${vehicleLabel} para mantener tus recordatorios al dia.`,
        type: "km-update",
        tag: `km-update-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    };
  }

  if (reminder.status === "atrasado") {
    return {
      type: "maintenance-pending",
      dedupeKey: `maintenance-pending:${reminder.vehicleId}:${reminder.nextKm ?? "na"}:${reminder.nextDate ?? "na"}`,
      notification: buildNotificationPayload({
        title: "Mantenimiento pendiente",
        body: `${vehicleLabel} ya necesita atencion. Revisalo para evitar gastos sorpresa.`,
        type: "maintenance-pending",
        tag: `maintenance-pending-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    };
  }

  if (reminder.status === "proximo") {
    return {
      type: "maintenance-upcoming",
      dedupeKey: `maintenance-upcoming:${reminder.vehicleId}:${reminder.nextKm ?? "na"}:${reminder.nextDate ?? "na"}`,
      notification: buildNotificationPayload({
        title: "Vencimiento proximo",
        body: `Se acerca el proximo mantenimiento de ${vehicleLabel}. Conviene programarlo pronto.`,
        type: "maintenance-upcoming",
        tag: `maintenance-upcoming-${reminder.vehicleId}`,
        url,
        data: {
          vehicleId: reminder.vehicleId,
        },
      }),
    };
  }

  return null;
}

async function reserveNotificationEvent(pool, { userId, vehicleId, notificationType, dedupeKey, payload }) {
  const result = await pool.query(
    `INSERT INTO push_notification_events (
      user_id,
      vehicle_id,
      notification_type,
      dedupe_key,
      payload
    )
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id`,
    [userId, vehicleId || null, notificationType, dedupeKey, JSON.stringify(payload)]
  );

  return result.rows[0]?.id || null;
}

async function releaseNotificationEvent(pool, eventId) {
  if (!eventId) return;
  await pool.query("DELETE FROM push_notification_events WHERE id = $1", [eventId]);
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
  };

  for (const row of usersResult.rows) {
    const reminderRows = await fetchUserReminderRows(pool, row.id);
    const reminders = reminderRows.map(normalizeReminder);

    for (const reminder of reminders) {
      const candidate = buildReminderCandidate(reminder);

      if (!candidate) {
        continue;
      }

      summary.candidates += 1;

      const eventId = await reserveNotificationEvent(pool, {
        userId: row.id,
        vehicleId: reminder.vehicleId,
        notificationType: candidate.type,
        dedupeKey: candidate.dedupeKey,
        payload: candidate.notification,
      });

      if (!eventId) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendPushToUser(pool, {
        userId: row.id,
        notification: candidate.notification,
      });

      summary.sent += result.sent;
      summary.failed += result.failed;
      summary.pruned += result.pruned;

      if (result.sent === 0 && result.pruned === 0) {
        await releaseNotificationEvent(pool, eventId);
      }
    }
  }

  return summary;
}

module.exports = {
  buildNotificationIntentUrl,
  buildReminderCandidate,
  runReminderSweep,
};
