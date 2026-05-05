const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { verifyPassword } = require("../utils/password");

function buildFullName(user) {
  const parts = [user.nombre, user.apellido].filter(Boolean);
  return parts.join(" ").trim() || user.full_name || user.email;
}

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

    res.json({
      ok: true,
      user: {
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
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

module.exports = router;
