const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const DB_DIR = path.resolve(__dirname, "../src/db");
const BASELINE_ID = "baseline_013";
const LOCK_ID = 724031304;
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
function fail(message) { throw new Error(message); }

// Read once: execution and checksum always use the same bytes.
function readCatalog(dbDir = DB_DIR) {
  const schema = fs.readFileSync(path.join(dbDir, "schema.sql"), "utf8");
  const dir = path.join(dbDir, "migrations");
  const migrations = [];
  const ids = new Set();
  for (const filename of fs.readdirSync(dir).sort()) {
    if (!filename.endsWith(".sql")) continue;
    const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(filename);
    if (!match) fail(`Nombre de migracion invalido: ${filename}`);
    const id = match[1];
    if (ids.has(id)) fail(`Identificador duplicado: ${id}`);
    ids.add(id);
    // Frozen archive, including diagnostic 010. Never executable here.
    if (Number(id) <= 13) continue;
    const file = path.join(dir, filename);
    if (fs.lstatSync(file).isSymbolicLink()) fail(`Symlink no permitido: ${filename}`);
    const sql = fs.readFileSync(file, "utf8");
    migrations.push({ id, filename, checksum: hash(sql), sql, kind: "migration" });
  }
  return {
    baseline: { id: BASELINE_ID, filename: "schema.sql", checksum: hash(schema), sql: schema, kind: "baseline" },
    migrations,
  };
}

// Conservative lexical check, not a SQL security sandbox. SQL requires review.
// Mask quoted bodies/comments so DO $$ BEGIN ... END $$ remains supported.
function validateTransactionalSql(sql, filename) {
  let visible = "";
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i); i = end < 0 ? sql.length : end + 1; visible += " ";
    } else if (sql.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) fail(`Comentario SQL incompleto: ${filename}`);
      visible += " ";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]; let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote) {
          i++;
          if (sql[i] === quote) { i++; continue; }
          closed = true; break;
        }
        if (sql[i] === "\\") fail(`Escape SQL no soportado: ${filename}`);
        i++;
      }
      if (!closed) fail(`Literal SQL incompleto: ${filename}`);
      visible += " literal ";
    } else if (sql[i] === "$" && /^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.test(sql.slice(i))) {
      const tag = sql.slice(i).match(/^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/)[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) fail(`Bloque SQL incompleto: ${filename}`);
      i = end + tag.length; visible += " body ";
    } else visible += sql[i++];
  }
  if (!visible.trim()) fail(`Migracion vacia: ${filename}`);
  // END closes CASE expressions too; only reject it as a statement command.
  if (/(^|;)\s*END\b/i.test(visible)
      || /\b(BEGIN|COMMIT|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE|VACUUM|CONCURRENTLY)\b/i.test(visible)
      || /\b(START\s+TRANSACTION|CREATE\s+DATABASE|DROP\s+DATABASE|ALTER\s+SYSTEM)\b/i.test(visible)) {
    fail(`SQL no admitido en una migracion transaccional: ${filename}`);
  }
}

async function hasHistory(client) {
  const result = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  return result.rows[0].present;
}

async function assertEmpty(client) {
  // Includes non-public schemas, routines and standalone types, not just tables.
  const result = await client.query(`SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_'
    UNION ALL SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    UNION ALL SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
    UNION ALL SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql'
  ) AS occupied`);
  if (result.rows[0].occupied) fail("Base existente sin historial: requiere reconciliacion manual; no se modifico el esquema.");
}

async function history(client, catalog) {
  const rows = (await client.query("SELECT * FROM public.schema_migrations ORDER BY id")).rows;
  const known = new Map([catalog.baseline, ...catalog.migrations].map((m) => [m.id, m]));
  if (!rows.some((r) => r.id === BASELINE_ID)) fail("Historial sin baseline reconocida: requiere reconciliacion manual.");
  for (const row of rows) {
    const expected = known.get(row.id);
    if (!expected) fail(`Migracion registrada ausente del repositorio: ${row.id}`);
    if (row.filename !== expected.filename || row.checksum !== expected.checksum || row.kind !== expected.kind || row.success !== true) {
      fail(`Conflicto de checksum o historial: ${row.id}. No editar registros; requiere reconciliacion manual.`);
    }
  }
  const applied = new Set(rows.map((r) => r.id));
  let gap = false;
  for (const item of catalog.migrations) {
    if (!applied.has(item.id)) gap = true;
    else if (gap) fail(`Historial fuera de orden: ${item.id}`);
  }
  return rows;
}

async function record(client, item) {
  await client.query(`INSERT INTO public.schema_migrations (id,filename,checksum,kind,success)
    VALUES ($1,$2,$3,$4,TRUE)`, [item.id,item.filename,item.checksum,item.kind]);
}

async function transaction(client, action) {
  await client.query("BEGIN");
  try { await action(); await client.query("COMMIT"); }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}

async function execute(client, mode, { dbDir = DB_DIR, selected = [] } = {}) {
  const catalog = readCatalog(dbDir);
  if (!["bootstrap", "migrate", "selected", "history"].includes(mode)) fail("Modo invalido");
  const requested = new Set();
  if (mode === "selected") {
    if (!selected.length) fail("Indica archivos incrementales desde 014; 001-013 estan archivados.");
    for (const file of selected) {
      const item = catalog.migrations.find((m) => path.resolve(file) === path.join(dbDir, "migrations", m.filename));
      if (!item) fail("Archivo no permitido: solo migraciones incrementales del directorio migrations, desde 014.");
      requested.add(item.id);
    }
  }
  // Session lock spans all transactions and validation on this same client.
  const lock = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [LOCK_ID]);
  if (!lock.rows[0].acquired) fail("Otro proceso de migraciones esta activo. Reintentar cuando termine.");
  try {
    await client.query("SET search_path TO public");
    await client.query("SET lock_timeout TO '10s'");
    await client.query("SET statement_timeout TO '120s'");
    const exists = await hasHistory(client);
    if (!exists) {
      await assertEmpty(client);
      if (mode !== "bootstrap") fail("Base vacia sin historial: ejecutar db:bootstrap primero.");
      validateTransactionalSql(catalog.baseline.sql, "schema.sql");
      await transaction(client, async () => {
        await client.query(catalog.baseline.sql);
        await client.query(`CREATE TABLE public.schema_migrations (
          id TEXT PRIMARY KEY, filename TEXT NOT NULL UNIQUE,
          checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
          kind TEXT NOT NULL CHECK (kind IN ('baseline','migration')),
          applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          success BOOLEAN NOT NULL CHECK (success = TRUE)
        )`);
        await record(client, catalog.baseline);
      });
      return { applied: [BASELINE_ID], skipped: [] };
    }
    const rows = await history(client, catalog);
    if (mode === "history") return rows;
    if (mode === "bootstrap") return { applied: [], skipped: [BASELINE_ID] };
    const applied = new Set(rows.map((r) => r.id));
    const pending = catalog.migrations.filter((m) => !applied.has(m.id));
    if (mode === "selected") {
      let skippedPending = false;
      for (const item of pending) {
        if (!requested.has(item.id)) skippedPending = true;
        else if (skippedPending) fail("Seleccion fuera de orden: no se pueden omitir migraciones pendientes anteriores.");
      }
    }
    // Check checksums first, then validate the entire selected pending batch.
    for (const item of pending) {
      if (mode !== "selected" || requested.has(item.id)) validateTransactionalSql(item.sql, item.filename);
    }
    const result = { applied: [], skipped: catalog.migrations.filter((m) => applied.has(m.id)).map((m) => m.id) };
    for (const item of pending) {
      if (mode === "selected" && !requested.has(item.id)) continue;
      try {
        await transaction(client, async () => { await client.query(item.sql); await record(client, item); });
      } catch (error) {
        error.migrationId = item.id;
        throw error;
      }
      result.applied.push(item.id);
    }
    return result;
  } finally { await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]); }
}

// No dotenv, DATABASE_URL, PG* or application pool defaults. Explicit target only.
function connectionConfig(env = process.env) {
  const host = env.MIGRATION_DB_HOST;
  const database = env.MIGRATION_DB_NAME;
  const user = env.MIGRATION_DB_USER;
  const port = Number(env.MIGRATION_DB_PORT);
  if (!host || !database || !user || !Number.isInteger(port) || port < 1 || port > 65535) {
    fail("Configurar MIGRATION_DB_HOST, MIGRATION_DB_PORT, MIGRATION_DB_NAME y MIGRATION_DB_USER explicitamente.");
  }
  if (env.MIGRATION_DB_CONFIRM !== `${host}:${port}/${database}`) fail("MIGRATION_DB_CONFIRM no coincide con el destino explicito.");
  return {
    // A function also prevents pg from falling back to PGPASSWORD when empty.
    host, database, user, port, password: () => env.MIGRATION_DB_PASSWORD || "",
    options: "-c search_path=public",
    ssl: host.startsWith("/") || ["localhost", "127.0.0.1", "::1"].includes(host) ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000, application_name: "rodado-db-migrations",
  };
}

async function runCli(mode = process.argv[2]) {
  let client;
  try {
    const config = connectionConfig();
    client = new Client(config);
    await client.connect();
    const actual = (await client.query("SELECT current_database() AS name, current_user AS role")).rows[0];
    if (actual.name !== config.database || actual.role !== config.user) fail("Destino efectivo inesperado.");
    const selected = mode === "selected" ? process.argv.slice(require.main === module ? 3 : 2) : [];
    console.log(JSON.stringify(await execute(client, mode, { selected }), null, 2));
  } catch (error) {
    // PostgreSQL errors may contain data: do not print detail, SQL or config.
    console.error(error.code ? `Operacion DB fallida (${error.code})${error.migrationId ? ` en migracion ${error.migrationId}` : ""}; revisar localmente, sin exponer datos.` : error.message);
    process.exitCode = 1;
  } finally { if (client) await client.end(); }
}

if (require.main === module) runCli();
module.exports = { execute, connectionConfig, readCatalog, validateTransactionalSql, runCli, LOCK_ID };
