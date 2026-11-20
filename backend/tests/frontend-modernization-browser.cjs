/* Local static server + synthetic APIs only. Does not load .env or connect to a database.
   NODE_PATH=<external playwright installation>/node_modules node tests/frontend-modernization-browser.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const widths = (process.env.UI_WIDTHS || '360,390,768,1024,1440').split(',').map(Number);
const publicDir = path.resolve(__dirname, '../public');
const output = process.env.UI_ARTIFACTS || '/tmp/rodado-ui/artifacts';
fs.mkdirSync(output, { recursive: true });
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };
const user = { id:1, username:'tester', nombre:'Lucía', apellido:'Prueba', full_name:'Lucía Prueba', role:'user', is_active:true, is_approved:true, mileage_unit:'km', reminders_enabled:true };
const vehicles = [1,2].map(id => ({ id, nombre: id === 1 ? 'Vehículo familiar de prueba' : 'Moto urbana', modelo:'2026', patente:`TEST${id}`, vehicle_type:id === 1 ? 'auto' : 'moto', vehicle_color:'azul', km_actual:15010, intervalo_km:5000, ultimo_service_km:10000, intervalo_tiempo:6, fecha_ultimo_service:'2026-06-01', km_update_reminder_days:7 }));
let records = [{ id:1, vehiculo_id:1, accion:'Cambio de aceite y revisión general', km:15235, fecha:'2020-01-01', lugar_id:1, lugar:'Taller de confianza', cost:35000 }];
let notices = [{ id:1, title:'Cambio de aceite', body:'Revisá el próximo mantenimiento del vehículo familiar.', createdAt:'2026-11-18T10:00:00Z', unread:true, vehicleId:1 },{ id:2, title:'Kilometraje actualizado', body:'Tu historial está al día.', createdAt:'2026-11-17T10:00:00Z', unread:false }];
const writes = [];
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  let body=''; for await (const chunk of req) body+=chunk;
  const json = body ? JSON.parse(body) : {};
  if(req.method!=='GET') writes.push({ path:url.pathname, method:req.method, body:json });
  let data;
  if(url.pathname==='/auth/login') data={ user };
  else if(url.pathname==='/auth/logout') data={ ok:true };
  else if(url.pathname==='/users/profile') data=user;
  else if(url.pathname==='/vehicles') data=vehicles;
  else if(url.pathname==='/places') data=[{ id:1,nombre:'Taller de confianza',ubicacion:'Córdoba',contacto_nombre:'Ana',contacto_numero:'12345678' }];
  else if(url.pathname==='/maintenance-plans') data=[{ id:1,vehicle_id:Number(url.searchParams.get('vehicle_id')),name:'Cambio de aceite',is_active:true,interval_km:5000,initial_service_km:10000,last_service_km:10000,next_service_km:15000,km_remaining:-10,days_remaining:null,status:'overdue',status_label:'Vencido' }];
  else if(url.pathname==='/maintenance' && req.method==='POST') { const record={...json,id:records.length+1,lugar:'Taller de confianza'}; records.push(record); data=record; }
  else if(url.pathname==='/maintenance') data=records.filter(item=>String(item.vehiculo_id)===url.searchParams.get('vehiculo_id'));
  else if(url.pathname==='/dashboard/overview') data={ monthlySpend:35000,totalSpend:35000,alerts:[],selectedReminder:{status:'atrasado',statusLabel:'Vencido',message:'Revisá el mantenimiento',kmRemaining:-10,nextKm:15000,daysRemaining:null} };
  else if(url.pathname==='/notifications/status') data={pushConfigured:false,subscriptionCount:0};
  else if(url.pathname==='/notifications/read-all') { notices.forEach(item=>item.unread=false); data={ok:true}; }
  else if(/^\/notifications\/\d+\/read$/.test(url.pathname)) { notices.find(item=>item.id===Number(url.pathname.split('/')[2])).unread=false; data={ok:true}; }
  else if(url.pathname==='/notifications') data={notifications:notices.filter(item=>url.searchParams.get('filter')!=='unread'||item.unread),unreadCount:notices.filter(item=>item.unread).length,pagination:{hasMore:false}};
  else if(url.pathname==='/activity') data=[];
  else if(url.pathname.startsWith('/admin/')) data={metrics:{},users:[],logs:[],resources:[],pagination:{total:0}};
  else if(url.pathname.startsWith('/vehicles/')) data=vehicles[0];
  if(data!==undefined) { res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return; }
  const file=path.resolve(publicDir, '.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const results=[], errors=[], accessibility=[];
  try {
    browser=await chromium.launch({ headless:true, args:['--no-sandbox'] });
    const context=await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url = new URL(route.request().url());
      if(url.hostname==='127.0.0.1') return route.continue();
      const bootstrap = process.env.UI_BOOTSTRAP_CSS || '/tmp/rodado-ui/bootstrap.min.css';
      if(url.pathname==='/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' && fs.existsSync(bootstrap)) return route.fulfill({path:bootstrap,contentType:'text/css',headers:{'Access-Control-Allow-Origin':'*'}});
      return route.abort();
    });
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(base); await page.waitForFunction(()=>!document.body.classList.contains('splash-active'));
    async function check(name,width,theme) {
      await page.waitForTimeout(80);
      const overflow=await page.evaluate(()=> {
        const nodes=[document.documentElement,...document.querySelectorAll('.modal:not(.hidden) .modal-content,.dashboard-section.open')];
        return nodes.filter(node=>node.scrollWidth>node.clientWidth+2).map(node=>({id:node.id,cls:node.className,width:node.clientWidth,scroll:node.scrollWidth}));
      });
      assert.deepEqual(overflow,[],`${name} ${width} ${theme} overflow ${JSON.stringify(overflow)}`);
      await page.screenshot({path:path.join(output,`${width}-${theme}-${name}.png`),fullPage:false});
      results.push({name,width,theme});
      if (width===390) {
        const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        accessibility.push({name,theme,violations:audit.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))});
        fs.writeFileSync(path.join(output,'accessibility.json'),JSON.stringify(accessibility,null,2));
      }
    }
    for(const width of widths) {
      await page.setViewportSize({width,height:width === 390 ? 844 : 900});
      for(const theme of ['light','dark']) {
        await page.evaluate(value=>window.RodadoAppearance.apply(value,true),theme);
        await check('login',width,theme);
      }
    }
    await page.locator('#login-form [name=username]').fill('tester');
    await page.locator('#login-form [name=password]').fill('123456');
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('#vehicles-screen:not(.hidden)');
    await page.locator('.vehicle-card-main').first().click();
    await page.waitForSelector('#dashboard:not(.hidden)');
    await page.waitForFunction(()=>document.getElementById('overview-next-service').textContent==='Cambio de aceite');
    for(const width of widths) {
      await page.setViewportSize({width,height:width === 390 ? 844 : 900});
      for(const theme of ['light','dark']) {
        await page.evaluate(value=>window.RodadoAppearance.apply(value,true),theme);
        await page.evaluate(()=>goBackToVehicles()); await check('vehicles',width,theme);
        await page.locator('.vehicle-card-main').first().click();
        await page.waitForFunction(()=>document.getElementById('overview-next-service').textContent==='Cambio de aceite');
        await check('dashboard',width,theme);
        await page.evaluate(()=>openSettingsModal());
        await check('settings',width,theme);
        for(const section of ['appearance','account','notifications','security','vehicles','places','about']) {
          await page.locator(`.settings-nav [data-settings-target=${section}]`).click();
          await check(`settings-${section}`,width,theme);
          await page.locator('.settings-index').click();
        }
        await page.keyboard.press('Escape');
        await page.evaluate(()=>openGlobalNotificationsModal());
        await page.waitForSelector('.notification-item');
        await check('notifications',width,theme); await page.keyboard.press('Escape');
        await page.evaluate(()=>openVehicleRemindersModal());
        await check('plans-reminders',width,theme); await page.keyboard.press('Escape');
        await page.evaluate(()=>openProfileModal()); await check('profile',width,theme); await page.keyboard.press('Escape');
        await page.evaluate(()=>openPlacesModal()); await check('places',width,theme); await page.keyboard.press('Escape');
        await page.evaluate(()=>openVehicleCreateModal()); await check('vehicle-form',width,theme);
        for(const step of [2,3,4]) {
          await page.evaluate(value=>setVehicleWizardStep(value),step);
          await check(`vehicle-form-${step}`,width,theme);
        }
        await page.keyboard.press('Escape');
        await page.locator('#hero-maintenance-button').click();
        await check('maintenance',width,theme); await page.keyboard.press('Escape');
        await page.locator('#hero-history-button').click();
        await page.evaluate(()=>loadMaintenance({highlightId:1}));
        await check('history',width,theme); await page.keyboard.press('Escape');
      }
    }
    // The detail menu remains available alongside the dedicated back navigation.
    await page.locator('#vehicle-menu-slot #menu-toggle').click();
    await page.locator('#menu-settings').click();
    await page.locator('#settings-modal [data-dialog-menu]').click();
    await page.locator('#menu-current-reminders').click();
    await page.waitForSelector('#vehicle-reminders-modal:not(.hidden)');
    await page.keyboard.press('Escape');
    await page.locator('#vehicle-menu-slot #menu-toggle').click();
    await page.locator('#menu-settings').click();
    await page.locator('[data-settings-target=places]').click();
    await page.locator('[data-settings-action=places]').click();
    await page.waitForSelector('#places-modal:not(.hidden)');
    await page.keyboard.press('Escape');
    // Theme does not reset the maintenance draft or vehicle context.
    await page.locator('#hero-maintenance-button').click();
    await page.locator('#maintenance-form [name=accion]').fill('Borrador persistente');
    await page.evaluate(()=>window.RodadoAppearance.apply('light',true));
    assert.equal(await page.locator('#maintenance-form [name=accion]').inputValue(),'Borrador persistente');
    assert.equal(await page.evaluate(()=>selectedVehicleId),1);
    await page.locator('#maintenance-form [name=fecha]').fill('2020-01-01');
    await page.locator('#maintenance-form [name=lugar_id]').selectOption('1');
    await page.locator('#maintenance-form [name=km]').fill('15235');
    await page.locator('#maintenance-form [name=cost]').fill('1000');
    await page.locator('#maintenance-form button[type=submit]').click();
    await page.waitForSelector('#history-section.open');
    await page.waitForFunction(()=>document.getElementById('maintenance-list').textContent.includes('Borrador persistente'));
    assert.equal(writes.filter(item=>item.path==='/maintenance' && item.method==='POST').length,1);
    assert.equal(vehicles[0].km_actual,15010);
    await page.keyboard.press('Escape');
    // Filters and mark-read controls retain their actual handlers.
    await page.evaluate(()=>openGlobalNotificationsModal());
    await page.locator('#notifications-filter-unread').click();
    await page.waitForFunction(()=>document.querySelectorAll('.notification-item').length===1);
    await page.locator('.notification-item.is-unread').click();
    await page.waitForFunction(()=>document.querySelectorAll('.notification-item').length===0);
    assert.ok(writes.some(item=>item.path==='/notifications/1/read'));
    // Wait for the read handler's GET before injecting a new synthetic notification.
    await page.waitForFunction(()=>!notificationsState.loading);
    notices[0].unread=true;
    await page.evaluate(()=>loadNotificationsInbox());
    await page.locator('#notifications-mark-all-read').click();
    await page.waitForFunction(()=>document.querySelectorAll('.notification-item').length===0);
    await page.locator('#notifications-filter-all').click();
    await page.waitForFunction(()=>document.querySelectorAll('.notification-item').length===2);
    await page.keyboard.press('Escape');
    // Keyboard focus is contained within Settings and Escape closes it.
    await page.evaluate(()=>openSettingsModal());
    for(let index=0;index<25;index++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.getElementById('settings-modal').contains(document.activeElement)),true);
    }
    await page.keyboard.press('Escape');
    await page.reload(); await page.waitForFunction(()=>!document.body.classList.contains('splash-active'));
    assert.equal(await page.getAttribute('body','data-theme'),'light');
    await page.waitForFunction(()=>currentVehicles.length>0);
    await page.evaluate(()=>selectVehicle(1));
    await page.evaluate(()=>openSettingsModal());
    await page.locator('.settings-nav [data-settings-target=vehicles]').click();
    assert.equal(await page.locator('#settings-vehicle-select').inputValue(),'1');
    await page.evaluate(()=>{saveSession({id:3,username:'other',role:'user'});});
    assert.equal(await page.locator('#settings-vehicle-select option').count(),1);
    assert.equal(await page.locator('#settings-vehicle-select').inputValue(),'');
    await page.evaluate(()=>logout());
    await page.waitForSelector('#welcome-screen:not(.hidden)');
    assert.equal(await page.evaluate(()=>currentMaintenanceRecords.size),0);
    assert.equal(await page.locator('#settings-vehicle-select option').count(),1);
    // Theme the existing administration without changing its behavior.
    await page.evaluate(()=>{ saveSession({id:2,username:'admin',role:'superadmin',nombre:'Admin'}); updateSessionUI(); });
    for(const width of widths) {
      await page.setViewportSize({width,height:width === 390 ? 844 : 900});
      for(const theme of ['light','dark']) {
        await page.evaluate(value=>{window.RodadoAppearance.apply(value,true);openAdminDashboard();},theme);
        await page.waitForSelector('.admin-metric-card'); await check('admin',width,theme);
        await page.evaluate(()=>openAdminUsersModal()); await check('admin-users',width,theme); await page.keyboard.press('Escape');
      }
    }
    await page.evaluate(()=>logout());
    await page.waitForSelector('#welcome-screen:not(.hidden)');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    const cached = await page.evaluate(async()=>{const cache=await caches.open('rodado-control-v25');return (await cache.keys()).map(request=>new URL(request.url).pathname);});
    for(const resource of ['/appearance.js','/frontend-ui.js','/modernization.css']) assert.ok(cached.includes(resource));
    assert.ok(!cached.some(resource=>/^\/(vehicles|maintenance|users|notifications|auth)/.test(resource)));
    await context.setOffline(true); await page.reload();
    await page.waitForSelector('#welcome-screen:not(.hidden)');
    assert.equal(await page.locator('.login-appearance [data-theme-choice]').count(),3);
    await context.setOffline(false);
    assert.deepEqual(errors,[]);
    assert.ok(accessibility.every(audit=>audit.violations.length===0), 'See accessibility.json for WCAG violations');
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks:results,errors,writes},null,2));
    console.log(`PASS: ${results.length} responsive/theme checks; login/logout, navigation, filters/read, theme persistence/draft, focus and cleanup. Artifacts: ${output}`);
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
