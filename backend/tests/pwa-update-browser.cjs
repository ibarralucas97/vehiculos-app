// Run with the same external Playwright installation as frontend-modernization-browser.cjs.
// With a desktop display, PWA_INSTALL_TEST=1 also installs and launches a standalone window.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const publicDir = path.resolve(__dirname, '../public');
const worker = fs.readFileSync(path.join(publicDir, 'service-worker.js'), 'utf8');
const [, currentCache, version] = worker.match(/"(rodado-control-v(\d+))"/);
const previousCache = 'rodado-control-v' + (Number(version) - 1);
const mime = { '.js':'application/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
let releaseUpdate = false;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(publicDir, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)]);
  if (pathname === '/service-worker.js') {
    // Hold the worker back one version while serving the update-capable client.
    res.setHeader('Cache-Control', 'no-store');
    res.end(releaseUpdate ? worker : worker.replace(currentCache, previousCache));
    return;
  }
  fs.createReadStream(file).pipe(res);
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  let context;
  let uninstall;
  try {
    const installed = process.env.PWA_INSTALL_TEST === '1';
    context = await chromium.launchPersistentContext('', {
      channel: installed ? 'chromium' : undefined,
      headless: !installed,
      reducedMotion: 'reduce',
      viewport: installed ? null : { width: 390, height: 844 },
    });
    await context.route('**/*', route =>
      route.request().url().startsWith(url) ? route.continue() : route.abort());
    let page = await context.newPage();
    const errors = [];
    context.on('weberror', error => errors.push(error.error().message));
    await page.goto(url);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const notice = '#pwa-update-notice';
    assert.equal(await page.locator(notice).isVisible(), false, 'first claim is silent');
    assert.deepEqual(await page.evaluate(() => caches.keys()), [previousCache]);

    let other;
    if (installed) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('PWA.install', {manifestId:url, installUrlOrBundleUrl:url});
      uninstall = async () => {
        const cleanup = await context.newCDPSession(await context.newPage());
        await cleanup.send('PWA.uninstall', {manifestId:url});
      };
      await cdp.send('PWA.changeAppUserSettings', {manifestId:url, displayMode:'standalone'});
      const launched = context.waitForEvent('page');
      await cdp.send('PWA.launch', {manifestId:url});
      page = await launched;
      await page.waitForFunction(() => matchMedia('(display-mode: standalone)').matches);
      // Installation may move the original tab into an app window.
      other = await context.newPage();
      await other.goto(url);
      assert.equal(await other.evaluate(() => matchMedia('(display-mode: browser)').matches), true);
    } else {
      other = await context.newPage();
      await other.goto(url);
    }
    for (const tab of [page, other]) {
      await tab.waitForFunction(() => navigator.serviceWorker.controller && !document.body.classList.contains('splash-active'));
      assert.equal(await tab.locator(notice).isVisible(), false);
    }
    await page.evaluate(() => RodadoAppearance.apply('light'));
    await other.evaluate(() => RodadoAppearance.apply('dark'));
    await page.locator('#login-form [name=username]').fill('borrador');
    await page.bringToFront();
    const apply = page.locator('#pwa-update-now');
    const loads = new Map([[page,0],[other,0]]);
    for (const tab of loads.keys()) tab.on('load', () => loads.set(tab, loads.get(tab) + 1));
    releaseUpdate = true;
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    for (const tab of loads.keys()) {
      await tab.locator(notice).waitFor();
      assert.equal(await tab.locator(notice).count(), 1);
      assert.ok(await tab.locator(notice).evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < innerWidth && rect.height < innerHeight && rect.left >= 0 && rect.right <= innerWidth;
      }));
      const audit = await new AxeBuilder({page:tab}).include(notice).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(item => item.id), []);
    }
    assert.notEqual(await page.locator(notice).evaluate(el => getComputedStyle(el).backgroundColor),
                    await other.locator(notice).evaluate(el => getComputedStyle(el).backgroundColor));
    assert.equal(await page.locator('#login-form [name=username]').evaluate(el => el === document.activeElement), true);
    await other.bringToFront();
    await other.locator('#pwa-update-later').focus();
    await other.keyboard.press('Enter');
    await other.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    assert.equal(await other.locator(notice).isVisible(), false, 'dismissal survives a duplicate event');
    assert.equal(await page.locator(notice).isVisible(), true, 'tabs dismiss independently');
    await page.bringToFront();
    page.once('dialog', async dialog => {
      assert.equal(dialog.type(), 'confirm');
      await dialog.dismiss();
    });
    await apply.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#login-form [name=username]').inputValue(), 'borrador');
    assert.equal(await apply.isVisible(), true);
    assert.deepEqual([...loads.values()], [0,0], 'no automatic reload');
    await context.setOffline(true);
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([page.waitForEvent('load'), apply.click()]);
    await page.waitForFunction(() => navigator.serviceWorker.controller && !document.body.classList.contains('splash-active'));
    assert.equal(await page.locator(notice).isVisible(), false);
    assert.deepEqual(await page.evaluate(() => caches.keys()), [currentCache]);
    assert.deepEqual([...loads.values()], [1,0]);
    assert.deepEqual(errors, []);
    console.log('PASS', previousCache, '→', currentCache, installed ? '(installed PWA + browser)' : '(two browser tabs)');
  } finally {
    try {
      if (uninstall) await uninstall();
    } finally {
      if (context) await context.close();
      await new Promise(resolve => server.close(resolve));
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
