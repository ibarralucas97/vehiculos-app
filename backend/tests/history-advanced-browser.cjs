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
      if (url.pathname === '/places') data = [{ id: 1, nombre: 'Taller', contacto_numero: '0351 15-1234567' }];
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
    const toggle = page.locator('#history-export-toggle');
    const options = page.locator('#history-export-options');
    const pdfButton = page.locator('#export-pdf-button');
    const excelButton = page.locator('#export-excel-button');
    async function checkMenu(open) {
      assert.equal(await toggle.getAttribute('aria-expanded'), String(open));
      assert.equal(await options.isVisible(), open);
    }
    async function chooseExport(button) {
      await toggle.click();
      await button.click();
      await checkMenu(false);
    }
    assert.ok(await toggle.isDisabled());
    assert.ok(await pdfButton.isDisabled());
    assert.ok(await excelButton.isDisabled());
    await page.locator('#login-form [name=username]').fill('tester');
    await page.locator('#login-form [name=password]').fill('123456');
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('.vehicle-card-main').first().click();
    const widths = [320, 375, 390, 1280];
    await page.evaluate(() => openPlacesModal());
    for (const editing of [false, true]) {
      await page.locator(editing ? '#places-list [aria-label="Editar lugar"]' : '#place-create-button').click();
      const phone = page.getByRole('textbox', { name: 'Celular (WhatsApp)', exact: true });
      const help = page.locator('#place-phone-help');
      assert.equal(await phone.inputValue(), editing ? '0351 15-1234567' : '');
      assert.equal(await phone.getAttribute('placeholder'), '+54 9 351 1234567');
      assert.equal(await phone.getAttribute('aria-describedby'), await help.getAttribute('id'));
      assert.equal(await help.innerText(), 'Ingresá el número con código de país y área, sin 0 ni 15.');
      assert.ok(await phone.evaluate(input => input.checkValidity() && !input.required));
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate(value => RodadoAppearance.apply(value), theme);
          for (const element of [page.locator('label[for=place-phone]'), phone, help]) {
            const box = await element.boundingBox();
            assert.ok(box && box.height > 0 && box.x >= 0 && box.x + box.width <= width);
          }
        }
      }
      await page.click('#place-cancel-button');
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 375, height: 800 });
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
      const file = await download(() => chooseExport(excelButton), '.xlsx');
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
    assert.equal(await page.getByRole('button', { name: 'Exportar', exact: true }).count(), 1);
    assert.equal(await toggle.getAttribute('aria-controls'), await options.getAttribute('id'));
    await toggle.focus();
    await page.keyboard.press('Enter');
    await checkMenu(true);
    await page.keyboard.press('Tab');
    assert.ok(await pdfButton.evaluate(el => el === document.activeElement && el.matches(':focus-visible')));
    await page.keyboard.press('Tab');
    assert.ok(await excelButton.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    await checkMenu(false);
    assert.ok(await toggle.evaluate(el => el === document.activeElement));
    await toggle.click();
    await toggle.click();
    await checkMenu(false);
    await toggle.click();
    await page.locator('#history-title').click();
    await checkMenu(false);
    await spreadsheet(items);
    await pdf(() => chooseExport(pdfButton), items);
    await page.click('#history-show-all');
    assert.equal(await list.locator('.card').count(), items.length);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => RodadoAppearance.apply(value), theme);
        for (const mode of ['cards', 'table']) {
          await view.selectOption(mode);
          assert.ok(await list.locator(mode === 'cards' ? '.card' : 'table').first().isVisible());
          await checkHeader();
        }
        await toggle.click();
        await checkMenu(true);
        const panel = await options.boundingBox();
        const toolbar = await page.locator('.history-toolbar').boundingBox();
        assert.ok(panel.x >= toolbar.x - 1 && panel.x + panel.width <= toolbar.x + toolbar.width + 1);
        await checkHeader();
        await toggle.click();
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
    await pdf(() => chooseExport(pdfButton), matching);
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
    assert.ok(await toggle.isDisabled());
    assert.ok(await pdfButton.isDisabled());
    assert.ok(await excelButton.isDisabled());
    await checkMenu(false);
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
    await chooseExport(excelButton);
    await toast.getByText('No se pudo generar el archivo').waitFor();
    await page.waitForTimeout(3100);
    assert.ok(await toast.isVisible());
    await toast.getByRole('button').click();
    await toast.waitFor({ state: 'detached' });
    for (const transition of ['vehicle', 'account']) {
      await page.evaluate(() => {
        window.releaseWorkbook = null;
        window.writeXlsxFile = () => ({
          toBlob: () => new Promise(resolve => { window.releaseWorkbook = resolve; }),
        });
        window.pendingExport = exportHistory(exportExcelButton);
      });
      await page.waitForFunction(() => !!window.releaseWorkbook);
      assert.ok(await toggle.isDisabled());
      assert.ok(await excelButton.isDisabled());
      assert.ok(await pdfButton.isDisabled());
      const attempts = await page.evaluate(async change => {
        const generatePdf = exportMaintenanceToPdf;
        const createUrl = URL.createObjectURL;
        let duplicates = 0;
        let downloads = 0;
        try {
          exportMaintenanceToPdf = () => { duplicates++; };
          window.writeXlsxFile = () => { duplicates++; throw new Error('Exportación duplicada'); };
          URL.createObjectURL = () => { downloads++; return 'blob:obsolete'; };
          await exportHistory(exportPdfButton);
          await exportHistory(exportExcelButton);
          if (change === 'vehicle') selectVehicle(1);
          else saveSession({ id: 2, username: 'second', role: 'user' });
          window.releaseWorkbook(new Blob());
          await window.pendingExport;
          return { duplicates, downloads };
        } finally {
          exportMaintenanceToPdf = generatePdf;
          URL.createObjectURL = createUrl;
        }
      }, transition);
      assert.deepEqual(attempts, { duplicates: 0, downloads: 0 });
      if (transition === 'vehicle') {
        await page.click('#hero-history-button');
        await list.locator('.card').first().waitFor();
      }
    }
    await page.evaluate(() => logout());
    assert.equal(await page.locator('#export-excel-button').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS F05: views, filters, photo, downloads, full backups, themes, viewport and context cleanup.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
