const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { createPasswordHash } = require("../utils/password");
const {
  validateAdminResetPasswordPayload,
  validateAdminUserPayload,
  validateAdminUserUpdatePayload,
} = require("../utils/validation");

function serializeAdminUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    email: row.email || "",
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    fullName: [row.nombre, row.apellido].filter(Boolean).join(" ").trim() || row.full_name || row.username,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    disabledAt: row.disabled_at,
    deletedAt: row.deleted_at,
  };
}

async function logAdminAction(client, { actorUserId, targetUserId, action, metadata = {} }) {
  await client.query(
    `INSERT INTO admin_audit_logs (actor_user_id, target_user_id, action, metadata)
     VALUES ($1, $2, $3, $4)`,
    [actorUserId, targetUserId, action, metadata]
  );
}

async function countActiveSuperadmins(client) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE role = 'superadmin'
       AND is_active = TRUE
       AND deleted_at IS NULL`
  );
  return Number(result.rows[0]?.count || 0);
}

router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const rawLimit = Number(req.query.limit || 25);
    const rawOffset = Number(req.query.offset || 0);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 25;
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    if (req.query.limit && (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50)) {
      return res.status(400).json({ error: "limit invalido" });
    }
    if (req.query.offset && (!Number.isInteger(rawOffset) || rawOffset < 0)) {
      return res.status(400).json({ error: "offset invalido" });
    }

    const values = [];
    let where = "deleted_at IS NULL";
    if (search) {
      values.push(`%${search}%`);
      where += ` AND username ILIKE $${values.length}`;
    }

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE ${where}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `SELECT id, username, role, is_active, must_change_password, email, nombre, apellido, full_name,
              created_at, last_login_at, disabled_at, deleted_at
       FROM users
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({
      ok: true,
      users: result.rows.map(serializeAdminUser),
      pagination: {
        limit,
        offset,
        total: Number(countResult.rows[0]?.total || 0),
        hasMore: offset + result.rowCount < Number(countResult.rows[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

router.post("/users", async (req, res) => {
  const client = await pool.connect();
  try {
    const { errors, data } = validateAdminUserPayload(req.body);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });
    if (data.role === "superadmin" && req.body.confirm_superadmin !== true) {
      return res.status(400).json({ error: "Debes confirmar la creacion de otro superadmin" });
    }

    const passwordHash = await createPasswordHash(data.password);
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users (
        username, role, is_active, must_change_password, password_hash, email, nombre, apellido, full_name, telefono,
        mileage_unit, reminders_enabled, is_approved
      )
      VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, 'km', TRUE, TRUE)
      RETURNING id, username, role, is_active, must_change_password, email, nombre, apellido, full_name,
                created_at, last_login_at, disabled_at, deleted_at`,
      [
        data.username,
        data.role,
        data.is_active,
        passwordHash,
        data.email,
        data.nombre,
        data.apellido,
        [data.nombre, data.apellido].filter(Boolean).join(" ").trim(),
        data.telefono || null,
      ]
    );

    await logAdminAction(client, {
      actorUserId: req.user.id,
      targetUserId: result.rows[0].id,
      action: "admin.user.create",
      metadata: { role: data.role, is_active: data.is_active },
    });
    await client.query("COMMIT");

    res.status(201).json({ ok: true, user: serializeAdminUser(result.rows[0]) });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe un usuario con ese nombre" });
    }
    console.error(error);
    res.status(500).json({ error: "Error al crear usuario" });
  } finally {
    client.release();
  }
});

router.patch("/users/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetUserId = Number(req.params.id);
    const { errors, data } = validateAdminUserUpdatePayload(req.body);
    if (!targetUserId) return res.status(400).json({ error: "user_id invalido" });
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No hay campos validos para actualizar" });

    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT id, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [targetUserId]
    );
    const currentUser = currentResult.rows[0];
    if (!currentUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (
      currentUser.role === "superadmin" &&
      currentUser.is_active === true &&
      data.role === "user" &&
      (await countActiveSuperadmins(client)) <= 1
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede quitar el ultimo superadmin activo" });
    }

    const sets = [];
    const values = [];
    if (data.username) {
      values.push(data.username);
      sets.push(`username = $${values.length}`);
    }
    if (data.role) {
      values.push(data.role);
      sets.push(`role = $${values.length}`);
      sets.push("session_version = session_version + 1");
    }
    values.push(targetUserId);
    const result = await client.query(
      `UPDATE users
       SET ${sets.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, username, role, is_active, must_change_password, email, nombre, apellido, full_name,
                 created_at, last_login_at, disabled_at, deleted_at`,
      values
    );

    await logAdminAction(client, {
      actorUserId: req.user.id,
      targetUserId,
      action: data.role ? "admin.user.role.update" : "admin.user.update",
      metadata: Object.keys(data).reduce((safe, key) => ({ ...safe, [key]: data[key] }), {}),
    });
    await client.query("COMMIT");
    res.json({ ok: true, user: serializeAdminUser(result.rows[0]) });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe un usuario con ese nombre" });
    }
    console.error(error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  } finally {
    client.release();
  }
});

router.patch("/users/:id/status", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetUserId = Number(req.params.id);
    const isActive = req.body?.is_active === true;
    if (!targetUserId) return res.status(400).json({ error: "user_id invalido" });
    if (targetUserId === req.user.id && !isActive) {
      return res.status(400).json({ error: "No podes desactivar tu propio usuario" });
    }

    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT id, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [targetUserId]
    );
    const currentUser = currentResult.rows[0];
    if (!currentUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (!isActive && currentUser.role === "superadmin" && (await countActiveSuperadmins(client)) <= 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede desactivar el ultimo superadmin activo" });
    }

    const result = await client.query(
      `UPDATE users
       SET is_active = $1,
           disabled_at = CASE WHEN $1 = FALSE THEN NOW() ELSE NULL END,
           session_version = session_version + 1
       WHERE id = $2
       RETURNING id, username, role, is_active, must_change_password, email, nombre, apellido, full_name,
                 created_at, last_login_at, disabled_at, deleted_at`,
      [isActive, targetUserId]
    );
    await logAdminAction(client, {
      actorUserId: req.user.id,
      targetUserId,
      action: isActive ? "admin.user.activate" : "admin.user.deactivate",
    });
    await client.query("COMMIT");
    res.json({ ok: true, user: serializeAdminUser(result.rows[0]) });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    console.error(error);
    res.status(500).json({ error: "Error al cambiar estado del usuario" });
  } finally {
    client.release();
  }
});

router.patch("/users/:id/reset-password", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetUserId = Number(req.params.id);
    const { errors, data } = validateAdminResetPasswordPayload(req.body);
    if (!targetUserId) return res.status(400).json({ error: "user_id invalido" });
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    const passwordHash = await createPasswordHash(data.password);
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = TRUE,
           password_changed_at = NOW(),
           session_version = session_version + 1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, username, role, is_active, must_change_password, email, nombre, apellido, full_name,
                 created_at, last_login_at, disabled_at, deleted_at`,
      [passwordHash, targetUserId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    await logAdminAction(client, {
      actorUserId: req.user.id,
      targetUserId,
      action: "admin.user.password.reset",
    });
    await client.query("COMMIT");
    res.json({ ok: true, user: serializeAdminUser(result.rows[0]) });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    console.error(error);
    res.status(500).json({ error: "Error al blanquear clave" });
  } finally {
    client.release();
  }
});

router.delete("/users/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetUserId = Number(req.params.id);
    if (!targetUserId) return res.status(400).json({ error: "user_id invalido" });
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: "No podes eliminar tu propio usuario" });
    }

    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT id, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [targetUserId]
    );
    const currentUser = currentResult.rows[0];
    if (!currentUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (currentUser.role === "superadmin" && currentUser.is_active === true && (await countActiveSuperadmins(client)) <= 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede eliminar el ultimo superadmin activo" });
    }

    const relatedResult = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM vehiculos WHERE user_id = $1) AS vehicles,
        (SELECT COUNT(*)::int FROM mantenimiento WHERE user_id = $1) AS maintenance,
        (SELECT COUNT(*)::int FROM lugares WHERE user_id = $1) AS places,
        (SELECT COUNT(*)::int FROM push_subscriptions WHERE user_id = $1) AS subscriptions,
        (SELECT COUNT(*)::int FROM push_notification_events WHERE user_id = $1) AS notifications`,
      [targetUserId]
    );
    const related = relatedResult.rows[0];
    const hasRelatedData = Object.values(related).some((count) => Number(count) > 0);
    if (hasRelatedData) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "No se puede eliminar fisicamente un usuario con datos asociados. Desactivalo para conservar la informacion.",
        related,
      });
    }

    await logAdminAction(client, {
      actorUserId: req.user.id,
      targetUserId,
      action: "admin.user.delete",
    });
    await client.query("DELETE FROM users WHERE id = $1", [targetUserId]);
    await client.query("COMMIT");
    res.json({ ok: true, id: targetUserId });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    console.error(error);
    res.status(500).json({ error: "Error al eliminar usuario" });
  } finally {
    client.release();
  }
});

module.exports = router;
