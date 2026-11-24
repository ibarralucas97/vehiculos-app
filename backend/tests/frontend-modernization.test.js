const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const publicDir = path.join(__dirname, '../public');
const source = fs.readFileSync(path.join(publicDir, 'appearance.js'), 'utf8');
function appearance(stored, dark = false, denied = false) {
  const storage = new Map(stored ? [['mygarage_theme', stored]] : []);
  const listeners = {}, windowListeners = {};
  const system = { matches: dark, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const document = { documentElement: { dataset: {}, style: {} }, body: { dataset: {} },
    querySelector: () => ({ setAttribute() {} }), querySelectorAll: () => [], addEventListener() {} };
  const window = { matchMedia: () => system, addEventListener: (name, fn) => { windowListeners[name] = fn; } };
  vm.runInNewContext(source, { window, document, localStorage: {
    getItem: key => { if (denied) throw new Error('denied'); return storage.get(key); },
    setItem: (key, value) => { if (denied) throw new Error('denied'); storage.set(key, value); },
  } });
  return { api: window.RodadoAppearance, storage, document, system, listeners, windowListeners };
}
test('F04: default follows OS and reacts to its changes', () => {
  const c = appearance(); assert.equal(c.document.body.dataset.theme, 'light');
  c.system.matches = true; c.listeners.change(); assert.equal(c.document.body.dataset.theme, 'dark');
});
test('F04: explicit theme survives reload and ignores system changes', () => {
  const c = appearance(); c.api.apply('dark', true);
  assert.equal(c.storage.get('mygarage_theme'), 'dark');
  c.listeners.change(); assert.equal(c.document.body.dataset.theme, 'dark');
  assert.equal(appearance(c.storage.get('mygarage_theme')).document.body.dataset.theme, 'dark');
  c.api.apply('system', true); assert.equal(c.document.body.dataset.theme, 'light');
});
test('F04: storage denial and invalid preference do not break rendering', () => {
  const c = appearance('invalid', true, true);
  c.api.apply('light', true); assert.equal(c.document.body.dataset.theme, 'light');
  assert.equal(appearance('invalid', true).api.preference(), 'system');
});
test('F04: shared-tab preference changes update only appearance', () => {
  const c = appearance('dark');
  c.windowListeners.storage({ key: 'session', newValue: '{}' });
  assert.equal(c.api.preference(), 'dark');
  c.windowListeners.storage({ key: 'mygarage_theme', newValue: 'light' });
  assert.equal(c.api.preference(), 'light');
  assert.deepEqual([...c.storage.keys()], ['mygarage_theme']);
});
test('F02/F04: new public resources are in the PWA allowlist; API policy remains network-only', () => {
  const worker = fs.readFileSync(path.join(publicDir, 'service-worker.js'), 'utf8');
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  for (const name of ['appearance.js', 'frontend-ui.js', 'modernization.css']) {
    assert.ok(worker.includes(`"/${name}"`)); assert.ok(html.includes(`"/${name}"`));
  }
  assert.match(worker, /rodado-control-v26/);
  assert.match(worker, /if \(!isAllowedStaticRequest\(event.request\)\)/);
});

test('Información muestra la versión declarada por la aplicación', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const version = require('../package.json').version;
  assert.ok(html.includes(`<dd id="app-version">${version}</dd>`));
});
