const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const {
  buildNotificationPayload,
  getPublicVapidKey,
  getSubscriptionsByUser,
  hasPushConfiguration,
  removeSubscription,
  saveSubscription,
  sendPushToUser,
} = require("../utils/pushNotifications");
const {
  buildReminderCandidates,
  fetchUserReminderRows,
  runReminderSweep,
  upsertNotificationEvent,
} = require("../utils/pushReminders");
const { normalizeReminder } = require("../utils/reminders");
const { requireAuth } = require("../middleware/auth");

async function getUserNotificationPreferences(userId) {
  const result = await pool.query(
    "SELECT id, reminders_enabled FROM users WHERE id = $1",
    [userId]
  );

  return result.rows[0] || null;
}

function requireCronToken(req, res) {
  const expectedTokens = [
    process.env.CRON_SECRET,
    process.env.NOTIFICATIONS_CRON_TOKEN,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (expectedTokens.length === 0) {
    res.status(503).json({ error: "CRON_SECRET / NOTIFICATIONS_CRON_TOKEN no configurado" });
    return false;
  }

  const authorizationHeader = String(req.header("authorization") || "").trim();
  const bearerToken = authorizationHeader.toLowerCase().startsWith("bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  const providedToken = String(
    req.header("x-cron-secret") ||
      req.header("x-notifications-cron-token") ||
      bearerToken ||
      req.body?.token ||
      req.query.token ||
      ""
  ).trim();

  if (!providedToken || !expectedTokens.includes(providedToken)) {
    res.status(401).json({ error: "Token invalido" });
    return false;
  }

  return true;
}

router.get("/status", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await getUserNotificationPreferences(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const subscriptions = await getSubscriptionsByUser(pool, userId);

    res.json({
      ok: true,
      pushConfigured: hasPushConfiguration(),
      vapidPublicKey: getPublicVapidKey(),
      remindersEnabled: user.reminders_enabled !== false,
      subscriptionCount: subscriptions.length,
      schedulerReady: Boolean(process.env.NOTIFICATIONS_CRON_TOKEN),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el estado de notificaciones" });
  }
});

function parseNotificationRow(row) {
  const payload = row.payload || {};
  const data = payload.data || {};

  return {
    id: row.id,
    title: payload.title || "Rodado Control",
    body: payload.body || "Notificacion",
    type: row.notification_type,
    stage: row.stage || "",
    vehicleId: row.vehicle_id || data.vehicleId || null,
    maintenanceId: row.maintenance_id || data.maintenanceId || null,
    url: data.url || payload.url || "/",
    createdAt: row.last_sent_at || row.created_at || null,
    readAt: row.read_at || null,
    unread: !row.read_at,
  };
}

async function ensureReminderNotificationEvents(userId) {
  const user = await getUserNotificationPreferences(userId);

  if (!user || user.reminders_enabled === false) {
    return { candidates: 0 };
  }

  const rows = await fetchUserReminderRows(pool, userId);
  let candidatesCount = 0;

  for (const vehicle of rows) {
    const reminder = normalizeReminder(vehicle);

    for (const candidate of buildReminderCandidates(reminder)) {
      candidatesCount += 1;
      await upsertNotificationEvent(pool, {
        userId,
        vehicleId: reminder.vehicleId,
        notificationType: candidate.type,
        dedupeKey: candidate.dedupeKey,
        payload: candidate.notification,
        stage: candidate.stage,
        dueSnapshot: candidate.dueSnapshot,
      });
    }
  }

  return { candidates: candidatesCount };
}

function parsePagination(query) {
  const limitValue = query.limit === undefined ? 10 : Number(query.limit);
  const offsetValue = query.offset === undefined ? 0 : Number(query.offset);
  const filter = String(query.filter || "all").trim().toLowerCase();

  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) {
    return { error: "limit invalido" };
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0) {
    return { error: "offset invalido" };
  }
  if (!["all", "unread"].includes(filter)) {
    return { error: "filter invalido" };
  }

  return { limit: limitValue, offset: offsetValue, filter };
}

router.get("/", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const pagination = parsePagination(req.query);

    if (pagination.error) {
      return res.status(400).json({ error: pagination.error });
    }

    await ensureReminderNotificationEvents(userId);

    const whereParts = ["user_id = $1"];
    const values = [userId];
    if (pagination.filter === "unread") {
      whereParts.push("read_at IS NULL");
    }
    const whereClause = whereParts.join(" AND ");
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM push_notification_events
       WHERE ${whereClause}`,
      values
    );
    const unreadCountResult = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM push_notification_events
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    values.push(pagination.limit, pagination.offset);
    const result = await pool.query(
      `SELECT
        id,
        vehicle_id,
        maintenance_id,
        notification_type,
        stage,
        payload,
        created_at,
        last_sent_at,
        read_at
       FROM push_notification_events
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const notifications = result.rows.map(parseNotificationRow);
    const total = Number(totalResult.rows[0]?.total || 0);

    res.json({
      ok: true,
      notifications,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        hasMore: pagination.offset + notifications.length < total,
        total,
      },
      unreadCount: Number(unreadCountResult.rows[0]?.unread_count || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
});

router.patch("/read-all", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE push_notification_events
       SET read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    res.json({ ok: true, updated: result.rowCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al marcar notificaciones como leidas" });
  }
});

router.patch("/:id/read", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "notification_id invalido" });
    }

    const result = await pool.query(
      `UPDATE push_notification_events
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id, read_at`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Notificacion no encontrada" });
    }

    res.json({ ok: true, id: result.rows[0].id, readAt: result.rows[0].read_at });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al marcar la notificacion como leida" });
  }
});

router.post("/subscribe", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!hasPushConfiguration()) {
      return res.status(503).json({ error: "Push no configurado en el servidor" });
    }

    const saved = await saveSubscription(pool, {
      userId,
      subscription: req.body.subscription,
      deviceInfo: req.body.device_info,
    });

    res.status(201).json({
      ok: true,
      subscription: saved,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo guardar la suscripcion" });
  }
});

router.delete("/subscribe", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;

    const removed = await removeSubscription(pool, {
      userId,
      endpoint: req.body?.endpoint || req.query.endpoint,
    });

    res.json({
      ok: true,
      removed,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo eliminar la suscripcion" });
  }
});

router.post("/test", requireAuth(), async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sendPushToUser(pool, {
      userId,
      notification: buildNotificationPayload({
        title: "Notificaciones activadas",
        body: "Rodado Control ya puede enviarte notificaciones push reales.",
        type: "test",
        tag: "rodado-control-test",
        url: "/",
      }),
    });

    if (result.attempted === 0) {
      return res.status(400).json({ error: result.error || "No hay suscripciones activas" });
    }

    res.json({
      ok: true,
      delivery: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo enviar la notificacion de prueba" });
  }
});

router.post("/run-reminders", async (req, res) => {
  if (!requireCronToken(req, res)) {
    return;
  }

  try {
    const summary = await runReminderSweep(pool);
    res.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudieron procesar los recordatorios push" });
  }
});

module.exports = router;
