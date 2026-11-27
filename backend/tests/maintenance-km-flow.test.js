const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const enhancements = fs.readFileSync(path.join(__dirname, '../public/dashboard-enhancements.js'), 'utf8');
function context(names, overrides = {}) {
  const c = vm.createContext({ sessionGeneration: 0, selectedVehicleId: 1, console: { error() {} }, ...overrides });
  for (const name of names) {
    const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`, 'm'));
    assert.ok(source, name);
    vm.runInContext(source[0], c);
  }
  return c;
}
function ui() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '15235', textContent: '', innerHTML: '', dataset: {},
      classList: { add() {}, remove() {}, toggle() {} }, replaceChildren() {}, addEventListener() {}, setAttribute() {}, toggleAttribute() {} });
    return elements.get(id);
  };
  const messages = [];
  const c = context(['saveKmUpdateFromModal', 'showSavedSyncWarning', 'setButtonLoading', 'refreshAllData', 'syncSelectedVehicleContext'], {
    window: {}, document: { getElementById: element }, getNumericFieldError: () => '', NUMERIC_FIELD_CONFIG: {},
    getSession: () => ({ id: 1 }), currentVehicles: [{ id: 1, km_actual: 15010 }], selectedVehicleId: 1,
    showAppLoading() {}, hideAppLoading() {}, renderCurrentVehicleKm() {}, syncSelectedVehicleContext() {},
    setStatus: message => messages.push(message), showToast: (message, options) => messages.push({ message, ...options }),
    selectVehicle() {}, goBackToVehicles() {}, viewVehicle() {}, viewPlace() {}, loadMaintenance: async () => {},
    loadSelects: async () => {}, loadVehiclesList: async () => {}, loadPlacesList: async () => {},
    getSelectedVehicle: () => null, currentVehicleName: {}, currentVehicleKm: {}, setTimeout() {}, escapeHtml: String,
  });
  // Use the actual lexical declaration, not a window property, across classic scripts.
  vm.runInContext(app.match(/^let sessionGeneration = 0;$/m)[0], c);
  vm.runInContext(enhancements, c);
  return { c, element, messages };
}
for (const failure of [null, 'patch', 'refresh', 'dashboard']) {
  test(`F01-A: effective scripts, PATCH ${failure || 'success'}`, async () => {
    const { c, element, messages } = ui(); const calls = [];
    c.fetchJson = async (url, options) => {
      calls.push([url, options]);
      if (url.endsWith('/km')) {
        if (failure === 'patch') throw new Error('PATCH rechazado');
        return { id: 1, km_actual: 15235 };
      }
      if (failure === 'dashboard') throw new Error('Dashboard sin conexión');
      if (url.startsWith('/maintenance-plans')) return [];
      return {};
    };
    c.renderOverview = () => {};
    c.renderReminderCount = () => {};
    if (failure === 'refresh') c.renderCurrentVehicleKm = () => { throw new Error('Fallo visual'); };
    const result = await c.saveKmUpdateFromModal(c.currentVehicles[0]);
    assert.equal(result, failure !== 'patch');
    assert.equal(c.currentVehicles[0].km_actual, failure === 'patch' ? 15010 : 15235);
    assert.equal(calls.filter(([url]) => url.endsWith('/km')).length, 1);
    if (failure === 'patch') assert.equal(element('km-update-feedback').textContent, 'PATCH rechazado');
    else if (failure) {
      assert.ok(messages.some(m => m.tone === 'warning' && m.message.includes('no repitas el guardado')));
      assert.ok(!messages.some(m => m.tone === 'error'));
    } else assert.ok(messages.some(m => m.tone === 'success'));
  });
}
test('F01-A/H02: late PATCH cannot overwrite the next account', async () => {
  const { c } = ui(); let finish;
  c.fetchJson = () => new Promise(resolve => { finish = resolve; });
  const pending = c.saveKmUpdateFromModal(c.currentVehicles[0]);
  vm.runInContext('sessionGeneration += 1', c);
  c.currentVehicles = [{ id: 2, km_actual: 20 }];
  finish({ id: 1, km_actual: 15235 });
  assert.equal(await pending, true);
  assert.equal(c.currentVehicles[0].id, 2);
});

function maintenanceUi(edit = false) {
  let submit;
  const messages = [], calls = [];
  const c = context(['showSavedSyncWarning', 'setButtonLoading', 'resetMaintenanceFormState', 'safeRecordId'], {
    sessionGeneration: 0, maintenanceSaveGeneration: null, selectedVehicleId: 1,
    editingMaintenanceId: edit ? 9 : null, formMessage: {}, maintenanceSubmitButton: { dataset: {} },
    maintenanceForm: { addEventListener: (_type, fn) => { submit = fn; }, reset: () => calls.push('reset') },
    filtersForm: { reset: () => calls.push('clear filters') }, maintenanceImageInput: { files: [] },
    clearMaintenanceImagePreview: () => calls.push('clear image'),
    FormData: class { entries() { return Object.entries({ fecha: '2020-01-01', km: '15235', lugar_id: '1', accion: 'Aceite' }); } },
    validateSelectedMaintenanceImage: () => ({ ok: true }), NUMERIC_FIELD_CONFIG: {},
    normalizeNumericPayloadValue: x => x, prepareMaintenanceImageData: async () => ({ dataUrl: '', mimeType: '' }),
    getSession: () => ({ id: 1 }), getMaintenanceRecord: () => null, historySection: {}, historyCopy: {},
    focusDashboardSection: () => calls.push('history'), renderMaintenance: rows => calls.push(['render', rows]),
    loadMaintenance: async options => calls.push(['load', options]), refreshAllData: async () => calls.push('refresh'),
    setStatus: message => messages.push(message), showToast: (message, options) => messages.push({ message, ...options }),
  });
  const start = app.indexOf('maintenanceForm?.addEventListener("submit"');
  vm.runInContext(app.slice(start, app.indexOf('\nfiltersForm?.addEventListener', start)), c);
  return { c, calls, messages, submit: () => submit({ preventDefault() {} }) };
}
for (const edit of [false, true]) {
  for (const failure of [null, 'save', 'history', 'refresh']) {
    test(`F01-C: ${edit ? 'edit' : 'create'} with ${failure || 'success'}`, async () => {
      const { c, calls, messages, submit } = maintenanceUi(edit);
      c.fetchJson = async (_url, options) => {
        assert.equal(options.method, edit ? 'PUT' : 'POST');
        if (failure === 'save') throw new Error('Rechazado');
        return { id: 9, km: 15235 };
      };
      if (failure === 'history') c.loadMaintenance = async () => { throw new Error('history'); };
      if (failure === 'refresh') c.refreshAllData = async () => { throw new Error('refresh'); };
      await submit();
      if (failure === 'save') {
        assert.equal(c.formMessage.textContent, 'Rechazado');
        assert.ok(!calls.includes('reset')); assert.equal(messages.length, 0);
      } else {
        assert.ok(calls.includes('reset')); assert.ok(calls.includes('clear image')); assert.ok(calls.includes('clear filters'));
        assert.ok(calls.includes('history'));
        assert.equal(calls.find(call => call[0] === 'render')[1][0].id, 9);
        assert.ok(messages.some(m => m.message === (edit ? 'Mantenimiento actualizado correctamente' : 'Mantenimiento registrado correctamente')));
        if (failure) assert.ok(messages.some(m => m.tone === 'warning'));
        assert.equal(c.editingMaintenanceId, null);
        assert.equal(c.maintenanceSubmitButton.textContent, 'Guardar mantenimiento');
      }
      assert.equal(c.maintenanceSaveGeneration, null);
      assert.equal(c.maintenanceSubmitButton.disabled, false);
    });
  }
}
test('F01-C: duplicate submit is blocked through image preparation, request and refresh', async () => {
  const { c, submit } = maintenanceUi(); let finish, requests = 0;
  c.prepareMaintenanceImageData = () => new Promise(resolve => { finish = resolve; });
  c.fetchJson = async () => { requests++; return { id: 9 }; };
  const pending = submit(); await submit();
  assert.equal(requests, 0);
  finish({ dataUrl: '' }); await pending;
  assert.equal(requests, 1);
});
test('F01-C: a backdated record is visible despite the three-record limit', async () => {
  const items = [1, 2, 3, 9].map(id => ({ id })); let rendered;
  const c = context(['loadMaintenance', 'validateHistoryFilters'], {
    selectedVehicleId: 1, URLSearchParams, FormData: class { entries() { return []; } }, filtersForm: { reportValidity: () => true },
    historyRequest: 0, updateHistoryControls() {}, updateHistoryPlanOptions() {},
    setHistoryState() {}, getSession: () => ({}), historyTitle: {}, historyCopy: {}, setStatus() {},
    fetchJson: async () => items, renderMaintenance: rows => { rendered = rows; },
  });
  await c.loadMaintenance({ highlightId: 9 });
  assert.equal(rendered.length, 3); assert.equal(rendered[0].id, 9);
});
for (const [kmRemaining, expected] of [[500, 'Faltan 500 km para el mantenimiento'], [0, 'El mantenimiento corresponde ahora'], [-135235, 'Mantenimiento vencido por 135.235 km'], [null, 'Faltan datos'], [undefined, 'Faltan datos'], ['', 'Faltan datos']]) {
  test(`F01-D: reminder ${String(kmRemaining)}`, () => {
    const c = context(['buildVehicleReminderSummary'], { formatReminderDate: x => x });
    const result = c.buildVehicleReminderSummary({ kmRemaining, nextDate: '2026-11-18', message: 'Existing message' }, {});
    assert.ok(result.kmText.startsWith(expected));
    assert.equal(result.dateText, 'Proximo mantenimiento estimado: 2026-11-18.');
    assert.equal(result.noteText, 'Existing message');
    assert.match(c.buildVehicleReminderSummary(null, {}).kmText, /Faltan datos/);
  });
}

for (const stage of ['request', 'refresh']) {
  test(`F01-C: duplicate submit blocked during ${stage}`, async () => {
    const { c, submit } = maintenanceUi(); let finish, started; let requests = 0;
    const waiting = new Promise(resolve => { started = resolve; });
    c.fetchJson = async () => {
      requests++;
      if (stage === 'request') return new Promise(resolve => { finish = () => resolve({ id: 9 }); started(); });
      return { id: 9 };
    };
    if (stage === 'refresh') c.refreshAllData = () => new Promise(resolve => { finish = resolve; started(); });
    const pending = submit(); await waiting; await submit();
    assert.equal(requests, 1); finish(); await pending;
    assert.equal(requests, 1);
  });
}
test('F01-C/H02: late successful maintenance save does not reset the next session UI', async () => {
  const { c, submit, calls, messages } = maintenanceUi(); let finish, started;
  const waiting = new Promise(resolve => { started = resolve; });
  c.fetchJson = () => new Promise(resolve => { finish = resolve; started(); });
  const pending = submit(); await waiting; c.sessionGeneration++;
  finish({ id: 9 }); await pending;
  assert.equal(calls.length, 0); assert.equal(messages.length, 0);
});
test('F01-C: recovery refreshes unfiltered history and keeps the saved record selected, without another write', async () => {
  const calls = [];
  const c = context(['refreshCurrentContext'], {
    getSession: () => ({ id: 1 }), topbarTitleAction: null,
    getCurrentView: () => 'dashboard', isModalOpen: () => false,
    isCollapsibleSectionOpen: () => true, historySection: {},
    refreshAllData: async options => calls.push(['refresh', options.throwOnError]),
    syncSelectedVehicleContext() {}, loadMaintenance: async options => calls.push(['history', options.highlightId]),
    showRefreshFeedback() {}, hideRefreshFeedback() {}, showToast() {}, window: { setTimeout() {} },
  });
  await c.refreshCurrentContext({ maintenanceId: 9 });
  assert.deepEqual(calls, [['refresh', true], ['history', 9]]);
});
test('F01-A: injected ReferenceError after confirmed PATCH is a synchronization warning', async () => {
  const { c, messages } = ui();
  c.fetchJson = async () => ({ id: 1, km_actual: 15235 });
  c.loadSelects = async () => { throw new ReferenceError('sessionGeneration is not defined'); };
  assert.equal(await c.saveKmUpdateFromModal(c.currentVehicles[0]), true);
  assert.equal(c.currentVehicles[0].km_actual, 15235);
  assert.ok(messages.some(m => m.tone === 'warning'));
  assert.ok(!messages.some(m => m.tone === 'error'));
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function historyUi() {
  const records = new Map();
  const c = context(['loadMaintenance', 'validateHistoryFilters'], {
    historyRequest: 0, updateHistoryControls() {}, updateHistoryPlanOptions() {},
    URLSearchParams, filtersForm: { reportValidity: () => true }, FormData: class { entries() { return [['search', 'aceite']]; } },
    historyTitle: {}, historyCopy: {}, maintenanceList: {},
    setHistoryState(value) { c.maintenanceList.innerHTML = value; },
    setStatus(value) { c.status = value; },
    renderMaintenance(items) {
      items.forEach(item => records.set(item.id, item));
      c.maintenanceList.innerHTML = JSON.stringify(items);
    },
  });
  return { c, records, snapshot: () => JSON.stringify([c.historyTitle, c.historyCopy, c.maintenanceList, c.status, [...records]]) };
}
for (const transition of ['session', 'vehicle']) {
  for (const outcome of ['resolve', 'reject']) {
    test(`F01 race: history ${outcome} after ${transition} change leaves DOM and cache untouched`, async () => {
      const { c, snapshot } = historyUi(); const old = deferred(); const urls = [];
      c.fetchJson = url => { urls.push(url); return old.promise; };
      const pending = c.loadMaintenance({ highlightId: 1 });
      if (transition === 'session') c.sessionGeneration++; else c.selectedVehicleId = 2;
      c.fetchJson = async () => [{ id: 2, accion: 'B', fecha: '2026-11-18' }];
      await c.loadMaintenance(); const expected = snapshot();
      if (outcome === 'resolve') old.resolve([{ id: 1, accion: 'Private A' }]); else old.reject(new Error('Private A'));
      await pending;
      assert.equal(snapshot(), expected);
      assert.match(urls[0], /search=aceite/); assert.match(urls[0], /vehiculo_id=1/);
    });
    test(`F01 race: plans ${outcome} after ${transition} change cannot restore old plans or select`, async () => {
      const { c, element } = ui(); const old = deferred(); const urls = [];
      c.renderPlanTimeline = plans => JSON.stringify(plans); c.safeRecordId = Number;
      c.fetchJson = url => { urls.push(url); return old.promise; };
      const pending = c.loadMaintenancePlans();
      if (transition === 'session') vm.runInContext('sessionGeneration++', c); else c.selectedVehicleId = 2;
      c.fetchJson = async () => [{ id: 2, name: 'B', is_active: true }];
      await c.loadMaintenancePlans();
      const snapshot = () => JSON.stringify([vm.runInContext('currentMaintenancePlans', c), element('maintenance-plan-select'), element('maintenance-plans-list')]);
      const expected = snapshot();
      if (outcome === 'resolve') old.resolve([{ id: 1, name: 'Private A', is_active: true }]); else old.reject(new Error('Private A'));
      const result = await pending;
      assert.equal(result.length, 0); assert.equal(snapshot(), expected);
      assert.equal(urls[0], '/maintenance-plans?vehicle_id=1');
      assert.match(element('maintenance-plan-select').innerHTML, /B/);
    });
    test(`F01 race: overview ${outcome} after ${transition} change cannot replace newer vehicle status`, async () => {
      const { c, element } = ui(); const old = deferred(); const urls = [];
      c.renderOverview = data => { element('overview-status-copy').textContent = data.owner; };
      c.renderReminderCount = () => {};
      c.fetchJson = url => { urls.push(url); return url.startsWith('/maintenance-plans') ? Promise.resolve([]) : old.promise; };
      const pending = c.loadDashboardOverview({ throwOnError: true });
      if (transition === 'session') vm.runInContext('sessionGeneration++', c); else c.selectedVehicleId = 2;
      c.fetchJson = async url => url.startsWith('/maintenance-plans') ? [] : { owner: 'B' };
      await c.loadDashboardOverview();
      const snapshot = () => JSON.stringify(['overview-status-label', 'overview-status-copy', 'overview-next-service', 'reminders-list'].map(element));
      const expected = snapshot();
      if (outcome === 'resolve') old.resolve({ owner: 'Private A' }); else old.reject(new Error('Private A'));
      await pending; assert.equal(snapshot(), expected);
      assert.equal(urls[0], '/dashboard/overview?vehiculo_id=1');
    });
  }
}
for (const loader of ['loadSelects', 'loadVehiclesList', 'loadPlacesList']) {
  for (const transition of ['session', 'vehicle']) {
    test(`F01 refresh: ${loader} drops late ${transition} response before updating lists`, async () => {
      const old = deferred();
      const container = { innerHTML: 'B' };
      const c = context([loader], {
        fetchJson: () => old.promise, vehicleSelect: container, placeSelect: container, vehiclesListModal: container,
        currentVehicles: ['B'], currentPlaces: ['B'], document: { getElementById: () => container },
        normalizeVehicleRecord: item => item, optionMarkup: () => 'A',
        buildEmptyStateMarkup: () => 'A',
      });
      const pending = c[loader]();
      if (transition === 'session') c.sessionGeneration++; else c.selectedVehicleId = 2;
      old.resolve([]); await pending;
      assert.equal(container.innerHTML, 'B');
      assert.deepEqual(c.currentVehicles, ['B']); assert.deepEqual(c.currentPlaces, ['B']);
    });
  }
}
for (const transition of ['session', 'vehicle']) {
  test(`F01 refresh: effective wrapper stops the old ${transition} refresh chain`, async () => {
    const { c } = ui(); const old = deferred(); const calls = [];
    c.loadSelects = () => old.promise;
    c.loadVehiclesList = async () => calls.push('vehicles');
    c.loadPlacesList = async () => calls.push('places');
    c.loadDashboardOverview = async () => calls.push('overview');
    c.renderCurrentVehicleKm = () => calls.push('km');
    const pending = c.refreshAllData();
    if (transition === 'session') vm.runInContext('sessionGeneration++', c); else c.selectedVehicleId = 2;
    old.resolve(); await pending; assert.deepEqual(calls, []);
  });
}
test('F01 race: guarded history wrapper does not start an overview for an obsolete request', async () => {
  const { c } = ui(); const old = deferred(); let calls = 0;
  // The complete enhancement script captured this original function at initialization.
  const source = enhancements.slice(enhancements.indexOf('const originalLoadMaintenance'), enhancements.indexOf('\nshowNotAvailable ='));
  const isolated = context([], { loadMaintenance: () => old.promise, loadDashboardOverview: async () => { calls++; } });
  vm.runInContext(source, isolated);
  const pending = isolated.loadMaintenance(); isolated.selectedVehicleId = 2;
  old.resolve(); await pending; assert.equal(calls, 0);
});
test('F01 race: confirmed maintenance for vehicle A cannot open its history over vehicle B', async () => {
  const { c, submit, calls, messages } = maintenanceUi(); const old = deferred(); const started = deferred();
  c.fetchJson = () => { started.resolve(); return old.promise; };
  const pending = submit(); await started.promise; c.selectedVehicleId = 2;
  old.resolve({ id: 9, vehiculo_id: 1 }); await pending;
  assert.deepEqual(calls, []); assert.deepEqual(messages, []);
});

test('F01 normal history preserves filters and does not apply the unfiltered three-record limit', async () => {
  const { c } = historyUi(); let url;
  const items = [1, 2, 3, 4].map(id => ({ id, fecha: `2026-01-0${id}` }));
  c.fetchJson = async value => { url = value; return items; };
  await c.loadMaintenance();
  assert.match(url, /search=aceite/);
  assert.deepEqual(JSON.parse(c.maintenanceList.innerHTML).map(item => item.id), [1, 2, 3, 4]);
  assert.match(c.historyCopy.textContent, /filtros aplicados/);
});
for (const outcome of ['resolve', 'reject']) {
  test(`F01 recovery drops late ${outcome} after changing vehicle`, async () => {
    const old = deferred(); const calls = [];
    const c = context(['refreshCurrentContext'], {
      getSession: () => ({ id: 1 }), topbarTitleAction: null, getCurrentView: () => 'dashboard',
      isModalOpen: () => false, refreshAllData: () => old.promise,
      syncSelectedVehicleContext: () => calls.push('context'), loadMaintenance: () => calls.push('history'),
      showRefreshFeedback: () => calls.push('feedback'), hideRefreshFeedback: () => calls.push('hide'),
      showToast: () => calls.push('toast'), window: { setTimeout: fn => fn() },
    });
    const pending = c.refreshCurrentContext(); c.selectedVehicleId = 2; calls.length = 0;
    if (outcome === 'resolve') old.resolve(); else old.reject(new Error('Old vehicle'));
    await pending; assert.deepEqual(calls, []);
  });
}

for (const outcome of ['resolve', 'reject']) {
  test(`F01 lock: A ${outcome} cannot release B's lock or change B's UI`, async () => {
    const { c, submit, calls, messages } = maintenanceUi();
    const first = deferred(), second = deferred(), aStarted = deferred(), bStarted = deferred();
    let requests = 0;
    c.fetchJson = (_url, options) => {
      assert.equal(options.method, 'POST');
      requests++;
      if (requests === 1) { aStarted.resolve(); return first.promise; }
      bStarted.resolve(); return second.promise;
    };
    const a = submit(); await aStarted.promise;
    await submit(); assert.equal(requests, 1);
    assert.equal(c.maintenanceSaveGeneration, 0);
    assert.equal(c.maintenanceSubmitButton.disabled, true);

    // Logout and login invalidate the old generation; cleanup resets the actual form/button.
    c.sessionGeneration++;
    c.resetMaintenanceFormState();
    c.sessionGeneration++;
    c.resetMaintenanceFormState();
    assert.equal(c.maintenanceSubmitButton.disabled, false);
    const b = submit(); await bStarted.promise;
    assert.equal(requests, 2);
    assert.equal(c.maintenanceSaveGeneration, 2);
    c.formMessage.textContent = 'B pendiente';
    c.historyCopy.textContent = 'Historial B';
    const snapshot = () => JSON.stringify([c.formMessage, c.historyCopy, c.maintenanceSubmitButton, c.editingMaintenanceId, calls, messages]);
    const expected = snapshot();
    if (outcome === 'resolve') first.resolve({ id: 1, accion: 'Private A' });
    else first.reject(new Error('Private A'));
    await a;
    assert.equal(snapshot(), expected);
    assert.equal(c.maintenanceSaveGeneration, 2);
    await submit(); assert.equal(requests, 2);

    second.resolve({ id: 2, accion: 'B' }); await b;
    assert.equal(c.maintenanceSaveGeneration, null);
    assert.equal(c.maintenanceSubmitButton.disabled, false);
    assert.equal(calls.find(call => call[0] === 'render')[1][0].id, 2);
    assert.ok(messages.some(message => message.message === 'Mantenimiento registrado correctamente'));
  });
}
test('F01 lock: explicit server rejection releases the current session for a retry', async () => {
  const { c, submit } = maintenanceUi(); let requests = 0;
  c.fetchJson = async () => {
    requests++;
    if (requests === 1) throw new Error('Petición rechazada antes de guardar');
    return { id: 3 };
  };
  await submit();
  assert.equal(c.maintenanceSaveGeneration, null);
  assert.equal(c.maintenanceSubmitButton.disabled, false);
  assert.equal(c.formMessage.textContent, 'Petición rechazada antes de guardar');
  await submit();
  assert.equal(requests, 2);
  assert.equal(c.maintenanceSaveGeneration, null);
  assert.equal(c.maintenanceSubmitButton.disabled, false);
});
