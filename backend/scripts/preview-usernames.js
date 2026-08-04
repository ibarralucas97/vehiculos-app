require("dotenv").config();
const pool = require("../src/db/connection");

function buildBaseUsername(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const cleaned = localPart.replace(/[^A-Za-z0-9._-]/g, "_").toLowerCase();
  return /^[A-Za-z0-9._-]{3,32}$/.test(cleaned) ? cleaned.slice(0, 20) : "usuario";
}

async function main() {
  const result = await pool.query("SELECT id, email FROM users ORDER BY id");
  const collisions = new Map();

  const preview = result.rows.map((row) => {
    const baseUsername = buildBaseUsername(row.email);
    const collisionIndex = (collisions.get(baseUsername) || 0) + 1;
    collisions.set(baseUsername, collisionIndex);

    return {
      id: row.id,
      email: row.email,
      generatedUsername: collisionIndex === 1 ? baseUsername : `${baseUsername}_${row.id}`,
      userIdPreserved: row.id,
    };
  });

  console.table(preview);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
