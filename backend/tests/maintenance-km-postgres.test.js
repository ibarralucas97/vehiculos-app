// Explicit opt-in only: no DATABASE_URL fallback, no dotenv, no production connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Pool } = require('pg');
const databaseUrl = process.env.F01_TEST_DATABASE_URL;

function loadRoute(filename, pool, pushes) {
  const file = path.join(__dirname, '../src/routes', filename);
  const localRequire = createRequire(file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, console,
    require(name) {
      if (name === '../db/connection') return pool;
      if (name === '../utils/pushNotifications') return {
        buildNotificationPayload: data => data,
        sendPushToUser: async (_pool, data) => { pushes.push(data); },
      };
      return localRequire(name);
    },
  }, { filename: file });
  return module.exports;
}
async function invoke(router, method, routePath, body, id, userId = 1) {
  const layer = router.stack.find(layer => layer.route?.path === routePath && layer.route.methods[method]);
  assert.ok(layer, `${method} ${routePath}`);
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await layer.route.stack[0].handle({ body, params: { id }, user: { id: userId } }, response);
  return response;
}

test('F01: real PostgreSQL route regressions (explicit disposable database only)', { skip: !databaseUrl }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Local database required');
  assert.equal(url.pathname, '/f01_disposable', 'Dedicated disposable database required');
  assert.equal(url.search, '', 'Connection overrides are forbidden');
  const pool = new Pool({ connectionString: databaseUrl });
  const pushes = [];
  try {
    // Fresh dedicated schema: refuse to overwrite an existing test schema.
    await pool.query('CREATE SCHEMA f01_regression');
    await pool.query('SET search_path TO f01_regression');
    // A single connection keeps every transaction in this isolated schema.
    const client = await pool.connect();
    await client.query('SET search_path TO f01_regression');
    const db = { query: (...args) => client.query(...args), connect: async () => ({ query: (...args) => client.query(...args), release() {} }) };
    try {
      await client.query(fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8'));
      const maintenance = loadRoute('maintenance.js', db, pushes);
      const vehicles = loadRoute('vehicles.js', db, pushes);
      await client.query("INSERT INTO users (id,full_name,username,password_hash) VALUES (1,'F01','f01','test'),(2,'Other','other','test')");
      await client.query("INSERT INTO vehiculos (id,user_id,nombre,modelo,km_actual,km_updated_at) VALUES (1,1,'Test','2026',15010,'2026-01-01T00:00:00Z')");
      await client.query("INSERT INTO lugares (id,user_id,nombre) VALUES (1,1,'Taller')");
      await client.query(`INSERT INTO maintenance_plans (id,user_id,vehicle_id,name,interval_km,notify_km_before,initial_service_km,last_service_km,next_service_km)
        VALUES (1,1,1,'Aceite',5000,500,10000,10000,15000),(2,1,1,'Otro',5000,500,9000,9000,14000)`);
      const originalVehicle = (await client.query('SELECT km_actual,km_updated_at FROM vehiculos WHERE id=1')).rows[0];
      const payload = km => ({ fecha: '2026-11-18', vehiculo_id: 1, lugar_id: 1, accion: 'Aceite', km, cost: 10 });
      for (const method of ['post', 'put']) {
        for (const km of [15235, 14000, 15010]) {
          await t.test(`${method} historical km=${km} leaves odometer and timestamp intact`, async () => {
            let id;
            if (method === 'put') id = (await invoke(maintenance, 'post', '/', payload(10000))).body.id;
            const result = await invoke(maintenance, method, method === 'post' ? '/' : '/:id', payload(km), id);
            assert.equal(result.statusCode, method === 'post' ? 201 : 200);
            const stored = (await client.query('SELECT km FROM mantenimiento WHERE id=$1', [result.body.id])).rows[0];
            assert.equal(stored.km, km);
            assert.deepEqual((await client.query('SELECT km_actual,km_updated_at FROM vehiculos WHERE id=1')).rows[0], originalVehicle);
          });
        }
      }
      await t.test('associated plans recalculate; eventual records do not reset plans; images/activity persist', async () => {
        const image = 'data:image/png;base64,YQ==';
        const created = await invoke(maintenance, 'post', '/', { ...payload(15235), maintenance_plan_id: 1, image_base64: image });
        assert.equal(created.statusCode, 201);
        assert.equal(created.body.image.imageSource, image);
        const plan = async id => (await client.query('SELECT last_service_km,next_service_km FROM maintenance_plans WHERE id=$1', [id])).rows[0];
        assert.deepEqual(await plan(1), { last_service_km: 15235, next_service_km: 20235 });
        const untouched = await plan(2);
        const updated = await invoke(maintenance, 'put', '/:id', { ...payload(14000), maintenance_plan_id: 1 }, created.body.id);
        assert.equal(updated.statusCode, 200);
        assert.deepEqual(await plan(1), { last_service_km: 14000, next_service_km: 19000 });
        await invoke(maintenance, 'post', '/', payload(99999));
        assert.deepEqual(await plan(1), { last_service_km: 14000, next_service_km: 19000 });
        assert.deepEqual(await plan(2), untouched);
        assert.equal((await client.query('SELECT image_base64 FROM maintenance_images WHERE maintenance_id=$1', [created.body.id])).rows[0].image_base64, image);
        assert.ok(Number((await client.query('SELECT COUNT(*) FROM activity_logs')).rows[0].count) > 0);
        assert.ok(pushes.length > 0);
        assert.deepEqual((await client.query('SELECT km_actual,km_updated_at FROM vehiculos WHERE id=1')).rows[0], originalVehicle);
        await invoke(maintenance, 'put', '/:id', payload(17000), created.body.id);
        assert.deepEqual(await plan(1), { last_service_km: 10000, next_service_km: 15000 });
      });
      await t.test('ownership failures roll back and cannot change history or vehicle', async () => {
        const before = (await client.query('SELECT COUNT(*) FROM mantenimiento')).rows[0].count;
        const result = await invoke(maintenance, 'post', '/', payload(20000), null, 2);
        assert.equal(result.statusCode, 404);
        const existing = (await client.query('SELECT id FROM mantenimiento LIMIT 1')).rows[0].id;
        assert.equal((await invoke(maintenance, 'put', '/:id', payload(20000), existing, 2)).statusCode, 404);
        assert.equal((await client.query('SELECT COUNT(*) FROM mantenimiento')).rows[0].count, before);
        assert.deepEqual((await client.query('SELECT km_actual,km_updated_at FROM vehiculos WHERE id=1')).rows[0], originalVehicle);
      });
      await t.test('explicit PATCH updates mileage; a decrease is rejected', async () => {
        const updated = await invoke(vehicles, 'patch', '/:id/km', { km_actual: 16000 }, 1);
        assert.equal(updated.statusCode, 200); assert.equal(updated.body.km_actual, 16000);
        assert.notEqual(updated.body.km_updated_at.toISOString(), originalVehicle.km_updated_at.toISOString());
        const rejected = await invoke(vehicles, 'patch', '/:id/km', { km_actual: 15000 }, 1);
        assert.equal(rejected.statusCode, 400);
        assert.equal((await client.query('SELECT km_actual FROM vehiculos WHERE id=1')).rows[0].km_actual, 16000);
      });
    } finally {
      await client.query('ROLLBACK');
      await client.query('DROP SCHEMA f01_regression CASCADE');
      client.release();
    }
  } finally { await pool.end(); }
});
