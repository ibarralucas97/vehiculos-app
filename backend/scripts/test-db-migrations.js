// Owns a fresh PostgreSQL cluster. Never accepts a database URL or an existing cluster.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { execute, connectionConfig, validateTransactionalSql } = require("./db-migrations");

const BACKEND = path.resolve(__dirname, "..");
const cleanEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C", LC_ALL: "C" };

function config(root, database = "migration_test") {
  return { host: path.join(root, "socket"), port: 55439, database,
    user: "rodado_migration_test", password: () => "", ssl: false, connectionTimeoutMillis: 3000,
    options: "-c search_path=public", application_name: "rodado-migration-tests" };
}

async function assertSearchPath(client) {
  assert.equal((await client.query("SHOW search_path")).rows[0].search_path, "public");
  const result = (await client.query(`SELECT array_to_json(current_schemas(TRUE)) AS effective,
    current_schema() AS creation_schema`)).rows[0];
  assert.deepEqual(result.effective, ["pg_catalog", "public"]);
  assert.equal(result.creation_schema, "public");
}

async function structure(client) {
  return {
    columns: (await client.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows,
    indexes: (await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows,
    constraints: (await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname`)).rows,
  };
}

async function connect(root, database) {
  const client = new Client(config(root, database));
  try {
    await client.connect();
    // Check effective server identity before any application SQL.
    assert.equal((await client.query("SHOW data_directory")).rows[0].data_directory, path.join(root, "data"));
    assert.equal((await client.query("SHOW listen_addresses")).rows[0].listen_addresses, "");
    assert.equal((await client.query("SELECT inet_server_addr() AS address")).rows[0].address, null);
    return client;
  } catch (error) { await client.end(); throw error; }
}

function child(args, env = cleanEnv) {
  const process = spawn(global.process.execPath, args, { cwd: BACKEND, env, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let output = "";
  process.stdout.on("data", (chunk) => { output += chunk; });
  process.stderr.on("data", (chunk) => { output += chunk; });
  const done = new Promise((resolve, reject) => {
    process.on("error", reject);
    process.on("exit", (code) => resolve({ code, output }));
  });
  return { process, done };
}

async function worker() {
  const root = process.argv[3];
  assert.ok(root.startsWith(path.join(os.tmpdir(), "rodado-migrations-")));
  const client = await connect(root);
  try {
    const query = client.query.bind(client);
    client.query = async (...args) => {
      const result = await query(...args);
      if (String(args[0]).includes("pg_try_advisory_lock") && result.rows[0].acquired) {
        process.send("locked");
        // Deliberately hold lock until the parent has tested a competing process.
        await new Promise((resolve) => process.once("message", resolve));
      }
      return result;
    };
    console.log(JSON.stringify(await execute(client, "migrate", { dbDir: path.join(root, "catalog") })));
  } finally { await client.end(); }
}

async function main() {
  assert.throws(() => connectionConfig({ DATABASE_URL: "ignored", PGHOST: "ignored" }), /Configurar/);
  for (const sql of [
    "END;", "end", "END WORK;", "END TRANSACTION AND CHAIN;",
    "/* comment */ END;", "SELECT 1; -- comment\n END;",
    "SELECT CASE WHEN TRUE THEN 1 ELSE 0 END; /* nested /* x */ y */ END;",
    "SELECT CASE WHEN TRUE THEN 1 END; COMMIT;", "ROLLBACK;",
    "BEGIN;", "ABORT;", "SAVEPOINT point;", "RELEASE SAVEPOINT point;",
    "PREPARE TRANSACTION 'test';", "VACUUM;", "START TRANSACTION;",
    "CREATE INDEX CONCURRENTLY x ON t(id);", "CREATE DATABASE test;",
    "DROP DATABASE test;", "ALTER SYSTEM SET work_mem='4MB';",
  ]) {
    assert.throws(() => validateTransactionalSql(sql, "test.sql"), /no admitido/, sql);
  }
  for (const sql of [
    "SELECT CASE WHEN TRUE THEN 1 ELSE 0 END;",
    "SELECT CASE 1 WHEN 1 THEN CASE WHEN TRUE THEN 2 ELSE 3 END ELSE 4 END;",
    "UPDATE t SET value = CASE WHEN value IS NULL THEN 0 ELSE value END;",
    "SELECT CASE WHEN TRUE THEN 'END; COMMIT;' ELSE 'ROLLBACK' END;",
    "SELECT CASE WHEN TRUE THEN 1 /* END; */ ELSE 0 END; SELECT 2;",
    "SELECT CASE WHEN TRUE THEN 1 END -- END;\n;",
  ]) {
    assert.doesNotThrow(() => validateTransactionalSql(sql, "test.sql"), sql);
  }
  validateTransactionalSql("DO $$ BEGIN PERFORM 1; END $$; SELECT 'COMMIT';", "test.sql");
  console.log("PASS configuracion sin fallback y politica transaccional");
  console.log("PASS D01 CASE simple/anidado admitido; END autonomo y controles prohibidos rechazados");
  const bin = process.env.TEST_PG_BIN;
  if (!bin || !fs.existsSync(path.join(bin, "initdb")) || !fs.existsSync(path.join(bin, "pg_ctl"))) {
    throw new Error("TEST_PG_BIN debe indicar binarios PostgreSQL locales. No se uso ninguna base existente.");
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rodado-migrations-"));
  fs.chmodSync(root, 0o700);
  fs.mkdirSync(path.join(root, "socket"), { mode: 0o700 });
  const env = { ...cleanEnv };
  // Optional extracted libraries, never database or application environment variables.
  if (process.env.TEST_PG_LIB) env.LD_LIBRARY_PATH = process.env.TEST_PG_LIB;
  const data = path.join(root, "data");
  let started = false;
  let client;
  const children = [];
  function pg(tool, args) {
    const result = spawnSync(path.join(bin, tool), args, { env, encoding: "utf8" });
    const log = path.join(root, "postgres.log");
    const detail = result.status !== 0 && fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
    assert.equal(result.status, 0, `${tool}: ${result.stderr || result.stdout}\n${detail}`);
  }
  try {
    pg("initdb", ["-D", data, "--username=rodado_migration_test", "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8"]);
    pg("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"), "-o", `-F -h '' -k ${path.join(root, "socket")} -p 55439`, "-w", "start"]);
    started = true;
    const admin = await connect(root, "postgres");
    try {
      await admin.query("CREATE DATABASE migration_test");
      await admin.query("CREATE DATABASE preexisting_test");
    } finally { await admin.end(); }
    client = await connect(root);
    console.log("PASS destino: cluster propio, socket privado, TCP deshabilitado");

    const cliEnv = { ...cleanEnv, MIGRATION_DB_HOST: config(root).host, MIGRATION_DB_PORT: "55439",
      MIGRATION_DB_NAME: "migration_test", MIGRATION_DB_USER: config(root).user,
      MIGRATION_DB_CONFIRM: `${config(root).host}:55439/migration_test` };
    const startupClient = new Client(connectionConfig(cliEnv));
    try {
      await startupClient.connect();
      assert.equal((await startupClient.query("SHOW data_directory")).rows[0].data_directory, data);
      await assertSearchPath(startupClient);
    } finally { await startupClient.end(); }
    async function cli(script, args = []) {
      const result = await child([path.join(__dirname, script), ...args], cliEnv).done;
      assert.equal(result.code, 0, result.output);
      return result.output;
    }
    await cli("apply-db.js");
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename);
    assert.deepEqual(tables, ["activity_logs","admin_audit_logs","lugares","maintenance_images","maintenance_plans","mantenimiento","push_notification_events","push_subscriptions","schema_migrations","users","vehiculos"]);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM users")).rows[0].n, 0);
    const indexes = (await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).rows.map((r) => r.indexname);
    for (const name of ["idx_users_username_lower_unique", "idx_maintenance_images_maintenance_id", "idx_maintenance_plans_user_vehicle", "idx_mantenimiento_plan_latest", "idx_push_notification_events_plan", "idx_push_notification_events_user_read"]) assert.ok(indexes.includes(name), name);
    const columns = (await client.query("SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema='public'")).rows;
    for (const [table, column] of [["users","username"],["users","session_version"],["vehiculos","km_updated_at"],["vehiculos","photo_url"],["mantenimiento","maintenance_plan_id"],["push_notification_events","read_at"],["maintenance_plans","next_service_date"]]) assert.ok(columns.some((r) => r.table_name === table && r.column_name === column));
    assert.equal(columns.find((r) => r.table_name === "users" && r.column_name === "username").is_nullable, "NO");
    const constraints = (await client.query("SELECT conname,confdeltype FROM pg_constraint WHERE connamespace='public'::regnamespace")).rows;
    for (const name of ["users_role_check","users_username_format_check","maintenance_images_source_check","maintenance_plans_interval_check","maintenance_plans_km_check","maintenance_plans_time_check"]) assert.ok(constraints.some((r) => r.conname === name), name);
    assert.equal(constraints.find((r) => r.conname === "mantenimiento_lugar_id_fkey").confdeltype, "a");
    assert.equal(constraints.find((r) => r.conname === "mantenimiento_maintenance_plan_id_fkey").confdeltype, "n");
    console.log("PASS 1 bootstrap CLI: tablas, columnas, indices, constraints; sin demo");

    await client.query("INSERT INTO users(full_name,username,password_hash,is_active,is_approved) VALUES ('Fixture','fixture','not-a-login-hash',FALSE,TRUE)");
    const before = (await client.query("SELECT row_to_json(u) AS data FROM users u")).rows;
    const structureBefore = await structure(client);
    const historyBefore = await execute(client, "history");
    // Verify execute() resets an explicitly wrong incoming order on the same session.
    await client.query("SET search_path TO public, pg_catalog");
    await execute(client, "history");
    await assertSearchPath(client);
    console.log("PASS D02 conexion y execute: pg_catalog implicito primero; bootstrap en public");
    await cli("apply-db.js"); await cli("db-migrations.js", ["migrate"]); await cli("db-migrations.js", ["history"]);
    assert.deepEqual((await client.query("SELECT row_to_json(u) AS data FROM users u")).rows, before);
    assert.deepEqual(await execute(client, "history"), historyBefore);
    assert.deepEqual(await structure(client), structureBefore);
    assert.equal(historyBefore.length, 1); assert.equal(historyBefore[0].kind, "baseline");
    console.log("PASS 2 segunda ejecucion: mismos datos e historial; usuario sigue desactivado");

    const dbDir = path.join(root, "catalog"); const dir = path.join(dbDir, "migrations");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(BACKEND, "src/db/schema.sql"), path.join(dbDir, "schema.sql"));
    const fixture = path.join(dir, "014_fixture.sql");
    const valid = `CREATE TABLE migration_probe(id INTEGER PRIMARY KEY);
      INSERT INTO migration_probe SELECT CASE WHEN TRUE THEN 1 ELSE 0 END;
      UPDATE migration_probe SET id = CASE id WHEN 1 THEN CASE WHEN TRUE THEN 1 ELSE 2 END ELSE 3 END;`;
    fs.writeFileSync(fixture, valid);
    assert.deepEqual((await execute(client, "selected", { dbDir, selected: [fixture] })).applied, ["014"]);
    assert.deepEqual((await execute(client, "migrate", { dbDir })).skipped, ["014"]);
    const record = (await execute(client, "history", { dbDir })).find((r) => r.id === "014");
    assert.equal(record.success, true); assert.ok(record.applied_at); assert.match(record.checksum, /^[a-f0-9]{64}$/);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM migration_probe")).rows[0].n, 1);
    assert.equal((await client.query("SELECT id FROM migration_probe")).rows[0].id, 1);
    console.log("PASS 3 historial y omision por checksum coincidente");

    fs.writeFileSync(fixture, valid + " -- changed");
    await assert.rejects(execute(client, "migrate", { dbDir }), /checksum/);
    fs.writeFileSync(fixture, "COMMIT;");
    await assert.rejects(execute(client, "migrate", { dbDir }), /checksum/);
    fs.writeFileSync(fixture, valid);
    const baselineFile = path.join(dbDir, "schema.sql");
    fs.appendFileSync(baselineFile, "\n-- changed");
    await assert.rejects(execute(client, "bootstrap", { dbDir }), /checksum/);
    fs.copyFileSync(path.join(BACKEND, "src/db/schema.sql"), baselineFile);
    console.log("PASS 4 cambio de checksum en migracion y baseline rechazado");

    const bad = path.join(dir, "015_failure.sql");
    fs.writeFileSync(bad, "CREATE TABLE rollback_probe(id INT); INSERT INTO migration_probe VALUES (2); SELECT 1/0;");
    await assert.rejects(execute(client, "migrate", { dbDir }), (e) => e.code === "22012");
    assert.equal((await client.query("SELECT to_regclass('rollback_probe') AS name")).rows[0].name, null);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM migration_probe")).rows[0].n, 1);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migrations WHERE id='015'")).rows[0].n, 0);
    fs.unlinkSync(bad);
    console.log("PASS 5 rollback de DDL/DML y ausencia de registro exitoso");

    fs.writeFileSync(path.join(dir, "015_concurrency.sql"), "INSERT INTO migration_probe VALUES (3);");
    const first = child([__filename, "--worker", root]); children.push(first.process);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Worker no obtuvo lock")), 10000);
      first.process.once("message", () => { clearTimeout(timer); resolve(); });
      first.process.once("exit", () => { clearTimeout(timer); reject(new Error("Worker termino antes del lock")); });
    });
    const second = child([__filename, "--worker", root]); children.push(second.process);
    const refused = await second.done;
    assert.equal(refused.code, 1); assert.match(refused.output, /Otro proceso/);
    first.process.send("continue");
    assert.equal((await first.done).code, 0);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM migration_probe WHERE id=3")).rows[0].n, 1);
    assert.deepEqual((await execute(client, "migrate", { dbDir })).applied, []);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM schema_migrations WHERE id='015'")).rows[0].n, 1);
    console.log("PASS 6 dos procesos: segundo rechazado, un solo efecto y registro");

    const existing = await connect(root, "preexisting_test");
    try {
      await existing.query("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ('preserve')");
      for (const mode of ["bootstrap","migrate","history"]) await assert.rejects(execute(existing, mode), /existente sin historial/);
      assert.equal((await existing.query("SELECT value FROM sentinel")).rows[0].value, "preserve");
      assert.equal((await existing.query("SELECT to_regclass('schema_migrations') AS name")).rows[0].name, null);
    } finally { await existing.end(); }
    console.log("PASS 7 base preexistente rechazada sin crear historial ni modificar datos");

    for (const filename of ["001_professional_upgrade.sql","010_vehicle_km_updated_at.sql","012_username_auth_superadmin.sql"]) {
      await assert.rejects(execute(client, "selected", { selected: [path.join(BACKEND, "src/db/migrations", filename)] }), /no permitido/);
    }
    fs.writeFileSync(path.join(dir, "016_order.sql"), "SELECT 1;");
    const later = path.join(dir, "017_order.sql"); fs.writeFileSync(later, "SELECT 1;");
    await assert.rejects(execute(client, "selected", { dbDir, selected: [later] }), /fuera de orden/);
    console.log("PASS archivo historico/diagnostico y seleccion fuera de orden rechazados");
  } finally {
    for (const child of children) if (child.exitCode === null) child.kill();
    if (client) await client.end();
    if (started) pg("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    // root was created by mkdtemp in this invocation; never user supplied.
    fs.rmSync(root, { recursive: true, force: true });
  }
}

(process.argv[2] === "--worker" ? worker() : main()).catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
