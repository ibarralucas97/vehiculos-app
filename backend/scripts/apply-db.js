const fs = require("fs");
const path = require("path");
const pool = require("../src/db/connection");

async function run() {
  const schemaPath = path.join(__dirname, "../src/db/schema.sql");
  const seedPath = path.join(__dirname, "../src/db/seed.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const seedSql = fs.readFileSync(seedPath, "utf8");

  try {
    await pool.query(schemaSql);
    await pool.query(seedSql);
    console.log("Database schema and seed applied successfully.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Failed to apply database setup.");
  console.error(error);
  process.exit(1);
});
