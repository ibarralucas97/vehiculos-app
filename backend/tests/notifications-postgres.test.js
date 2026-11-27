// Explicit opt-in. Only the existing local disposable database and mocked push transport are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const webpush = require('web-push');
const { runReminderSweep } = require('../src/utils/pushReminders');

test('N01: device ownership, inbox, provider outcomes and concurrent sweeps', {
  skip: !process.env.F01_TEST_DATABASE_URL,
}, async t => {
  const url = new URL(process.env.F01_TEST_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/f01_disposable');
  assert.equal(url.search, '');
  const schema = 'n01_push_' + process.pid;
  const pool = new Pool({ connectionString: url.href, options: '-c search_path=' + schema });
  t.after(() => pool.end());
  await pool.query('CREATE SCHEMA ' + schema);
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8'));
    const dbModule = require.resolve('../src/db/connection');
    require.cache[dbModule] = { id: dbModule, loaded: true, exports: pool };
    const routes = require('../src/routes/notifications');
    async function invoke(method, path, userId, body = {}) {
      const route = routes.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
      const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
      await route.stack.at(-1).handle({ user: { id: userId }, query: {}, body }, res);
      return res;
    }

    for (const key of ['PUSH_VAPID_SUBJECT', 'PUSH_VAPID_PUBLIC_KEY', 'PUSH_VAPID_PRIVATE_KEY']) {
      process.env[key] = 'fixture'; // Accepted only by the in-process validation stub.
    }
    const vapid = t.mock.method(webpush, 'setVapidDetails', () => {});
    vapid.mock.mockImplementationOnce(() => { throw new Error('invalid fixture'); });
    assert.equal(require('../src/utils/pushNotifications').hasPushConfiguration(), false);
    let expired = false;
    const accepted = [];
    t.mock.method(webpush, 'sendNotification', async (subscription, payload) => {
      if (expired) throw Object.assign(new Error('expired'), { statusCode: 410 });
      accepted.push([subscription.endpoint, JSON.parse(payload)]);
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    await pool.query("INSERT INTO users (id,full_name,username,password_hash) VALUES (1,'Uno','uno','fixture'),(2,'Dos','dos','fixture')");
    await pool.query(`INSERT INTO vehiculos (id,user_id,nombre,modelo,km_actual,ultimo_service_km,intervalo_km,fecha_ultimo_service,intervalo_tiempo)
      VALUES (1,1,'Auto','Test',1800,1000,1000,CURRENT_DATE - INTERVAL '3 months',1)`);
    await pool.query(`INSERT INTO maintenance_plans (user_id,vehicle_id,name,interval_km,initial_service_km,notify_km_before)
      VALUES (1,1,'Plan',500,1000,100)`);
    const endpoint = 'https://fixture.invalid/a';
    const other = 'https://fixture.invalid/b';
    const subscribe = (userId, endpoint) => invoke('post', '/subscribe', userId, {
      subscription: { endpoint, keys: { p256dh: 'fixture', auth: 'fixture' } },
    });
    assert.equal((await subscribe(1, endpoint)).code, 201);
    assert.equal((await subscribe(2, other)).code, 201);
    const status = (await invoke('post', '/status', 2, { endpoint })).data;
    assert.equal(status.subscriptionCount, 1);
    assert.equal(status.deviceSubscribed, false);
    assert.equal(JSON.stringify(status).includes(endpoint), false);
    assert.equal((await invoke('post', '/status', 1, { endpoint })).data.deviceSubscribed, true);
    assert.equal((await invoke('post', '/test', 2, { endpoint })).data.delivery.attempted, 0);
    assert.equal((await invoke('delete', '/subscribe', 2, { endpoint })).data.removed, 0);

    const inbox = await invoke('get', '/', 1);
    assert.deepEqual(inbox.data.notifications.map(n => n.type).sort(), [
      'km_update_needed', 'maintenance_overdue_time', 'maintenance_plan_overdue', 'maintenance_upcoming_km',
    ]);
    assert.equal(accepted.length, 0);
    const events = () => pool.query('SELECT last_result, send_count, last_sent_at, cooldown_until FROM push_notification_events');
    assert.ok((await events()).rows.every(e => e.send_count === 0 && e.last_sent_at === null));
    // Expiration is a failed attempt, and must not start a cooldown or erase another account's endpoint.
    expired = true;
    const failed = await runReminderSweep(pool);
    assert.equal(failed.failed, 1);
    assert.equal(failed.pruned, 1);
    assert.ok((await events()).rows.every(e => e.send_count === 0 && e.cooldown_until === null));
    const manualFail = await invoke('post', '/test', 2, { endpoint: other });
    assert.equal(manualFail.code, 502);
    assert.deepEqual([manualFail.data.delivery.attempted, manualFail.data.delivery.sent, manualFail.data.delivery.failed], [1, 0, 1]);

    expired = false;
    await subscribe(1, endpoint);
    const manual = await invoke('post', '/test', 1, { endpoint });
    assert.equal(manual.data.delivery.sent, 1);
    assert.equal(manual.code, 200);
    const sweeps = await Promise.all([runReminderSweep(pool), runReminderSweep(pool)]);
    assert.equal(sweeps[0].sent + sweeps[1].sent, 4);
    assert.equal(sweeps[0].cooldownSkipped + sweeps[1].cooldownSkipped, 4);
    assert.equal(accepted.length, 5);
    assert.ok(accepted.every(([device, payload]) => device === endpoint && payload.data.userId === 1));
    await invoke('get', '/', 1);
    assert.ok((await events()).rows.every(e => e.send_count === 1 && e.last_result === 'sent'));
    assert.equal((await invoke('get', '/', 2)).data.notifications.length, 0);
    await subscribe(2, endpoint);
    assert.equal((await invoke('post', '/status', 2, { endpoint })).data.deviceSubscribed, true);
    assert.equal((await invoke('post', '/test', 1, { endpoint })).data.delivery.attempted, 0);
  } finally {
    await pool.query('DROP SCHEMA ' + schema + ' CASCADE');
  }
});
