const fs = require("fs");
const path = require("path");
const pool = require("../src/db/connection");

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  if (!sql.trim()) return;
  await pool.query(sql);
}

async function run() {
  const schemaPath = path.join(__dirname, "../src/db/schema.sql");
  const migrationsDir = path.join(__dirname, "../src/db/migrations");
  const seedPath = path.join(__dirname, "../src/db/seed.sql");

  try {
    await runSqlFile(schemaPath);

    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        await runSqlFile(path.join(migrationsDir, file));
      }
    }

    await runSqlFile(seedPath);
    console.log("Database schema, migrations, and seed applied successfully.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Failed to apply database setup.");
  console.error(error);
  process.exit(1);
});
