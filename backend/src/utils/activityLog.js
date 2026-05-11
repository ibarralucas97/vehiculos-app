async function logActivity(db, {
  userId,
  action,
  entityType,
  entityId = null,
  title,
  description,
  metadata = null,
}) {
  if (!userId || !action || !entityType || !title || !description) {
    return null;
  }

  const result = await db.query(
    `INSERT INTO activity_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      title,
      description,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, created_at`,
    [
      userId,
      entityType,
      entityId,
      action,
      title,
      description,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  logActivity,
};
