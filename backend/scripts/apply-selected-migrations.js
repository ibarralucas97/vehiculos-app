require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/connection");

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    throw new Error("Indica al menos un archivo SQL de migracion");
  }

  for (const file of files) {
    const resolvedPath = path.resolve(process.cwd(), file);
    const migrationsDir = path.resolve(__dirname, "../src/db/migrations");

    if (!resolvedPath.startsWith(`${migrationsDir}${path.sep}`)) {
      throw new Error(`Archivo fuera de migrations no permitido: ${file}`);
    }
    if (!fs.existsSync(resolvedPath) || !resolvedPath.endsWith(".sql")) {
      throw new Error(`Migracion invalida: ${file}`);
    }

    const sql = fs.readFileSync(resolvedPath, "utf8");
    if (sql.trim()) {
      await pool.query(sql);
    }
    console.log(`Migracion aplicada: ${path.basename(resolvedPath)}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
