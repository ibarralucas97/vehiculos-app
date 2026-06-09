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
const { runReminderSweep } = require("../utils/pushReminders");

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

router.get("/status", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

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

router.post("/subscribe", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

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

router.delete("/subscribe", async (req, res) => {
  try {
    const userId = Number(req.body?.user_id || req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

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

router.post("/test", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

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
