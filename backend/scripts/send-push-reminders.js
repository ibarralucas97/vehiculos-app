require("dotenv").config();
const pool = require("../src/db/connection");
const { runReminderSweep } = require("../src/utils/pushReminders");

async function run() {
  try {
    const summary = await runReminderSweep(pool);
    console.log("Push reminder sweep completed", summary);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Push reminder sweep failed");
  console.error(error);
  process.exit(1);
});
