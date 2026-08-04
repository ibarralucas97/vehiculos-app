const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { createPasswordHash, verifyPassword } = require("../utils/password");
const {
  validatePasswordChangePayload,
  validateUserPreferencesPayload,
  validateUserProfilePayload,
} = require("../utils/validation");
const { uploadImageToCloudinary } = require("../utils/imageUploads");

function parseUserRow(row) {
  const nombre = row.nombre || "";
  const apellido = row.apellido || "";
  const fullName = [nombre, apellido].filter(Boolean).join(" ").trim() || row.full_name || row.email;

  return {
    id: row.id,
    username: row.username || "",
    role: row.role || "user",
    mustChangePassword: row.must_change_password === true,
    nombre,
    apellido,
    fullName,
    email: row.email,
    telefono: row.telefono || "",
    profilePhotoUrl: row.profile_photo_url || "",
    mileageUnit: row.mileage_unit || "km",
    remindersEnabled: row.reminders_enabled !== false,
    createdAt: row.created_at,
  };
}

async function getUserById(userId) {
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
      created_at,
      password_hash
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  return result.rows[0] || null;
}

router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(parseUserRow(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el perfil" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const { errors, data } = validateUserProfilePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const fullName = `${data.nombre} ${data.apellido}`.trim();
    const result = await pool.query(
      `UPDATE users
       SET nombre = $1,
           apellido = $2,
           full_name = $3,
           email = $4,
           telefono = $5
       WHERE id = $6
         AND deleted_at IS NULL
       RETURNING
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
         created_at`,
      [
        data.nombre,
        data.apellido,
        fullName,
        data.email,
        data.telefono || null,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      ok: true,
      user: parseUserRow(result.rows[0]),
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(400).json({ error: "El email ya esta en uso" });
    }

    console.error(error);
    res.status(500).json({ error: "Error al actualizar el perfil" });
  }
});

router.post("/profile/photo", async (req, res) => {
  try {
    const userId = req.user.id;

    const existingUser = await getUserById(userId);

    if (!existingUser) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const upload = await uploadImageToCloudinary({
      dataUrl: req.body.image_data_url,
      fileName: req.body.file_name,
      folder: "rodado-control/profile",
    });

    const result = await pool.query(
      `UPDATE users
       SET profile_photo_url = $1
       WHERE id = $2
       RETURNING
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
         created_at`,
      [upload.secureUrl, userId]
    );

    res.json({
      ok: true,
      image: {
        secureUrl: upload.secureUrl,
        publicId: upload.publicId,
      },
      user: parseUserRow(result.rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "No se pudo subir la foto de perfil" });
  }
});

router.put("/preferences", async (req, res) => {
  try {
    const userId = req.user.id;
    const { errors, data } = validateUserPreferencesPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await pool.query(
      `UPDATE users
       SET mileage_unit = $1,
           reminders_enabled = $2
       WHERE id = $3
         AND deleted_at IS NULL
       RETURNING
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
         created_at`,
      [data.mileage_unit, data.reminders_enabled, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      ok: true,
      user: parseUserRow(result.rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar las preferencias" });
  }
});

router.post("/password", async (req, res) => {
  try {
    const userId = req.user.id;
    const { errors, data } = validatePasswordChangePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const currentPasswordMatches = await verifyPassword(data.current_password, user.password_hash);

    if (!currentPasswordMatches) {
      return res.status(400).json({ error: "La contrasena actual es incorrecta" });
    }

    const passwordHash = await createPasswordHash(data.new_password);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = FALSE,
           password_changed_at = NOW(),
           session_version = session_version + 1
       WHERE id = $2`,
      [passwordHash, userId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al cambiar la contrasena" });
  }
});

module.exports = router;
