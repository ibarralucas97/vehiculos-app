const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { createPasswordHash, verifyPassword } = require("../utils/password");
const { validateRegisterPayload } = require("../utils/validation");

function buildFullName(user) {
  const parts = [user.nombre, user.apellido].filter(Boolean);
  return parts.join(" ").trim() || user.full_name || user.email;
}

function serializeAuthUser(user) {
  return {
    id: user.id,
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

router.post("/register", async (req, res) => {
  try {
    const { errors, data } = validateRegisterPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [data.email]);

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese email." });
    }

    const passwordHash = await createPasswordHash(data.password);
    const fullName = [data.nombre, data.apellido].filter(Boolean).join(" ").trim();
    const result = await pool.query(
      `INSERT INTO users (
        full_name,
        nombre,
        apellido,
        email,
        telefono,
        mileage_unit,
        reminders_enabled,
        password_hash,
        is_approved
      )
      VALUES ($1, $2, $3, $4, $5, 'km', TRUE, $6, FALSE)
      RETURNING
        id,
        full_name,
        nombre,
        apellido,
        email,
        telefono,
        profile_photo_url,
        mileage_unit,
        reminders_enabled,
        is_approved,
        created_at`,
      [fullName, data.nombre, data.apellido, data.email, data.telefono, passwordHash]
    );

    res.status(201).json({
      ok: true,
      message: "Cuenta creada. Tu usuario queda pendiente de aprobacion.",
      user: serializeAuthUser(result.rows[0]),
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe una cuenta con ese email." });
    }

    console.error(error);
    res.status(500).json({ error: "Error al crear la cuenta" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contrasena son obligatorios" });
    }

    const result = await pool.query(
      `SELECT
        id,
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
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (user.is_approved === false) {
      return res.status(403).json({ error: "Tu cuenta aun esta pendiente de aprobacion." });
    }

    res.json({
      ok: true,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

module.exports = router;
