const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { createPasswordHash, verifyPassword } = require("../utils/password");
const {
  clearSessionCookie,
  issueSession,
  validateNumericPassword,
  validateUsername,
} = require("../utils/auth");
const { requireAuth } = require("../middleware/auth");

const LOGIN_ATTEMPTS = new Map();
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "Usuario o clave invalidos";

function buildFullName(user) {
  const parts = [user.nombre, user.apellido].filter(Boolean);
  return parts.join(" ").trim() || user.full_name || user.email;
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    username: user.username || "",
    role: user.role || "user",
    mustChangePassword: user.must_change_password === true,
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    fullName: buildFullName(user),
    email: user.email,
    telefono: user.telefono || "",
    profilePhotoUrl: user.profile_photo_url || "",
    mileageUnit: user.mileage_unit || "km",
    remindersEnabled: user.reminders_enabled !== false,
    createdAt: user.created_at,
  };
}

function getLoginAttemptKey(req, username) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(username || "").toLowerCase()}`;
}

function getLoginAttemptState(key) {
  const now = Date.now();
  const state = LOGIN_ATTEMPTS.get(key);
  if (!state || state.resetAt <= now) {
    return { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  }
  return state;
}

function registerFailedLogin(key) {
  const state = getLoginAttemptState(key);
  LOGIN_ATTEMPTS.set(key, { count: state.count + 1, resetAt: state.resetAt });
}

function isLoginBlocked(key) {
  const state = getLoginAttemptState(key);
  return state.count >= MAX_FAILED_LOGIN_ATTEMPTS;
}

router.post("/register", (_req, res) => {
  res.status(403).json({
    error: "El registro publico esta deshabilitado. Un superadmin debe crear el usuario desde Administracion.",
  });
});

router.post("/login", async (req, res) => {
  try {
    const usernameValidation = validateUsername(req.body.username);
    const passwordValidation = validateNumericPassword(req.body.password, "Clave numerica");
    const username = usernameValidation.username;
    const password = passwordValidation.password;
    const attemptKey = getLoginAttemptKey(req, username);

    if (usernameValidation.error || passwordValidation.error) {
      registerFailedLogin(attemptKey);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (isLoginBlocked(attemptKey)) {
      return res.status(429).json({ error: "Demasiados intentos. Intenta nuevamente en unos minutos." });
    }

    const result = await pool.query(
      `SELECT
        id,
        username,
        role,
        is_active,
        must_change_password,
        session_version,
        full_name,
        nombre,
        apellido,
        email,
        telefono,
        profile_photo_url,
        mileage_unit,
        reminders_enabled,
        is_approved,
        created_at,
        password_hash
       FROM users
       WHERE LOWER(username) = LOWER($1)
         AND deleted_at IS NULL`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      registerFailedLogin(attemptKey);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      registerFailedLogin(attemptKey);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.is_active === false) {
      registerFailedLogin(attemptKey);
      return res.status(403).json({ error: "La cuenta no esta habilitada." });
    }

    LOGIN_ATTEMPTS.delete(attemptKey);
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);
    issueSession(res, user);

    res.json({
      ok: true,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth({ allowPasswordChangeRequired: true }), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        username,
        role,
        must_change_password,
        full_name,
        nombre,
        apellido,
        email,
        telefono,
        profile_photo_url,
        mileage_unit,
        reminders_enabled,
        created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    res.json({ ok: true, user: serializeAuthUser(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener la sesion" });
  }
});

router.post("/change-password", requireAuth({ allowPasswordChangeRequired: true }), async (req, res) => {
  try {
    const currentValidation = validateNumericPassword(req.body.current_password, "Clave actual");
    const newValidation = validateNumericPassword(req.body.new_password, "Nueva clave");
    const confirmPassword = String(req.body.confirm_password || "").trim();

    if (currentValidation.error || newValidation.error || confirmPassword !== newValidation.password) {
      return res.status(400).json({ error: "Las claves numericas no son validas o no coinciden" });
    }

    if (currentValidation.password === newValidation.password) {
      return res.status(400).json({ error: "La nueva clave debe ser distinta a la actual" });
    }

    const userResult = await pool.query("SELECT id, password_hash FROM users WHERE id = $1", [req.user.id]);
    const user = userResult.rows[0];
    const currentPasswordMatches = await verifyPassword(currentValidation.password, user?.password_hash);

    if (!currentPasswordMatches) {
      return res.status(400).json({ error: "La clave actual es incorrecta" });
    }

    const passwordHash = await createPasswordHash(newValidation.password);
    const updateResult = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = FALSE,
           password_changed_at = NOW(),
           session_version = session_version + 1
       WHERE id = $2
       RETURNING id, username, role, must_change_password, session_version, full_name, nombre, apellido, email, telefono, profile_photo_url, mileage_unit, reminders_enabled, created_at`,
      [passwordHash, req.user.id]
    );

    issueSession(res, updateResult.rows[0]);
    res.json({ ok: true, user: serializeAuthUser(updateResult.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al cambiar la clave" });
  }
});

module.exports = router;
