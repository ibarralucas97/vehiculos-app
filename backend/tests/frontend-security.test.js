const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = path.join(__dirname, '../public');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(publicDir, 'service-worker.js'), 'utf8');

function appContext(names, overrides = {}) {
  const context = vm.createContext({ URL, console, window: { location: { origin: 'https://test.local' } }, ...overrides });
  for (const name of names) {
    const match = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`, 'm'));
    assert.ok(match, name);
    vm.runInContext(match[0], context);
  }
  return context;
}
const payload = `<img src=x onerror="globalThis.pwned=1"> ' & <script>alert(1)</script>`;
const renderNames = ['escapeHtml', 'safeRecordId', 'optionMarkup', 'getMaintenanceImageSource',
  'formatMaintenanceDate', 'formatMaintenanceListKm', 'cacheMaintenanceItems', 'getMaintenanceRecord',
  'removeCachedMaintenance', 'buildMaintenanceDetailMarkup', 'renderMaintenanceCards', 'buildItemActionButton', 'loadPlacesList', 'viewPlace'];
function rendering() {
  return appContext(renderNames, {
    currentMaintenanceRecords: new Map(), getSession: () => ({}), normalizeSessionUser: x => x,
    buildFullName: () => payload, formatCurrency: () => '$ 10', formatDistance: () => '100 km', buildIconMarkup: () => '',
  });
}

test('H01: options preserve literal labels and constrain identifier attributes', () => {
  const c = rendering();
  assert.equal(c.optionMarkup([{ id: 7, nombre: payload }], 'nombre'), `<option value="7">${c.escapeHtml(payload)}</option>`);
  assert.equal(c.optionMarkup([{ id: '1" onfocus="alert(1)', nombre: 'A & B' }], 'nombre'), '<option value="0">A &amp; B</option>');
  for (const id of [-1, Infinity, '1);alert(1)', 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.equal(c.safeRecordId(id), 0);
});

test('H01: cards and detail escape all persisted text; image controls remain', () => {
  const c = rendering();
  const item = { id: 3, accion: payload, lugar: payload, vehiculo: payload, modelo: payload,
    patente: payload, observaciones: payload, image_source: 'data:image/png;base64,YQ==', fecha: '2026-11-17', km: 100 };
  const container = {};
  c.renderMaintenanceCards([item], container);
  assert.ok(container.innerHTML.includes(c.escapeHtml(payload)));
  assert.ok(!container.innerHTML.includes(payload));
  assert.match(container.innerHTML, /openMaintenanceDetail\(3\)/);
  const detail = c.buildMaintenanceDetailMarkup(c.getMaintenanceRecord(3));
  assert.ok(!detail.includes(payload));
  assert.equal(detail.split(c.escapeHtml(payload)).length - 1, 9);
  assert.match(detail, /src="data:image\/png;base64,YQ=="/);
  for (const control of ['openMaintenanceImageLightboxById', 'editMaintenance', 'deleteMaintenance']) assert.ok(detail.includes(`${control}(3)`));
  assert.ok(detail.includes(`alt="Imagen del mantenimiento ${c.escapeHtml(payload)}"`));
  c.removeCachedMaintenance(3);
  assert.equal(c.getMaintenanceRecord(3), null);
});

test('H01: place list and detail escape name, location and contact fields', async () => {
  const c = rendering(); const container = {};
  const place = { id: 9, nombre: payload, ubicacion: payload, contacto_nombre: payload, contacto_numero: payload };
  c.fetchJson = async () => [place]; c.document = { getElementById: () => container };
  await c.loadPlacesList();
  assert.ok(!container.innerHTML.includes(payload));
  assert.match(container.innerHTML, /viewPlace\(9\)/);
  let modal; c.openUiModal = value => { modal = value; };
  c.viewPlace(9);
  assert.equal(modal.bodyHtml.split(c.escapeHtml(payload)).length - 1, 4);
});

test('H01: URL validation rejects executable schemes and escapes URL quotes', () => {
  const c = rendering();
  for (const image_source of ['javascript:alert(1)', 'data:text/html;base64,YQ==', 'data:image/svg+xml;base64,YQ==', 'https://user:pass@test.local/a']) {
    assert.equal(c.getMaintenanceImageSource({ image_source }), '');
  }
  for (const image_source of ['data:image/jpeg;base64,YQ==', 'https://images.test/photo.png', '/photo.png']) assert.ok(c.getMaintenanceImageSource({ image_source }));
  const detail = c.buildMaintenanceDetailMarkup({ id: 1, image_source: 'https://images.test/a?x=" onerror="alert(1)' });
  assert.ok(!detail.includes(' onerror="'));
});

function sessionContext() {
  const storage = new Map([['session', JSON.stringify({ id: 1 })], ['legacy', '{"3":"private"}']]);
  const cleared = [];
  const c = appContext(['getSession', 'saveSession', 'clearSession', 'removeLegacyMaintenanceImages', 'clearPrivateMaintenanceState', 'clearPrivatePhotoState', 'renderVehiclePhotoPreview', 'setProfileAvatar', 'fetchJson', 'getMaintenanceImageSource', 'cacheMaintenanceItems', 'getMaintenanceRecord'], {
    SESSION_KEY: 'session', MAINTENANCE_IMAGES_KEY: 'legacy', sessionGeneration: 0,
    vehicleForm: null, profileForm: null, vehiclePhotoInput: null, profilePhotoInput: null,
    vehiclePhotoPreviewImg: null, vehiclePhotoPreviewFallback: null, vehiclePhotoMessage: null,
    profileAvatarImage: null, profileAvatarPreview: null, profileAvatarFallback: null, profilePhotoMessage: null,
    currentMaintenanceRecords: new Map(), currentPlaces: [], currentVehicles: [],
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    normalizeSessionUser: x => x, resetMaintenanceFormState: () => cleared.push('form'),
    closeMaintenanceImageLightbox: () => cleared.push('lightbox'), closeMaintenanceDetail: () => cleared.push('detail'),
    maintenanceDetailTitle: {}, document: { getElementById: id => ({ replaceChildren: () => cleared.push(id), reset: () => cleared.push(id) }) },
    setTopbarUnreadBadge: () => {}, updateSessionUI: () => {}, renderNotificationsInbox: () => {}, closeModal: () => {},
  });
  return { c, storage, cleared };
}

test('H02: logout cleanup removes legacy storage, records, preview and detail references', () => {
  const { c, storage, cleared } = sessionContext();
  c.cacheMaintenanceItems([{ id: 3, image_source: 'data:image/png;base64,YQ==' }]);
  c.clearSession();
  assert.equal(storage.size, 0); assert.equal(c.getMaintenanceRecord(3), null);
  for (const key of ['form', 'lightbox', 'detail', 'maintenance-list', 'vehiculo_id', 'lugar_id']) assert.ok(cleared.includes(key));
  assert.match(app, /function logout\(\) \{[^]*?clearSession\(\)/);
  assert.ok(!app.includes('maintenanceImageRefs'));
  assert.ok(!app.includes('localStorage.setItem(MAINTENANCE_IMAGES_KEY'));
});

test('H02: account change does not reuse another account image with same record ID', () => {
  const { c } = sessionContext();
  c.cacheMaintenanceItems([{ id: 3, image_source: 'data:image/png;base64,YQ==' }]);
  c.saveSession({ id: 2 });
  assert.equal(c.getMaintenanceRecord(3), null);
  c.cacheMaintenanceItems([{ id: 3, image_source: null }]);
  assert.equal(c.getMaintenanceImageSource(c.getMaintenanceRecord(3)), '');
});

test('H02: a late response cannot repopulate private state or invalidate the next user', async () => {
  const { c } = sessionContext(); let finish;
  c.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = c.fetchJson('/maintenance');
  c.clearSession(); c.saveSession({ id: 2 });
  finish({ ok: false, status: 401, text: async () => '{"error":"old session"}' });
  await assert.rejects(pending, /sesion cambio/);
  assert.equal(c.getSession().id, 2);
});

test('H02: current 401 invalidates private references and propagates API error', async () => {
  const { c, storage } = sessionContext();
  c.console = { error() {} };
  c.fetch = async () => ({ ok: false, status: 401, text: async () => '{"error":"expired"}' });
  await assert.rejects(c.fetchJson('/maintenance'), /expired/);
  assert.equal(storage.size, 0);
});

function worker() {
  const listeners = {}, stores = new Map(), requests = [];
  const key = value => new URL(typeof value === 'string' ? value : value.url, 'https://test.local').href;
  const caches = {
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return { match: async request => data.get(key(request)), put: async (request, response) => data.set(key(request), response) };
    }, keys: async () => [...stores.keys()], delete: async name => stores.delete(name),
  };
  function response(url, options = {}) {
    const p = new URL(url, 'https://test.local').pathname;
    const mime = p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.png') ? 'image/png' : 'text/html';
    return { status: 200, type: 'basic', redirected: false, headers: new Headers({ 'Content-Type': mime }), clone() { return this; }, ...options };
  }
  const notifications = [], navigations = [];
  const clients = { claim: async () => {}, matchAll: async () => [], openWindow: async url => navigations.push(url) };
  const c = vm.createContext({ URL, Headers, caches, clients, self: { location: { origin: 'https://test.local' }, clients,
    addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: async () => {},
    registration: { showNotification: async (...args) => notifications.push(args) } },
    fetch: async (request, options) => { requests.push({ request, options }); return response(typeof request === 'string' ? request : request.url); },
  });
  vm.runInContext(sw, c);
  const dispatch = async (type, values = {}) => {
    let promise; listeners[type]({ ...values, waitUntil: p => { promise = p; }, respondWith: p => { promise = p; } });
    return await promise;
  };
  const request = (url, overrides = {}) => ({ url: key(url), method: 'GET', destination: '', mode: 'cors', headers: new Headers(), ...overrides });
  return { c, stores, dispatch, request, response, requests, notifications, navigations };
}

test('H02: installation only caches existing allowlisted local static resources', async () => {
  const w = worker(); await w.dispatch('install');
  const data = w.stores.get('rodado-control-v22');
  assert.ok(data.size > 30);
  for (const url of data.keys()) {
    const pathname = new URL(url).pathname;
    assert.ok(fs.existsSync(path.join(publicDir, pathname === '/' ? 'index.html' : pathname)));
    assert.ok(w.requests.every(r => r.options.credentials === 'omit'));
  }
});

test('H02: activity, unknown private routes, queries and non-GET never enter cache', async () => {
  const w = worker(); await w.dispatch('install');
  const before = [...w.stores.get('rodado-control-v22').keys()];
  for (const request of [w.request('/activity'), w.request('/private-future-route'), w.request('/maintenance'),
    w.request('/images/private.png'), w.request('/app.js?user=1'),
    w.request('/app.js', { method: 'POST' }), w.request('/app.js', { headers: new Headers({ Authorization: 'Bearer test' }) }),
    w.request('/', { destination: '', mode: 'cors' })]) {
    await w.dispatch('fetch', { request });
    assert.equal(w.requests.at(-1).options.cache, 'no-store');
  }
  assert.deepEqual([...w.stores.get('rodado-control-v22').keys()], before);
});

test('H02: activation deletes v21 private data and all earlier cache versions', async () => {
  const w = worker(); w.stores.set('rodado-control-v21', new Map([['/activity', 'private']]));
  w.stores.set('rodado-control-v20', new Map());
  await w.dispatch('install'); await w.dispatch('activate');
  assert.deepEqual([...w.stores.keys()], ['rodado-control-v22']);
});

test('H02: offline shell/static resources work; private endpoints never receive index.html', async () => {
  const w = worker(); await w.dispatch('install');
  w.c.fetch = async () => { throw new Error('offline'); };
  for (const path of ['/', '/index.html', '/app.js', '/styles.css', '/icon-192.png']) {
    const request = w.request(path, path === '/' || path === '/index.html' ? { mode: 'navigate', destination: 'document' } : {});
    assert.equal((await w.dispatch('fetch', { request })).status, 200);
  }
  for (const url of ['/activity', '/unknown-api', '/auth/me']) await assert.rejects(w.dispatch('fetch', { request: w.request(url) }), /offline/);
  w.stores.get('rodado-control-v22').delete('https://test.local/');
  assert.equal((await w.dispatch('fetch', { request: w.request('/', { mode: 'navigate' }) })).status, 200);
});

test('H02: redirected, opaque, error and wrong MIME responses are not cached', async () => {
  for (const options of [{ redirected: true }, { type: 'opaque' }, { status: 500 }, { headers: new Headers({ 'Content-Type': 'application/json' }) }]) {
    const w = worker(); w.c.fetch = async () => w.response('/app.js', options);
    await w.dispatch('fetch', { request: w.request('/app.js') });
    assert.equal(w.stores.get('rodado-control-v22').size, 0);
    await assert.rejects(w.dispatch('install'), /Invalid shell response/);
  }
});

test('H02: push and notificationclick remain operational, including text payload fallback', async () => {
  const w = worker();
  await w.dispatch('push', { data: { json: () => ({ title: 'Recordatorio', body: 'Revisar', data: { url: '/?vehicle=2' } }) } });
  assert.equal(w.notifications[0][0], 'Recordatorio');
  assert.equal(w.notifications[0][1].body, 'Revisar');
  await w.dispatch('push', { data: { json: () => { throw new Error(); }, text: () => 'Texto' } });
  assert.equal(w.notifications[1][1].body, 'Texto');
  let closed = false;
  await w.dispatch('notificationclick', { notification: { close: () => { closed = true; }, data: { url: '/?vehicle=2' } } });
  assert.equal(closed, true); assert.equal(w.navigations[0], 'https://test.local/?vehicle=2');
});

test('H02: offline notification deep links use the public shell without caching query data', async () => {
  const w = worker(); await w.dispatch('install');
  w.c.fetch = async () => { throw new Error('offline'); };
  assert.equal((await w.dispatch('fetch', { request: w.request('/?vehicleId=2', { mode: 'navigate', destination: 'document' }) })).status, 200);
  assert.ok([...w.stores.get('rodado-control-v22').keys()].every(url => !new URL(url).search));
});

test('H01/H02: image lightbox uses the current record and cleanup removes its source', () => {
  const img = { src: '', removeAttribute(name) { delete this[name]; } };
  const calls = [];
  const c = appContext(['getMaintenanceImageSource', 'getMaintenanceRecord', 'openMaintenanceImageLightboxById', 'closeMaintenanceImageLightbox', 'clearMaintenanceImagePreview', 'resetMaintenanceFormState', 'editMaintenance'], {
    currentMaintenanceRecords: new Map([[3, { id: 3, accion: payload, fecha: '2026-11-17', lugar_id: 9, km: 100, cost: 10, image_source: 'data:image/png;base64,YQ==' }]]),
    maintenanceImageLightboxImg: img, maintenanceImagePreviewImg: { src: 'private' },
    maintenanceImagePreview: { classList: { add: value => calls.push(value) } },
    openModal: id => calls.push(id), closeModal: id => calls.push(id), closeMaintenanceDetail: () => {},
    maintenanceForm: { elements: Object.fromEntries(['fecha', 'lugar_id', 'accion', 'km', 'cost'].map(key => [key, {}])), reset: () => calls.push('reset') },
    maintenanceSubmitButton: {}, formMessage: {}, focusDashboardSection: () => {}, maintenanceSection: {},
  });
  c.openMaintenanceImageLightboxById(3);
  assert.equal(img.src, 'data:image/png;base64,YQ==');
  c.closeMaintenanceImageLightbox(); assert.equal(img.src, undefined);
  c.editMaintenance(3); assert.equal(c.maintenanceForm.elements.accion.value, payload);
  assert.equal(c.maintenanceForm.elements.lugar_id.value, '9');
  assert.equal(c.maintenanceImagePreviewImg.src, '');
  c.resetMaintenanceFormState(); assert.ok(calls.includes('reset'));
});

test('H02: startup deletes legacy image storage; cross-tab session changes clear private state', () => {
  assert.match(app, /let sessionGeneration = 0;\s*removeLegacyMaintenanceImages\(\);/);
  const start = app.indexOf('window.addEventListener("storage",');
  const end = app.indexOf('\n});', start) + 4;
  let listener, cleared = 0;
  vm.runInNewContext(app.slice(start, end), {
    window: { addEventListener: (_type, fn) => { listener = fn; } }, SESSION_KEY: 'session',
    clearPrivateMaintenanceState: () => { cleared++; }, updateSessionUI: () => {},
  });
  listener({ key: 'theme' }); assert.equal(cleared, 0);
  listener({ key: 'session' }); listener({ key: null }); assert.equal(cleared, 2);
});

// Load the complete second script after app.js functions, preserving override order.
const enhancements = fs.readFileSync(path.join(publicDir, 'dashboard-enhancements.js'), 'utf8');
function effectiveDashboard() {
  const { c, storage } = sessionContext();
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: '', className: '', disabled: false,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, toggleAttribute() {},
      replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
      reset() { this.value = ''; },
    });
    return elements.get(id);
  }
  c.document = { getElementById: element };
  for (const name of ['escapeHtml', 'safeRecordId', 'viewPlace', 'viewVehicle', 'formatNotificationTime', 'renderNotificationsInbox', 'loadNotificationsInbox', 'refreshNotificationControls']) {
    const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`, 'm'));
    assert.ok(source, name); vm.runInContext(source[0], c);
  }
  for (const match of app.matchAll(/const (notifications\w+) = document.getElementById\("([^"]+)"\);/g)) c[match[1]] = element(match[2]);
  Object.assign(c, { URLSearchParams, setTimeout, sessionGeneration: 0, selectedVehicleId: 1,
    selectVehicle() {}, goBackToVehicles() {}, refreshAllData: async () => {}, loadMaintenance: async () => {},
    buildIconMarkup: () => '', notificationsState: { filter: 'all' }, currentNotifications: [],
  });
  const originalPlace = c.viewPlace, originalVehicle = c.viewVehicle;
  vm.runInContext(enhancements, c);
  assert.notEqual(c.viewPlace, originalPlace); assert.notEqual(c.viewVehicle, originalVehicle);
  return { c, storage, element };
}

test('H01: effective detail overrides escape every vehicle and place field', () => {
  const { c, element } = effectiveDashboard();
  assert.equal(c.viewPlace.name, 'patchedViewPlace');
  assert.equal(c.viewVehicle.name, 'patchedViewVehicle');
  c.currentPlaces = [{ id: 1, nombre: payload, ubicacion: payload, contacto_nombre: payload, contacto_numero: payload }];
  c.viewPlace(1);
  let html = element('ui-modal-body').innerHTML;
  assert.ok(!html.includes(payload)); assert.equal(html.split(c.escapeHtml(payload)).length - 1, 4);
  c.currentVehicles = [{ id: 1, nombre: payload, modelo: payload, patente: payload, km_actual: payload,
    ultimo_service_km: payload, intervalo_km: payload, intervalo_tiempo: payload }];
  c.viewVehicle(1);
  html = element('ui-modal-body').innerHTML;
  assert.ok(!html.includes(payload)); assert.equal(html.split(c.escapeHtml(payload)).length - 1, 7);
});

test('H01: effective reminder rendering escapes normal and alert branches', () => {
  const { c, element } = effectiveDashboard();
  const reminder = { vehicleName: payload, message: payload, statusLabel: payload, status: '" onclick="bad()',
    nextKm: null, kmRemaining: null, daysRemaining: payload };
  for (const alerts of [[], [reminder]]) {
    c.renderOverview({ selectedReminder: reminder, alerts });
    const html = element('reminders-list').innerHTML;
    assert.ok(!html.includes(payload)); assert.ok(html.includes(c.escapeHtml(payload)));
    assert.ok(!html.includes('onclick='));
  }
});

test('H01: plan labels, derived detail, class and handler attributes remain safe', async () => {
  const { c, element } = effectiveDashboard();
  const plan = { id: '1);alert(1)', name: payload, status_label: payload, status: '" onmouseover="bad()',
    is_active: true, km_remaining: payload, days_remaining: null };
  c.fetchJson = async () => [plan];
  await c.loadMaintenancePlans();
  const html = c.renderPlanTimeline();
  assert.ok(!html.includes(payload)); assert.ok(html.includes(c.escapeHtml(payload)));
  assert.match(html, /onclick="toggleMaintenancePlan\(0\)"/);
  assert.ok(!html.includes('onmouseover='));
  assert.ok(element('maintenance-plan-select').innerHTML.includes(`<option value="0">${c.escapeHtml(payload)}</option>`));
});

test('H01: effective dashboard error output escapes API error messages', async () => {
  const { c, element } = effectiveDashboard();
  c.fetchJson = async () => { throw new Error(payload); };
  await c.loadDashboardOverview();
  assert.equal(element('reminders-list').innerHTML, `<div class="vehicle-detail-empty">${c.escapeHtml(payload)}</div>`);
});

test('H01: maintenance delete error modal escapes the message and still rejects', async () => {
  const c = appContext(['escapeHtml', 'deleteMaintenance'], {
    getSession: () => ({ id: 1 }), showAppLoading() {}, hideAppLoading() {},
    fetchJson: async () => { throw new Error(payload); },
  });
  const modals = []; c.openUiModal = async options => { modals.push(options); return true; };
  await assert.rejects(c.deleteMaintenance(1), error => error.message === payload);
  assert.equal(modals[1].bodyHtml, `<p>${c.escapeHtml(payload)}</p>`);
  // Also cover the export and init error templates, whose workflows need browser APIs.
  assert.ok(!/\$\{(?:error|err)\.message\}/.test(app));
});

test('H02: account switch clears effective plans, notifications, reminders and pending confirmation', async () => {
  const { c, element } = effectiveDashboard();
  c.fetchJson = async () => [{ id: 7, name: 'private A', is_active: true, status: 'scheduled', km_remaining: null, days_remaining: null }];
  await c.loadMaintenancePlans();
  c.currentNotifications = [{ id: 5, title: 'private A', body: 'private A' }];
  c.notificationsState = { filter: 'all', loading: true, unreadCount: 5, hasMore: true };
  c.renderNotificationsInbox();
  element('reminders-list').innerHTML = 'private A';
  element('vehicle-reminders-summary-note').textContent = 'private A';
  c.notificationsServerStatus = { subscriptionCount: 5 }; c.notificationsLastSyncAt = 'private A';
  const confirmation = c.openUiModal({ title: 'private A', bodyHtml: 'private A', onConfirm: () => { throw new Error('stale action'); } });
  c.saveSession({ id: 2 });
  assert.equal(await confirmation, false);
  assert.equal(vm.runInContext('currentMaintenancePlans.length', c), 0);
  assert.equal(c.currentNotifications.length, 0); assert.equal(c.notificationsState.loading, false);
  assert.equal(c.notificationsState.unreadCount, 0); assert.equal(c.notificationsServerStatus, null);
  assert.equal(c.notificationsLastSyncAt, null);
  for (const id of ['maintenance-plans-list', 'maintenance-plan-select', 'notifications-inbox-list', 'reminders-list', 'ui-modal-body']) assert.equal(element(id).innerHTML, '');
  assert.equal(element('ui-modal-confirm')._onConfirm, null);
  assert.equal(element('vehicle-reminders-summary-note').textContent, '');
  assert.ok(!c.renderPlanTimeline().includes('private A'));
});

test('H02: stale notification request cannot unlock or render the next account inbox', async () => {
  const { c } = effectiveDashboard(); let finish;
  c.fetchJson = () => new Promise(resolve => { finish = resolve; });
  const pending = c.loadNotificationsInbox();
  c.saveSession({ id: 2 });
  c.notificationsState.loading = true;
  finish({ notifications: [{ id: 1, body: 'private A' }] });
  await pending;
  assert.equal(c.currentNotifications.length, 0); assert.equal(c.notificationsState.loading, true);
});

test('H02: late dashboard failure does not overwrite the next account overview', async () => {
  const { c, element } = effectiveDashboard(); let fail;
  c.fetchJson = () => new Promise((_resolve, reject) => { fail = reject; });
  const pending = c.loadDashboardOverview();
  c.saveSession({ id: 2 });
  element('overview-status-label').textContent = 'B';
  fail(new Error('private A'));
  await pending;
  assert.equal(element('overview-status-label').textContent, 'B');
  assert.equal(element('reminders-list').innerHTML, '');
});

test('H02: external requests are not intercepted, fetched or cached by the worker', async () => {
  const w = worker(); await w.dispatch('install');
  const before = w.requests.length;
  const keys = [...w.stores.get('rodado-control-v22').keys()];
  for (const url of ['https://external.test/app.js', 'https://fonts.googleapis.com/css2?family=Manrope', 'https://cdn.jsdelivr.net/npm/bootstrap/file.js']) {
    assert.equal(await w.dispatch('fetch', { request: w.request(url) }), undefined);
  }
  assert.equal(w.requests.length, before);
  assert.deepEqual([...w.stores.get('rodado-control-v22').keys()], keys);
});

test('H02: pending push subscription lookup cannot restore previous user controls', async () => {
  const { c, element } = effectiveDashboard(); let finish, started;
  const lookupStarted = new Promise(resolve => { started = resolve; });
  c.isPushSupportedInBrowser = () => true;
  c.fetchNotificationServerStatus = async () => ({ pushConfigured: true, subscriptionCount: 1 });
  c.getCurrentPushSubscription = () => new Promise(resolve => { finish = resolve; started(); });
  c.notificationStateLoading = false;
  c.setNotificationStatus = message => { element('notifications-status').textContent = message; };
  const pending = c.refreshNotificationControls();
  await lookupStarted;
  c.saveSession({ id: 2 });
  c.notificationStateLoading = true;
  finish({ endpoint: 'private A' });
  await pending;
  assert.equal(element('notifications-status').textContent, '');
  assert.equal(c.notificationStateLoading, true);
});


function photoContext() {
  const { c } = sessionContext();
  const handlers = {};
  function node() {
    const classes = new Set();
    return {
      value: '', textContent: '', innerHTML: '', files: [],
      removeAttribute(name) { delete this[name]; },
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        contains: name => classes.has(name),
      },
    };
  }
  for (const name of ['vehiclePhotoInput', 'profilePhotoInput', 'vehiclePhotoPreviewImg',
    'vehiclePhotoPreviewFallback', 'vehiclePhotoMessage', 'profileAvatarImage',
    'profileAvatarPreview', 'profileAvatarFallback', 'profilePhotoMessage']) c[name] = node();
  function form(names) {
    return { elements: Object.fromEntries(names.map(name => [name, node()])),
      reset() { for (const input of Object.values(this.elements)) input.value = ''; } };
  }
  c.vehicleForm = form(['nombre', 'photo_url', 'photo_public_id']);
  c.profileForm = form(['nombre', 'apellido', 'email', 'profile_photo_url']);
  c.buildIconMarkup = () => '<svg></svg>';
  c.buildFullName = () => 'Usuario';
  for (const type of ['vehicle', 'profile']) {
    const inputName = `${type}PhotoInput`;
    c[inputName].addEventListener = (_event, handler) => { handlers[type] = handler; };
    const start = app.indexOf(`${inputName}?.addEventListener("change", async () => {`);
    assert.ok(start >= 0);
    const end = app.indexOf('\n});', start) + 4;
    vm.runInContext(app.slice(start, end), c);
  }
  function seed(owner) {
    for (const type of ['Vehicle', 'Profile']) {
      c[`selected${type}PhotoFile`] = { name: `${owner}.png` };
      c[`selected${type}PhotoDataUrl`] = `data:image/png;base64,${owner}`;
    }
    c.vehiclePhotoInput.value = owner;
    c.profilePhotoInput.value = owner;
    for (const form of [c.vehicleForm, c.profileForm]) {
      for (const field of Object.values(form.elements)) field.value = owner;
    }
    c.renderVehiclePhotoPreview(owner);
    c.setProfileAvatar(owner, owner);
    c.vehiclePhotoMessage.textContent = owner;
    c.profilePhotoMessage.textContent = owner;
  }
  function snapshot() {
    return JSON.stringify({
      files: [c.selectedVehiclePhotoFile, c.selectedProfilePhotoFile],
      urls: [c.selectedVehiclePhotoDataUrl, c.selectedProfilePhotoDataUrl],
      inputs: [c.vehiclePhotoInput.value, c.profilePhotoInput.value],
      fields: [c.vehicleForm, c.profileForm].map(form => Object.values(form.elements).map(field => field.value)),
      previews: [c.vehiclePhotoPreviewImg.src, c.profileAvatarImage.src],
      hidden: [c.vehiclePhotoPreviewImg.classList.contains('hidden'), c.profileAvatarPreview.classList.contains('hidden')],
      messages: [c.vehiclePhotoMessage.textContent, c.profilePhotoMessage.textContent],
      fallback: c.profileAvatarFallback.textContent,
    });
  }
  return { c, handlers, seed, snapshot };
}

test('H02: session cleanup releases both photo files, data URLs, form values and previews', () => {
  const { c, seed } = photoContext();
  seed('A');
  c.clearSession();
  assert.equal(c.selectedVehiclePhotoFile, null);
  assert.equal(c.selectedProfilePhotoFile, null);
  assert.equal(c.selectedVehiclePhotoDataUrl, '');
  assert.equal(c.selectedProfilePhotoDataUrl, '');
  assert.equal(c.vehiclePhotoInput.value, '');
  assert.equal(c.profilePhotoInput.value, '');
  for (const form of [c.vehicleForm, c.profileForm]) {
    for (const field of Object.values(form.elements)) assert.equal(field.value, '');
  }
  assert.equal(c.vehiclePhotoPreviewImg.src, undefined);
  assert.equal(c.profileAvatarImage.src, undefined);
  assert.equal(c.vehiclePhotoPreviewImg.classList.contains('hidden'), true);
  assert.equal(c.profileAvatarPreview.classList.contains('hidden'), true);
  assert.equal(c.vehiclePhotoPreviewFallback.classList.contains('hidden'), false);
  assert.equal(c.profileAvatarFallback.classList.contains('hidden'), false);
  assert.equal(c.profileAvatarFallback.textContent, 'RC');
});

for (const type of ['profile', 'vehicle']) {
  for (const outcome of ['resolve', 'reject']) {
    for (const transition of ['account change', 'logout']) {
      test(`H02: pending ${type} photo ${outcome} after ${transition} cannot restore A or alter B`, async () => {
        const { c, handlers, seed, snapshot } = photoContext();
        seed('A');
        const fileA = { name: 'A.png' };
        c[`${type}PhotoInput`].files = [fileA];
        let resolve, reject;
        c.prepareUploadImageData = () => new Promise((yes, no) => { resolve = yes; reject = no; });
        const pending = handlers[type]();
        if (transition === 'account change') {
          c.saveSession({ id: 2 });
          seed('B');
        } else {
          c.clearSession();
        }
        const expected = snapshot();
        if (outcome === 'resolve') resolve({ dataUrl: 'data:image/png;base64,PRIVATE_A' });
        else reject(new Error('Private error from A'));
        await pending;
        assert.equal(snapshot(), expected);
      });
    }
    test(`H02: current-session ${type} photo ${outcome} retains normal preview/error behavior`, async () => {
      const { c, handlers } = photoContext();
      const file = { name: 'current.png' };
      c[`${type}PhotoInput`].files = [file];
      c.prepareUploadImageData = async () => {
        if (outcome === 'reject') throw new Error('Invalid image');
        return { dataUrl: 'data:image/png;base64,YQ==' };
      };
      await handlers[type]();
      const prefix = type === 'profile' ? 'Profile' : 'Vehicle';
      if (outcome === 'resolve') {
        assert.equal(c[`selected${prefix}PhotoFile`], file);
        assert.equal(c[`selected${prefix}PhotoDataUrl`], 'data:image/png;base64,YQ==');
        assert.equal((type === 'profile' ? c.profileAvatarImage : c.vehiclePhotoPreviewImg).src, 'data:image/png;base64,YQ==');
      } else {
        assert.equal(c[`selected${prefix}PhotoFile`], null);
        assert.equal(c[`selected${prefix}PhotoDataUrl`], '');
        assert.equal(c[`${type}PhotoMessage`].textContent, 'Invalid image');
      }
    });
  }
}
