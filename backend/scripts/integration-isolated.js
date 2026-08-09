const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { Pool } = require("pg");
const { createPasswordHash, verifyPassword } = require("../src/utils/password");

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const SESSION_SECRET = "isolated-integration-session-secret";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIsIsolatedDatabase(urlValue) {
  const parsed = new URL(urlValue || "");
  const host = parsed.hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a localhost/127.0.0.1 para evitar Neon o produccion");
  }
}

async function execSql(pool, sql) {
  await pool.query(sql);
}

async function resetDatabase(pool) {
  await pool.query(`
    DROP TABLE IF EXISTS admin_audit_logs CASCADE;
    DROP TABLE IF EXISTS activity_logs CASCADE;
    DROP TABLE IF EXISTS push_notification_events CASCADE;
    DROP TABLE IF EXISTS push_subscriptions CASCADE;
    DROP TABLE IF EXISTS maintenance_plans CASCADE;
    DROP TABLE IF EXISTS maintenance_images CASCADE;
    DROP TABLE IF EXISTS mantenimiento CASCADE;
    DROP TABLE IF EXISTS lugares CASCADE;
    DROP TABLE IF EXISTS vehiculos CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
}

async function createLegacySchema(pool) {
  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      nombre TEXT,
      apellido TEXT,
      email TEXT UNIQUE NOT NULL,
      telefono TEXT,
      profile_photo_url TEXT,
      mileage_unit TEXT NOT NULL DEFAULT 'km',
      reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      password_hash TEXT NOT NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE vehiculos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      modelo TEXT NOT NULL,
      patente TEXT UNIQUE,
      vehicle_type TEXT NOT NULL DEFAULT 'otro',
      vehicle_color TEXT NOT NULL DEFAULT 'neutro',
      km_actual INTEGER,
      km_updated_at TIMESTAMPTZ,
      ultimo_service_km INTEGER,
      intervalo_km INTEGER,
      fecha_ultimo_service DATE,
      intervalo_tiempo INTEGER,
      vehicle_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      notify_days_before INTEGER NOT NULL DEFAULT 30,
      notify_km_before INTEGER NOT NULL DEFAULT 1000,
      km_update_reminder_days INTEGER NOT NULL DEFAULT 7
    );

    CREATE TABLE lugares (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      ubicacion TEXT,
      contacto_nombre TEXT,
      contacto_numero TEXT
    );

    CREATE TABLE mantenimiento (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      lugar_id INTEGER NOT NULL REFERENCES lugares(id),
      accion TEXT NOT NULL,
      km INTEGER NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE maintenance_images (
      id SERIAL PRIMARY KEY,
      maintenance_id INTEGER NOT NULL REFERENCES mantenimiento(id) ON DELETE CASCADE,
      image_url TEXT,
      image_base64 TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT maintenance_images_source_check CHECK (image_url IS NOT NULL OR image_base64 IS NOT NULL)
    );

    CREATE TABLE push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      device_info JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE push_notification_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
      maintenance_id INTEGER REFERENCES mantenimiento(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      stage TEXT,
      due_snapshot TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sent_at TIMESTAMPTZ,
      cooldown_until TIMESTAMPTZ,
      send_count INTEGER NOT NULL DEFAULT 0,
      last_result TEXT
    );

    CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function seedLegacyUsers(pool) {
  const legacyHash = await createPasswordHash("claveAnteriorNoNumerica");
  await pool.query(
    `INSERT INTO users (id, full_name, nombre, apellido, email, password_hash, is_approved)
     VALUES
       (5, 'Lucas Test', 'Lucas', 'Test', 'lucas@test.com', $1, TRUE),
       (24, 'Maxi Ibarra', 'Maxi', 'Ibarra', 'maxiibarra_cba@hotmail.com', $1, TRUE),
       (30, 'Lucas Duplicate', 'Lucas', 'Duplicate', 'lucas@otro.test', $1, TRUE)`,
    [legacyHash]
  );
  await pool.query("SELECT setval('users_id_seq', 30, true)");
  await pool.query(
    `INSERT INTO vehiculos (id, user_id, nombre, modelo, patente, km_actual)
     VALUES (10, 5, 'Auto Lucas', 'Modelo A', 'AAA111', 1000),
            (20, 24, 'Auto Maxi', 'Modelo B', 'BBB222', 2000)`
  );
  await pool.query("SELECT setval('vehiculos_id_seq', 20, true)");
  await pool.query(
    `INSERT INTO lugares (id, user_id, nombre)
     VALUES (10, 5, 'Taller Lucas'), (20, 24, 'Taller Maxi')`
  );
  await pool.query("SELECT setval('lugares_id_seq', 20, true)");
  await pool.query(
    `INSERT INTO mantenimiento (id, user_id, fecha, vehiculo_id, lugar_id, accion, km, cost)
     VALUES (10, 5, CURRENT_DATE, 10, 10, 'Service Lucas', 1000, 100),
            (20, 24, CURRENT_DATE, 20, 20, 'Service Maxi', 2000, 200)`
  );
  await pool.query("SELECT setval('mantenimiento_id_seq', 20, true)");
}

async function applyMigrations(pool) {
  const migration11 = fs.readFileSync(path.join(__dirname, "../src/db/migrations/011_internal_notifications_and_vehicle_images.sql"), "utf8");
  const migration12 = fs.readFileSync(path.join(__dirname, "../src/db/migrations/012_username_auth_superadmin.sql"), "utf8");
  const migration13 = fs.readFileSync(path.join(__dirname, "../src/db/migrations/013_maintenance_plans.sql"), "utf8");
  await execSql(pool, migration11);
  await execSql(pool, migration12);
  await execSql(pool, migration13);
  await execSql(pool, migration11);
  await execSql(pool, migration12);
  await execSql(pool, migration13);
}

function runScript(scriptName, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        SESSION_SECRET,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} fallo: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function startBackend(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/index.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SESSION_SECRET,
        PORT: String(port),
        CLOUDINARY_CLOUD_NAME: "",
        CLOUDINARY_API_KEY: "",
        CLOUDINARY_API_SECRET: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => resolve(child), 1300);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (/Servidor corriendo/.test(output)) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) {
        reject(new Error(`Backend aislado termino antes de tiempo: ${output}`));
      }
    });
  });
}

async function request(baseUrl, pathName, { method = "GET", cookie = "", body, expectedStatus } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const rawBody = await response.text();
  const data = rawBody ? JSON.parse(rawBody) : {};
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${method} ${pathName} esperaba ${expectedStatus} y recibio ${response.status}: ${rawBody}`);
  }
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie") || "",
  };
}

async function login(baseUrl, username, password, expectedStatus = 200) {
  return request(baseUrl, "/auth/login", {
    method: "POST",
    expectedStatus,
    body: { username, password },
  });
}

async function main() {
  assertIsIsolatedDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  let server = null;

  try {
    await resetDatabase(pool);
    await createLegacySchema(pool);
    await seedLegacyUsers(pool);
    await applyMigrations(pool);

    const migratedUsers = await pool.query("SELECT id, email, username FROM users ORDER BY id");
    assert(migratedUsers.rows.find((row) => row.id === 5)?.username === "lucas", "username migrado de lucas@test.com incorrecto");
    assert(migratedUsers.rows.find((row) => row.id === 24)?.username === "maxiibarra_cba", "username migrado de maxiibarra_cba incorrecto");
    assert(migratedUsers.rows.find((row) => row.id === 30)?.username === "lucas_30", "colision de username no resuelta");
    const relations = await pool.query(
      `SELECT
        (SELECT user_id FROM vehiculos WHERE id = 10) AS vehicle_user_id,
        (SELECT user_id FROM mantenimiento WHERE id = 10) AS maintenance_user_id,
        (SELECT user_id FROM lugares WHERE id = 10) AS place_user_id`
    );
    assert(Number(relations.rows[0].vehicle_user_id) === 5, "vehiculo cambio de user_id");
    assert(Number(relations.rows[0].maintenance_user_id) === 5, "mantenimiento cambio de user_id");
    assert(Number(relations.rows[0].place_user_id) === 5, "lugar cambio de user_id");

    const bootstrapPassword = "123456";
    const bootstrapResult = await runScript("bootstrap-superadmin.js", {
      BOOTSTRAP_ADMIN_USERNAME: "rootadmin",
      BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword,
    });
    assert(!bootstrapResult.stdout.includes(bootstrapPassword), "bootstrap imprimio la clave");
    assert(!bootstrapResult.stderr.includes(bootstrapPassword), "bootstrap imprimio la clave en stderr");

    const resetPassword = "654321";
    const resetResult = await runScript("reset-superadmin-password.js", {
      ADMIN_RESET_USERNAME: "rootadmin",
      ADMIN_RESET_PASSWORD: resetPassword,
    });
    assert(!resetResult.stdout.includes(resetPassword), "reset imprimio la clave");
    assert(!resetResult.stderr.includes(resetPassword), "reset imprimio la clave en stderr");
    const resetHashResult = await pool.query("SELECT password_hash, must_change_password, session_version FROM users WHERE username = 'rootadmin'");
    assert(await verifyPassword(resetPassword, resetHashResult.rows[0].password_hash), "reset no actualizo hash verificable");
    assert(resetHashResult.rows[0].must_change_password === true, "reset no marco must_change_password");
    assert(Number(resetHashResult.rows[0].session_version) >= 1, "reset no incremento session_version");

    const port = 3109;
    const baseUrl = `http://127.0.0.1:${port}`;
    server = await startBackend(port);

    await request(baseUrl, "/api/health", { expectedStatus: 200 });
    const badUser = await login(baseUrl, "noexiste", "999999", 401);
    const badPass = await login(baseUrl, "rootadmin", "999999", 401);
    assert(badUser.data.error === badPass.data.error, "respuesta invalida no es generica");
    for (let index = 0; index < 5; index += 1) {
      await login(baseUrl, "locktest", "111111", 401);
    }
    await login(baseUrl, "locktest", "111111", 429);

    const rootLogin = await login(baseUrl, "rootadmin", resetPassword, 200);
    assert(rootLogin.data.user.mustChangePassword === true, "superadmin reseteado debe requerir cambio de clave");
    const rootCookie = rootLogin.cookie.split(";")[0];
    const changedRoot = await request(baseUrl, "/auth/change-password", {
      method: "POST",
      cookie: rootCookie,
      expectedStatus: 200,
      body: {
        current_password: resetPassword,
        new_password: "001234",
        confirm_password: "001234",
      },
    });
    const adminCookie = changedRoot.cookie.split(";")[0];
    await request(baseUrl, "/admin/users", { cookie: adminCookie, expectedStatus: 200 });

    await request(baseUrl, "/auth/register", {
      method: "POST",
      expectedStatus: 403,
      body: { username: "publico", password: "123456" },
    });

    const userA = await request(baseUrl, "/admin/users", {
      method: "POST",
      cookie: adminCookie,
      expectedStatus: 201,
      body: { username: "usera", password: "111111", role: "user", is_active: true },
    });
    const userB = await request(baseUrl, "/admin/users", {
      method: "POST",
      cookie: adminCookie,
      expectedStatus: 201,
      body: { username: "userb", password: "222222", role: "user", is_active: true },
    });

    const loginA = await login(baseUrl, "usera", "111111", 200);
    const tempCookieA = loginA.cookie.split(";")[0];
    const changeA = await request(baseUrl, "/auth/change-password", {
      method: "POST",
      cookie: tempCookieA,
      expectedStatus: 200,
      body: { current_password: "111111", new_password: "333333", confirm_password: "333333" },
    });
    const cookieA = changeA.cookie.split(";")[0];
    const loginB = await login(baseUrl, "userb", "222222", 200);
    const tempCookieB = loginB.cookie.split(";")[0];
    const changeB = await request(baseUrl, "/auth/change-password", {
      method: "POST",
      cookie: tempCookieB,
      expectedStatus: 200,
      body: { current_password: "222222", new_password: "444444", confirm_password: "444444" },
    });
    const cookieB = changeB.cookie.split(";")[0];

    await request(baseUrl,"/admin/dashboard",{cookie:cookieA,expectedStatus:403});
    await request(baseUrl,"/admin/audit-logs",{cookie:cookieA,expectedStatus:403});
    const adminDashboard=await request(baseUrl,"/admin/dashboard",{cookie:adminCookie,expectedStatus:200});
    assert(Number(adminDashboard.data.metrics.total)>=3,"metricas administrativas incompletas");
    assert(adminDashboard.data.metrics.password_hash===undefined,"dashboard expuso hash");
    await pool.query("UPDATE users SET deleted_at=NOW() WHERE id=$1",[userB.data.user.id]);
    const metricsWithoutDeleted=await request(baseUrl,"/admin/dashboard",{cookie:adminCookie,expectedStatus:200});
    assert(Number(metricsWithoutDeleted.data.metrics.total)===Number(adminDashboard.data.metrics.total)-1,"usuario eliminado logicamente fue contado");
    await pool.query("UPDATE users SET deleted_at=NULL WHERE id=$1",[userB.data.user.id]);
    const auditResponse=await request(baseUrl,"/admin/audit-logs?limit=10&offset=0",{cookie:adminCookie,expectedStatus:200});
    assert(Array.isArray(auditResponse.data.logs),"auditoria no devolvio lista");
    assert(auditResponse.data.logs.some(log=>log.action==="admin.user.create"),"creacion administrativa no genero auditoria");
    assert(!JSON.stringify(auditResponse.data).match(/password_hash|SESSION_SECRET|DATABASE_URL/),"auditoria expuso secretos");
    await request(baseUrl,"/vehicles",{cookie:adminCookie,expectedStatus:403});
    await request(baseUrl,"/maintenance",{cookie:adminCookie,expectedStatus:403});
    await request(baseUrl,`/admin/users/${changedRoot.data.user.id}/status`,{method:"PATCH",cookie:adminCookie,expectedStatus:400,body:{is_active:false}});
    await request(baseUrl,`/admin/users/${userA.data.user.id}/status`,{method:"PATCH",cookie:cookieA,expectedStatus:403,body:{is_active:false}});

    await request(baseUrl, "/admin/users", { cookie: cookieA, expectedStatus: 403 });
    const vehicleA = await request(baseUrl, "/vehicles?user_id=999999", {
      method: "POST",
      cookie: cookieA,
      expectedStatus: 201,
      body: { user_id: userB.data.user.id, nombre: "Auto A", modelo: "A", patente: "TSTA01", km_actual: "100" },
    });
    const placeA = await request(baseUrl, "/places", {
      method: "POST",
      cookie: cookieA,
      expectedStatus: 201,
      body: { user_id: userB.data.user.id, nombre: "Taller A" },
    });
    const maintenanceA = await request(baseUrl, "/maintenance", {
      method: "POST",
      cookie: cookieA,
      expectedStatus: 201,
      body: {
        user_id: userB.data.user.id,
        fecha: "2026-08-03",
        vehiculo_id: vehicleA.data.id,
        lugar_id: placeA.data.id,
        accion: "Service A",
        km: "120",
        cost: "10",
      },
    });
    const vehicleB = await request(baseUrl, "/vehicles", {
      method: "POST",
      cookie: cookieB,
      expectedStatus: 201,
      body: { nombre: "Auto B", modelo: "B", patente: "TSTB01", km_actual: "200" },
    });
    const placeB = await request(baseUrl,"/places",{method:"POST",cookie:cookieB,expectedStatus:201,body:{nombre:"Taller B"}});
    const oilPlan = await request(baseUrl,"/maintenance-plans",{method:"POST",cookie:cookieA,expectedStatus:201,body:{vehicle_id:vehicleA.data.id,name:"Cambio de aceite",interval_km:5000,notify_km_before:500,initial_service_km:10000}});
    const brakesPlan = await request(baseUrl,"/maintenance-plans",{method:"POST",cookie:cookieA,expectedStatus:201,body:{vehicle_id:vehicleA.data.id,name:"Frenos",interval_months:6,notify_days_before:15,initial_service_date:"2026-01-01"}});
    const foreignPlan = await request(baseUrl,"/maintenance-plans",{method:"POST",cookie:cookieB,expectedStatus:201,body:{vehicle_id:vehicleB.data.id,name:"Ajeno",interval_km:1000,notify_km_before:100,initial_service_km:200}});
    await request(baseUrl,"/maintenance",{method:"POST",cookie:cookieA,expectedStatus:404,body:{fecha:"2026-08-04",vehiculo_id:vehicleA.data.id,lugar_id:placeA.data.id,accion:"Ataque",km:15005,cost:0,maintenance_plan_id:foreignPlan.data.id}});
    const oilService=await request(baseUrl,"/maintenance",{method:"POST",cookie:cookieA,expectedStatus:201,body:{fecha:"2026-08-04",vehiculo_id:vehicleA.data.id,lugar_id:placeA.data.id,accion:"Cambio de aceite",km:15005,cost:100,maintenance_plan_id:oilPlan.data.id}});
    let plansA=await request(baseUrl,`/maintenance-plans?vehicle_id=${vehicleA.data.id}`,{cookie:cookieA,expectedStatus:200});
    assert(plansA.data.find(p=>p.id===oilPlan.data.id).next_service_km===20005,"plan de aceite no avanzo a 20005");
    assert(String(plansA.data.find(p=>p.id===brakesPlan.data.id).next_service_date).slice(0,10)==="2026-07-01","completar aceite modifico frenos");
    await request(baseUrl,"/maintenance",{method:"POST",cookie:cookieA,expectedStatus:201,body:{fecha:"2026-08-05",vehiculo_id:vehicleA.data.id,lugar_id:placeA.data.id,accion:"Cambio de luz",km:15006,cost:20}});
    plansA=await request(baseUrl,`/maintenance-plans?vehicle_id=${vehicleA.data.id}`,{cookie:cookieA,expectedStatus:200});
    assert(plansA.data.find(p=>p.id===oilPlan.data.id).next_service_km===20005,"eventual modifico aceite");
    await request(baseUrl,`/maintenance/${oilService.data.id}`,{method:"PUT",cookie:cookieA,expectedStatus:200,body:{fecha:"2026-08-04",vehiculo_id:vehicleA.data.id,lugar_id:placeA.data.id,accion:"Cambio de aceite",km:15100,cost:100,maintenance_plan_id:oilPlan.data.id}});
    plansA=await request(baseUrl,`/maintenance-plans?vehicle_id=${vehicleA.data.id}`,{cookie:cookieA,expectedStatus:200});assert(plansA.data.find(p=>p.id===oilPlan.data.id).next_service_km===20100,"edicion no recalculo plan");
    await request(baseUrl,`/maintenance/${oilService.data.id}`,{method:"DELETE",cookie:cookieA,expectedStatus:200});
    plansA=await request(baseUrl,`/maintenance-plans?vehicle_id=${vehicleA.data.id}`,{cookie:cookieA,expectedStatus:200});assert(plansA.data.find(p=>p.id===oilPlan.data.id).next_service_km===15000,"eliminacion no restauro base inicial");
    const vehiclesAsA = await request(baseUrl, `/vehicles?user_id=${userB.data.user.id}`, {
      cookie: cookieA,
      expectedStatus: 200,
    });
    assert(vehiclesAsA.data.length === 1 && vehiclesAsA.data[0].id === vehicleA.data.id, "user_id falsificado altero listado de vehiculos");
    await request(baseUrl, `/vehicles/${vehicleB.data.id}/km`, {
      method: "PATCH",
      cookie: cookieA,
      expectedStatus: 404,
      body: { user_id: userA.data.user.id, km_actual: 300 },
    });
    await request(baseUrl, `/vehicles/${vehicleB.data.id}/photo`, {
      method: "POST",
      cookie: cookieA,
      expectedStatus: 404,
      body: { image_data_url: "data:image/png;base64,AAAA", file_name: "x.png" },
    });

    await pool.query("UPDATE maintenance_plans SET is_active=FALSE WHERE user_id=$1",[userA.data.user.id]);
    await pool.query("UPDATE push_notification_events SET read_at=NOW() WHERE user_id=$1",[userA.data.user.id]);
    await pool.query(
      `INSERT INTO push_notification_events (user_id, vehicle_id, maintenance_id, notification_type, dedupe_key, payload, created_at)
       VALUES
       ($1, $2, $3, 'test', 'a-1', '{"title":"A1","body":"Unread"}', NOW() - INTERVAL '1 minute'),
       ($1, $2, $3, 'test', 'a-2', '{"title":"A2","body":"Unread"}', NOW() - INTERVAL '2 minutes'),
       ($4, $5, NULL, 'test', 'b-1', '{"title":"B1","body":"Unread"}', NOW())`,
      [userA.data.user.id, vehicleA.data.id, maintenanceA.data.id, userB.data.user.id, vehicleB.data.id]
    );
    const unreadA = await request(baseUrl, "/notifications?filter=unread&limit=1&offset=0&user_id=999", {
      cookie: cookieA,
      expectedStatus: 200,
    });
    assert(unreadA.data.notifications.length === 1, "filtro unread/limit fallo");
    assert(unreadA.data.unreadCount === 2, "unreadCount global de A incorrecto");
    assert(unreadA.data.pagination.hasMore === true, "paginacion unread no marco hasMore");
    await request(baseUrl, `/notifications/${unreadA.data.notifications[0].id}/read`, {
      method: "PATCH",
      cookie: cookieA,
      expectedStatus: 200,
      body: { user_id: userB.data.user.id },
    });
    const unreadAfterOne = await request(baseUrl, "/notifications?filter=unread&limit=10", {
      cookie: cookieA,
      expectedStatus: 200,
    });
    assert(unreadAfterOne.data.unreadCount === 1, "lectura individual no actualizo unreadCount");
    await request(baseUrl, "/notifications/read-all", {
      method: "PATCH",
      cookie: cookieA,
      expectedStatus: 200,
      body: { user_id: userB.data.user.id },
    });
    const unreadAAfterAll = await request(baseUrl, "/notifications?filter=unread&limit=10", {
      cookie: cookieA,
      expectedStatus: 200,
    });
    const unreadBAfterAll = await request(baseUrl, "/notifications?filter=unread&limit=10", {
      cookie: cookieB,
      expectedStatus: 200,
    });
    assert(unreadAAfterAll.data.unreadCount === 0, "read-all no limpio A");
    assert(unreadBAfterAll.data.unreadCount === 1, "read-all de A afecto a B");

    const sessionBeforeDisable = await login(baseUrl, "usera", "333333", 200);
    await request(baseUrl, `/admin/users/${userA.data.user.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      expectedStatus: 200,
      body: { is_active: false },
    });
    await request(baseUrl, "/vehicles", {
      cookie: sessionBeforeDisable.cookie.split(";")[0],
      expectedStatus: 401,
    });

    const paginatedAll = await request(baseUrl, "/notifications?filter=all&limit=1&offset=1", {
      cookie: cookieB,
      expectedStatus: 200,
    });
    assert(Array.isArray(paginatedAll.data.notifications), "paginacion all no devolvio lista");

    await request(baseUrl, `/admin/users/${userB.data.user.id}/reset-password`, {
      method: "PATCH",
      cookie: adminCookie,
      expectedStatus: 200,
      body: { password: "555555" },
    });
    await request(baseUrl, "/vehicles", { cookie: cookieB, expectedStatus: 401 });
    const resetLoginB = await login(baseUrl, "userb", "555555", 200);
    assert(resetLoginB.data.user.mustChangePassword === true, "reset admin no obliga cambio de clave");

    await resetDatabase(pool);
    await execSql(pool, fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8"));
    await applyMigrations(pool);

    console.log("RESULTADO: integracion aislada OK");
  } finally {
    if (server) server.kill();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
