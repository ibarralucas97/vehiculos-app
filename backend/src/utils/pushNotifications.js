const webpush = require("web-push");

const DEFAULT_TITLE = "Rodado Control";
const DEFAULT_ICON = "/icon-192.png";
const DEFAULT_BADGE = "/icon-192.png";

let vapidReady = false;

function hasPushConfiguration() {
  return Boolean(
    process.env.PUSH_VAPID_SUBJECT &&
      process.env.PUSH_VAPID_PUBLIC_KEY &&
      process.env.PUSH_VAPID_PRIVATE_KEY
  );
}

function configureWebPush() {
  if (!hasPushConfiguration()) {
    return false;
  }

  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.PUSH_VAPID_SUBJECT,
      process.env.PUSH_VAPID_PUBLIC_KEY,
      process.env.PUSH_VAPID_PRIVATE_KEY
    );
    vapidReady = true;
  }

  return true;
}

function getPublicVapidKey() {
  return process.env.PUSH_VAPID_PUBLIC_KEY || "";
}

function sanitizeString(value, maxLength = 1024) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDeviceInfo(deviceInfo = {}) {
  return {
    userAgent: sanitizeString(deviceInfo.userAgent, 600),
    platform: sanitizeString(deviceInfo.platform, 120),
    language: sanitizeString(deviceInfo.language, 40),
    viewport: sanitizeString(deviceInfo.viewport, 40),
    standalone: Boolean(deviceInfo.standalone),
    source: sanitizeString(deviceInfo.source, 60),
  };
}

function normalizeSubscriptionPayload(subscription = {}) {
  const endpoint = sanitizeString(subscription.endpoint, 2048);
  const p256dh = sanitizeString(subscription.keys?.p256dh, 512);
  const auth = sanitizeString(subscription.keys?.auth, 512);

  if (!endpoint || !p256dh || !auth) {
    return { error: "La suscripcion push es invalida", data: null };
  }

  return {
    error: null,
    data: {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    },
  };
}

function buildNotificationPayload({
  title = DEFAULT_TITLE,
  body = "",
  url = "/",
  tag = "rodado-control",
  type = "general",
  data = {},
  renotify = false,
} = {}) {
  return {
    title,
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag,
    renotify,
    data: {
      url,
      type,
      ...data,
    },
  };
}

async function ensureUserExists(pool, userId) {
  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return result.rowCount > 0;
}

async function saveSubscription(pool, { userId, subscription, deviceInfo = {} }) {
  const normalized = normalizeSubscriptionPayload(subscription);

  if (normalized.error) {
    throw new Error(normalized.error);
  }

  const exists = await ensureUserExists(pool, userId);
  if (!exists) {
    throw new Error("Usuario no encontrado");
  }

  const result = await pool.query(
    `INSERT INTO push_subscriptions (
      user_id,
      endpoint,
      p256dh_key,
      auth_key,
      device_info,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh_key = EXCLUDED.p256dh_key,
      auth_key = EXCLUDED.auth_key,
      device_info = EXCLUDED.device_info,
      updated_at = NOW()
    RETURNING id, endpoint, created_at, updated_at`,
    [
      userId,
      normalized.data.endpoint,
      normalized.data.keys.p256dh,
      normalized.data.keys.auth,
      JSON.stringify(normalizeDeviceInfo(deviceInfo)),
    ]
  );

  return result.rows[0];
}

async function removeSubscription(pool, { userId, endpoint }) {
  const normalizedEndpoint = sanitizeString(endpoint, 2048);
  if (!normalizedEndpoint) {
    throw new Error("endpoint requerido");
  }

  const result = await pool.query(
    `DELETE FROM push_subscriptions
     WHERE user_id = $1
       AND endpoint = $2
     RETURNING id`,
    [userId, normalizedEndpoint]
  );

  return result.rowCount;
}

async function getSubscriptionsByUser(pool, userId) {
  const result = await pool.query(
    `SELECT id, endpoint, p256dh_key, auth_key, device_info, created_at, updated_at
     FROM push_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC, id DESC`,
    [userId]
  );

  return result.rows;
}

async function removeSubscriptionById(pool, id) {
  await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [id]);
}

async function sendPushToSubscriptions(pool, subscriptions, notification) {
  if (!configureWebPush()) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      pruned: 0,
      error: "Push no configurado en el servidor",
    };
  }

  if (!subscriptions.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      pruned: 0,
      error: "No hay suscripciones activas",
    };
  }

  const payload = JSON.stringify(notification);
  let sent = 0;
  let failed = 0;
  let pruned = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        },
        payload
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error.statusCode || 0);

      if (statusCode === 404 || statusCode === 410) {
        await removeSubscriptionById(pool, subscription.id);
        pruned += 1;
        continue;
      }

      failed += 1;
      console.error("Push delivery failed", {
        subscriptionId: subscription.id,
        statusCode,
        message: error.message,
      });
    }
  }

  return {
    attempted: subscriptions.length,
    sent,
    failed,
    pruned,
    error: null,
  };
}

async function sendPushToUser(pool, { userId, notification }) {
  const subscriptions = await getSubscriptionsByUser(pool, userId);
  return sendPushToSubscriptions(pool, subscriptions, notification);
}

module.exports = {
  buildNotificationPayload,
  configureWebPush,
  getPublicVapidKey,
  getSubscriptionsByUser,
  hasPushConfiguration,
  normalizeDeviceInfo,
  normalizeSubscriptionPayload,
  removeSubscription,
  saveSubscription,
  sendPushToSubscriptions,
  sendPushToUser,
};
