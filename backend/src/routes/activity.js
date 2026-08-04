const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);

    const result = await pool.query(
      `SELECT
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.title,
        al.description,
        al.metadata,
        al.created_at,
        COALESCE(NULLIF(TRIM(CONCAT(u.nombre, ' ', u.apellido)), ''), u.full_name, u.email) AS actor_name
       FROM activity_logs al
       JOIN users u ON u.id = al.user_id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorName: row.actor_name,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener la actividad" });
  }
});

module.exports = router;
