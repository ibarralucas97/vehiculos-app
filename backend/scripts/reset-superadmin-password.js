require("dotenv").config();
const pool = require("../src/db/connection");
const { resetSuperadminPassword } = require("../src/utils/adminPasswordReset");

async function main() {
  const username = process.env.ADMIN_RESET_USERNAME;
  const password = process.env.ADMIN_RESET_PASSWORD || process.env.ADMIN_RESET_NEW_PASSWORD;

  const result = await resetSuperadminPassword(pool, { username, password });

  console.log(`Clave temporal reseteada para superadmin id=${result.id}, username=${result.username}`);
  console.log("La clave temporal no se muestra. Eliminá ADMIN_RESET_PASSWORD / ADMIN_RESET_NEW_PASSWORD despues de usarla.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
