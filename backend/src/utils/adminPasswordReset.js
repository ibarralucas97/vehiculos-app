const { createPasswordHash } = require("./password");
const { validateNumericPassword, validateUsername } = require("./auth");

async function resetSuperadminPassword(pool, { username, password }) {
  const usernameValidation = validateUsername(username);
  const passwordValidation = validateNumericPassword(password, "Nueva clave temporal");

  if (usernameValidation.error) {
    throw new Error("ADMIN_RESET_USERNAME no es valido");
  }
  if (passwordValidation.error) {
    throw new Error("ADMIN_RESET_PASSWORD debe tener entre 6 y 10 digitos");
  }

  const userResult = await pool.query(
    `SELECT id, username, role
     FROM users
     WHERE LOWER(username) = LOWER($1)
       AND deleted_at IS NULL`,
    [usernameValidation.username]
  );
  const user = userResult.rows[0];

  if (!user || user.role !== "superadmin") {
    throw new Error("El usuario indicado no es un superadmin existente");
  }

  const passwordHash = await createPasswordHash(passwordValidation.password);
  const updateResult = await pool.query(
    `UPDATE users
     SET password_hash = $1,
         session_version = session_version + 1,
         must_change_password = TRUE,
         password_changed_at = NOW()
     WHERE id = $2
       AND role = 'superadmin'
       AND deleted_at IS NULL
     RETURNING id, username, session_version`,
    [passwordHash, user.id]
  );

  if (updateResult.rowCount === 0) {
    throw new Error("No se pudo resetear la clave del superadmin");
  }

  return {
    id: updateResult.rows[0].id,
    username: updateResult.rows[0].username,
    sessionVersion: Number(updateResult.rows[0].session_version || 0),
  };
}

module.exports = {
  resetSuperadminPassword,
};
