const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validatePlacePayload } = require("../utils/validation");
const { logActivity } = require("../utils/activityLog");

async function recordActivity(details) {
  try {
    await logActivity(pool, details);
  } catch (error) {
    console.error("No se pudo registrar la actividad", error);
  }
}

// =====================
// GET /places
// =====================
router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `SELECT id, nombre, ubicacion, contacto_nombre, contacto_numero
       FROM lugares
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener lugares" });
  }
});


// =====================
// POST /places
// =====================
router.post("/", async (req, res) => {
  try {
    const { errors, data } = validatePlacePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const userId = Number(req.body.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const count = await pool.query(
  "SELECT COUNT(*) FROM lugares WHERE user_id = $1",
  [userId]
);

if (Number(count.rows[0].count) >= 30) {
  return res.status(400).json({ error: "Limite de lugares alcanzado" });
}

    const result = await pool.query(
      `INSERT INTO lugares (nombre, ubicacion, contacto_nombre, contacto_numero, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.nombre,
        data.ubicacion,
        data.contacto_nombre,
        data.contacto_numero,
        userId
      ]
    );

    await recordActivity({
      userId,
      action: "place.create",
      entityType: "place",
      entityId: result.rows[0].id,
      title: "Lugar creado",
      description: `Creaste el lugar "${result.rows[0].nombre}".`,
      metadata: { ubicacion: result.rows[0].ubicacion },
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear lugar" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const id = Number(req.params.id);

    const { nombre, ubicacion, contacto_nombre, contacto_numero } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `UPDATE lugares
       SET nombre = $1,
           ubicacion = $2,
           contacto_nombre = $3,
           contacto_numero = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [nombre, ubicacion, contacto_nombre, contacto_numero, id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Lugar no encontrado" });
    }

    await recordActivity({
      userId,
      action: "place.update",
      entityType: "place",
      entityId: result.rows[0].id,
      title: "Lugar actualizado",
      description: `Actualizaste el lugar "${result.rows[0].nombre}".`,
      metadata: { ubicacion: result.rows[0].ubicacion },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar lugar" });
  }
});

// =====================
// DELETE /places/:id
// =====================
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.query.user_id);
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "place_id invalido" });
    }

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    await client.query("BEGIN");

    const placeResult = await client.query(
      "SELECT id, nombre FROM lugares WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId]
    );

    if (placeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Lugar no encontrado" });
    }

    const usageResult = await client.query(
      `SELECT
         m.id AS maintenance_id,
         v.nombre AS vehicle_name,
         v.modelo AS vehicle_model
       FROM mantenimiento m
       JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE m.lugar_id = $1
         AND m.user_id = $2
       ORDER BY v.nombre ASC, v.modelo ASC, m.fecha DESC, m.id DESC`,
      [id, userId]
    );

    if (usageResult.rowCount > 0) {
      await client.query("ROLLBACK");

      const vehicles = [
        ...new Set(
          usageResult.rows.map((row) =>
            [row.vehicle_name, row.vehicle_model].filter(Boolean).join(" · ") || "Vehiculo sin nombre"
          )
        ),
      ];

      return res.status(409).json({
        error: "Lugar en uso",
        message: "No se puede eliminar este lugar porque está asociado a mantenimientos existentes.",
        vehicles,
      });
    }

    const deleteResult = await client.query(
      "DELETE FROM lugares WHERE id = $1 AND user_id = $2 RETURNING id, nombre",
      [id, userId]
    );

    await logActivity(client, {
      userId,
      action: "place.delete",
      entityType: "place",
      entityId: deleteResult.rows[0].id,
      title: "Lugar eliminado",
      description: `Eliminaste el lugar "${deleteResult.rows[0].nombre}".`,
    }).catch((error) => {
      console.error("No se pudo registrar la actividad", error);
    });

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback failures and surface the original error below.
    }
    console.error(error);
    res.status(500).json({
      error: "Error al eliminar lugar",
      message: "No se pudo eliminar el lugar. Intentalo nuevamente.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
