require("dotenv").config();
const pool = require("../src/db/connection");
const { createPasswordHash } = require("../src/utils/password");
const { validateNumericPassword, validateUsername } = require("../src/utils/auth");

async function main() {
  const usernameValidation = validateUsername(process.env.BOOTSTRAP_ADMIN_USERNAME);
  const passwordValidation = validateNumericPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD, "BOOTSTRAP_ADMIN_PASSWORD");

  if (usernameValidation.error) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME no es valido");
  }
  if (passwordValidation.error) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD debe tener entre 6 y 10 digitos");
  }

  const superadminResult = await pool.query(
    "SELECT id FROM users WHERE role = 'superadmin' AND deleted_at IS NULL LIMIT 1"
  );
  if (superadminResult.rowCount > 0) {
    throw new Error("Ya existe un superadmin. No se modifico ningun usuario.");
  }

  const existingUsername = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [
    usernameValidation.username,
  ]);
  if (existingUsername.rowCount > 0) {
    throw new Error("El username indicado ya existe.");
  }

  const passwordHash = await createPasswordHash(passwordValidation.password);
  const result = await pool.query(
    `INSERT INTO users (
      username, role, is_active, must_change_password, password_changed_at,
      password_hash, full_name, nombre, apellido, email, mileage_unit, reminders_enabled, is_approved
    )
    VALUES ($1, 'superadmin', TRUE, TRUE, NOW(), $2, $3, $4, $5, $6, 'km', TRUE, TRUE)
    RETURNING id, username`,
    [
      usernameValidation.username,
      passwordHash,
      process.env.BOOTSTRAP_ADMIN_FULL_NAME || "Superadmin",
      process.env.BOOTSTRAP_ADMIN_NAME || "",
      process.env.BOOTSTRAP_ADMIN_LAST_NAME || "",
      process.env.BOOTSTRAP_ADMIN_EMAIL || null,
    ]
  );

  console.log(`Superadmin creado: id=${result.rows[0].id}, username=${result.rows[0].username}`);
  console.log("El valor de BOOTSTRAP_ADMIN_PASSWORD no se muestra. Eliminá la variable temporal despues del bootstrap.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
