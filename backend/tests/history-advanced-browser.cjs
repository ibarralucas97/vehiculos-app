// Local synthetic APIs. F05_JSPDF and UI_BOOTSTRAP_CSS may point to offline copies of the app's CDN assets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium, webkit, devices } = require('playwright');
const root = path.resolve(__dirname, '../public');
const origin = 'http://127.0.0.1:31234';
const vehicles = [1, 2].map(id => ({ id, nombre: 'Auto ' + id, modelo: '2026', km_actual: 200 }));
const literal = '=1+2 <b>Taller</b>';
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH4EoAAAAASUVORK5CYII=';
const items = [6, 5, 4, 3, 2, 1].map(id => ({
  id, vehiculo_id: 1, fecha: '2026-01-0' + id, km: id * 10, cost: 1200,
  accion: id === 5 ? literal : 'Trabajo ' + id, lugar: 'Taller', lugar_id: 1,
  maintenance_plan_id: id > 1 ? 7 : null, maintenance_plan_name: id > 1 ? 'Plan <A>' : null,
  image_source: id === 5 ? photo : null,
}));

async function run() {
  const iphone = process.env.HISTORY_IPHONE === '1';
  const browser = await (iphone ? webkit : chromium).launch();
  try {
    const page = await browser.newPage({
      ...(iphone ? devices['iPhone 13'] : {}),
      viewport: { width: 375, height: 800 }, serviceWorkers: 'block',
    });
    const errors = [];
    const queries = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        const isPdf = url.pathname.endsWith('/jspdf.umd.min.js');
        const asset = isPdf ? process.env.F05_JSPDF : url.pathname.endsWith('/bootstrap.min.css') && process.env.UI_BOOTSTRAP_CSS;
        if (asset) return route.fulfill({ path: asset, contentType: isPdf ? 'application/javascript' : 'text/css', headers: { 'Access-Control-Allow-Origin': '*' } });
        return isPdf ? route.continue() : route.abort();
      }
      const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
      const params = url.searchParams;
      let data = [];
      if (url.pathname === '/vehicles') data = vehicles;
      if (url.pathname === '/places') data = [{ id: 1, nombre: 'Taller' }];
      if (url.pathname === '/auth/login') data = { user: { id: 1, username: 'tester', role: 'user' } };
      if (url.pathname === '/notifications') data = { notifications: [], pagination: {} };
      const method = route.request().method();
      if (url.pathname === '/maintenance' && method === 'POST') {
        data = { ...route.request().postDataJSON(), id: 7, lugar: 'Taller' };
        items.unshift(data);
      } else if (url.pathname === '/maintenance/7' && method === 'PUT') {
        data = Object.assign(items[0], route.request().postDataJSON());
      } else if (url.pathname === '/maintenance/7' && method === 'DELETE') {
        items.shift();
        data = { ok: true };
      } else if (url.pathname === '/maintenance') {
        const recorded = new URLSearchParams(params);
        recorded.delete('_ts'); // Cache-buster added by fetchJson.
        queries.push(Object.fromEntries(recorded));
        data = items.filter(item =>
          String(item.vehiculo_id) === params.get('vehiculo_id') &&
          (!params.has('maintenance_plan_id') || String(item.maintenance_plan_id ?? 'none') === params.get('maintenance_plan_id')) &&
          (!params.has('km_min') || item.km >= Number(params.get('km_min'))) &&
          (!params.has('km_max') || item.km <= Number(params.get('km_max'))) &&
          (!params.has('from') || item.fecha >= params.get('from')) && (!params.has('to') || item.fecha <= params.get('to')) &&
          (!params.has('search') || item.lugar.includes(params.get('search'))));
      }
      return route.fulfill({ json: data });
    });
    await page.goto(origin);
    await page.locator('#login-form [name=username]').fill('tester');
    await page.locator('#login-form [name=password]').fill('123456');
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('.vehicle-card-main').first().click();
    await page.locator('#hero-history-button').click();
    const list = page.locator('#maintenance-list');
    const form = page.locator('#filters-form');
    const field = name => form.locator('[name="' + name + '"]');
    const view = page.locator('#history-view');
    const copy = page.locator('#history-copy');
    const close = page.locator('#history-section [data-secondary-view-close]');
    async function checkHeader() {
      const bounds = await page.locator('#history-section').evaluate(section => {
        const rect = selector => section.querySelector(selector).getBoundingClientRect();
        const header = rect('.secondary-view-header');
        const copy = rect('#history-copy');
        const close = rect('[data-secondary-view-close]');
        const title = document.createRange();
        title.selectNodeContents(section.querySelector('h2'));
        return {
          singleLine: title.getClientRects().length === 1,
          usableCopy: copy.width >= header.width - close.width - 16 && copy.right <= close.left,
          closeFits: close.width >= 44 && close.right <= header.right + 1,
          statusWidth: rect('#status-pill').width,
          noOverflow: [section, document.documentElement].every(el => el.scrollWidth <= el.clientWidth + 1),
        };
      });
      assert.deepEqual(bounds, { singleLine: true, usableCopy: true, closeFits: true, statusWidth: 1, noOverflow: true });
    }
    const apply = async () => {
      await Promise.all([page.waitForResponse(r => r.url().startsWith(origin + '/maintenance?')), page.click('#filters-submit')]);
      await page.waitForFunction(() => !document.querySelector('#export-excel-button').disabled);
    };
    const download = async (action, suffix) => {
      const [file] = await Promise.all([page.waitForEvent('download'), action()]);
      assert.ok(file.suggestedFilename().endsWith(suffix));
      return file.path();
    };
    async function spreadsheet(expected) {
      const file = await download(() => page.click('#export-excel-button'), '.xlsx');
      const unzip = (...args) => execFileSync('unzip', args, { encoding: 'utf8' });
      assert.doesNotMatch(unzip('-Z1', file), /xl\/media/);
      const xml = unzip('-p', file, 'xl/worksheets/sheet1.xml');
      assert.doesNotMatch(xml, /<f[ >]|data:image/);
      const sharedXml = unzip('-p', file, 'xl/sharedStrings.xml');
      const values = await page.evaluate(([sheet, shared]) => {
        const parse = value => new DOMParser().parseFromString(value, 'application/xml');
        const strings = [...parse(shared).querySelectorAll('si')].map(si => si.textContent);
        return [...parse(sheet).querySelectorAll('row')].map(row => [...row.querySelectorAll('c')].map(cell =>
          cell.getAttribute('t') === 's' ? strings[Number(cell.textContent)] : Number(cell.textContent)));
      }, [xml, sharedXml]);
      assert.deepEqual(values[0], ['Fecha','Mantenimiento','Plan','Lugar','Km','Costo','Imagen']);
      assert.deepEqual(values.slice(1), expected.map(row => [row.fecha, row.accion, row.maintenance_plan_name || 'Sin plan', row.lugar, row.km, row.cost, row.image_source ? 'Sí' : 'No']));
    }
    async function pdf(action, expected) {
      const file = await download(action, '.pdf');
      const bytes = fs.readFileSync(file, 'latin1');
      assert.ok(bytes.startsWith('%PDF-'));
      assert.ok(bytes.includes('Total de registros: ' + expected.length));
      expected.forEach((row, i) => assert.ok(bytes.includes('(' + (i + 1) + '. ' + row.accion + ')'), row.accion));
    }
    await list.locator('.card').first().waitFor();
    assert.equal(await view.inputValue(), 'cards');
    assert.equal(await list.locator('.card').count(), 3);
    await spreadsheet(items);
    await pdf(() => page.click('#export-pdf-button'), items);
    await page.click('#history-show-all');
    assert.equal(await list.locator('.card').count(), items.length);
    for (const width of [320, 375, 390, 1200]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => RodadoAppearance.apply(value), theme);
        for (const mode of ['cards', 'table']) {
          await view.selectOption(mode);
          assert.ok(await list.locator(mode === 'cards' ? '.card' : 'table').first().isVisible());
          await checkHeader();
        }
      }
    }
    assert.equal(await list.locator('tbody tr').count(), 6);
    assert.equal(await list.locator('tbody b').count(), 0);
    await list.getByRole('button', { name: 'Ver fotografía' }).click();
    assert.equal(await page.locator('#maintenance-image-lightbox-img').getAttribute('src'), photo);
    await page.click('#maintenance-image-lightbox-close');
    await list.getByRole('button', { name: 'Ver detalle' }).first().click();
    await page.locator('#maintenance-detail-modal:not(.hidden)').waitFor();
    await page.click('#maintenance-detail-close');

    await field('maintenance_plan_id').selectOption('7');
    for (const [name,value] of Object.entries({ km_min:'20', km_max:'50', from:'2026-01-02', to:'2026-01-05', search:'Taller' })) await field(name).fill(value);
    await apply();
    const matching = items.slice(1,5);
    assert.deepEqual(await list.locator('tbody tr td:nth-child(2)').allTextContents(), matching.map(row => row.accion));
    await field('search').fill('Borrador'); // Only the applied filters affect downloads.
    await spreadsheet(matching);
    await pdf(() => page.click('#export-pdf-button'), matching);
    const backup = () => page.evaluate(() => exportVehicleMaintenanceBeforeDelete(1));
    await pdf(backup, [...items].reverse());
    await page.evaluate(() => { window.jspdf = undefined; });
    const csv = fs.readFileSync(await download(backup, '.csv'), 'utf8');
    assert.equal(csv.trim().split('\n').length, 7);
    assert.deepEqual(queries.at(-1), { vehiculo_id: '1' });
    await field('km_max').fill('19');
    const requests = queries.length;
    await page.click('#filters-submit');
    assert.match(await page.locator('#history-copy').textContent(), /Km desde/);
    assert.equal(queries.length, requests);
    await page.click('#filters-reset-button');
    await list.locator('tr').first().waitFor();
    await field('maintenance_plan_id').selectOption('none');
    await apply();
    assert.equal(await list.locator('tbody tr').count(), 1);
    assert.match(await copy.textContent(), /^1 registro con los filtros/);
    assert.match(await list.innerText(), /Sin plan/);
    await field('km_min').fill('999');
    await apply();
    assert.match(await list.innerText(), /Sin resultados/);
    await spreadsheet([]);
    await page.evaluate(() => selectVehicle(2));
    await page.click('#hero-history-button');
    await page.waitForFunction(() => document.querySelector('#status-pill').textContent === 'Sin resultados');
    assert.equal(await view.inputValue(), 'cards');
    assert.deepEqual(await field('maintenance_plan_id').locator('option').allTextContents(), ['Todos los planes']);
    assert.equal(await copy.textContent(), '0 registros');
    await page.setViewportSize({ width: 320, height: 750 });
    await close.click();
    await page.click('#hero-maintenance-button');
    const maintenance = page.locator('#maintenance-form');
    await maintenance.locator('[name=fecha]').fill('2026-01-08');
    await maintenance.locator('[name=lugar_id]').selectOption('1');
    await maintenance.locator('[name=accion]').fill('Cambio de aceite');
    await maintenance.locator('[name=km]').fill('200');
    await maintenance.locator('[name=cost]').fill('1000');
    await page.click('#maintenance-submit');
    const toast = page.locator('#toast-stack .toast');
    await toast.filter({ hasText: 'Mantenimiento registrado correctamente' }).waitFor();
    await list.getByRole('button', { name: 'Ver detalle' }).click();
    await page.locator('#maintenance-detail-modal').getByRole('button', { name: 'Editar' }).click();
    await maintenance.locator('[name=accion]').fill('Cambio de aceite y filtro');
    await page.click('#maintenance-submit');
    await toast.filter({ hasText: 'Mantenimiento actualizado correctamente' }).waitFor();
    await list.getByText('Cambio de aceite y filtro', { exact: true }).waitFor();
    assert.match(await copy.textContent(), /^1 registro\./);
    await list.getByRole('button', { name: 'Ver detalle' }).click();
    await page.locator('#maintenance-detail-modal').getByRole('button', { name: 'Eliminar' }).click();
    await page.click('#ui-modal-confirm');
    await toast.filter({ hasText: 'Mantenimiento eliminado correctamente' }).waitFor();
    assert.equal(await toast.count(), 1);
    assert.equal(await copy.textContent(), '0 registros');
    await checkHeader();
    assert.equal(await toast.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await close.click();
    await page.click('#hero-history-button');
    await list.getByText('Sin resultados', { exact: true }).waitFor();
    await toast.waitFor({ state: 'detached', timeout: 3200 });
    // Fail an export in the UI. An error outlives the normal success timeout and can be dismissed.
    await page.evaluate(() => { window.writeXlsxFile = () => { throw new Error('No se pudo generar el archivo'); }; });
    await page.click('#export-excel-button');
    await toast.getByText('No se pudo generar el archivo').waitFor();
    await page.waitForTimeout(3100);
    assert.ok(await toast.isVisible());
    await toast.getByRole('button').click();
    await toast.waitFor({ state: 'detached' });
    // Hold workbook generation across an account change and wait for the actual export task.
    await page.evaluate(async () => {
      let release;
      let started;
      const writing = new Promise(resolve => { started = resolve; });
      window.writeXlsxFile = () => ({
        toBlob() {
          started();
          return new Promise(resolve => { release = resolve; });
        },
      });
      const exporting = exportHistory(exportExcelButton);
      await writing;
      saveSession({ id: 2, username: 'second', role: 'user' });
      const createUrl = URL.createObjectURL;
      try {
        window.staleDownload = false;
        URL.createObjectURL = () => { window.staleDownload = true; return 'blob:obsolete'; };
        release(new Blob());
        await exporting;
      } finally { URL.createObjectURL = createUrl; }
    });
    assert.equal(await page.evaluate(() => window.staleDownload), false);
    await page.evaluate(() => logout());
    assert.equal(await page.locator('#export-excel-button').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS F05: views, filters, photo, downloads, full backups, themes, viewport and context cleanup.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
