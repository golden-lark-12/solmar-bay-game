// playtest.mjs — drives Puerto Alba in headless Chromium: menu -> walk -> steal
// -> drive -> mission M1 -> garage shop -> nitro -> weapon wheel -> combat ->
// crew abilities -> police/heli -> race -> save/reload. Prints PASS/FAIL lines.
// Node stdlib only.

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, 'game');
const CHROME = process.env.CHROME || path.join(process.env.HOME, '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const PORT = 8124;
const DEBUG_PORT = 9334;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let fp = path.join(GAME_DIR, url === '/' ? 'index.html' : url);
      if (!fp.startsWith(GAME_DIR)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}
async function getJson(url) { return (await fetch(url)).json(); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
    };
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result ? r.result.value : undefined;
  }
  consoleErrors() {
    const out = [];
    for (const e of this.events) {
      if (e.method === 'Runtime.exceptionThrown') out.push('EXCEPTION: ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text || ''));
      else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') out.push('CONSOLE.ERROR: ' + e.params.args.map(a => a.value || a.description || '').join(' '));
    }
    return out;
  }
}

// Key helpers: dispatch synthetic keyboard events the game listens to.
async function key(cdp, code, ms) {
  await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'${code}'}))`);
  if (ms) await sleep(ms);
  await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'${code}'}))`);
}
async function keyDown(cdp, code) { await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'${code}'}))`); }
async function keyUp(cdp, code) { await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'${code}'}))`); }
async function state(cdp) { return JSON.parse(await cdp.eval('JSON.stringify(window.__gameState())')); }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

async function main() {
  const server = await serve();
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    '--window-size=1280,900', '--hide-scrollbars',
    `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) { await sleep(500); try { targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`); break; } catch (e) {} }
    if (!targets) throw new Error('DevTools did not come up');
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await cdp.eval('window.__gameReady === true')) break; }
    await cdp.eval(`window.localStorage.clear()`);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await cdp.eval('window.__gameReady === true')) break; }

    // 1. Menu -> start.
    check('menu shows start screen', await cdp.eval(`document.querySelector('.start-screen').style.display !== 'none'`));
    await cdp.eval(`document.querySelector('.screen-button.primary').click()`);
    await sleep(500);
    let s = await state(cdp);
    check('start engine -> playing', s.mode === 'playing', s.mode);

    // 2. Walk: hold W, player must move.
    const p0 = await cdp.eval(`[window.__game.player.x, window.__game.player.z]`);
    await keyDown(cdp, 'KeyW'); await sleep(3000); await keyUp(cdp, 'KeyW');
    const p1 = await cdp.eval(`[window.__game.player.x, window.__game.player.z]`);
    const walkDist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    check('walk moves player', walkDist > 2, walkDist.toFixed(1) + 'm');

    // 3. Walk to the starter car (closed loop) and steal it with E.
    let ok = false;
    for (let i = 0; i < 120; i++) {
      const d = await cdp.eval(`Math.hypot(window.__game.player.x - window.__game.car.x, window.__game.player.z - window.__game.car.z)`);
      if (d < 4) { ok = true; break; }
      const h = await cdp.eval(`window.__game.player.heading`);
      const want = await cdp.eval(`Math.atan2(window.__game.car.x - window.__game.player.x, window.__game.car.z - window.__game.player.z)`);
      const diff = angDiff(h, want);
      await keyDown(cdp, 'KeyW');
      if (diff > 0.25) await keyDown(cdp, 'KeyA'); else await keyUp(cdp, 'KeyA');
      if (diff < -0.25) await keyDown(cdp, 'KeyD'); else await keyUp(cdp, 'KeyD');
      await sleep(150);
    }
    await keyUp(cdp, 'KeyW'); await keyUp(cdp, 'KeyA'); await keyUp(cdp, 'KeyD');
    check('walk to starter car', ok);
    await key(cdp, 'KeyE', 100);
    await sleep(300);
    s = await state(cdp);
    check('steal/enter car with E', s.inCar === true, 'inCar=' + s.inCar);

    // 4. Drive: hold W, speed must rise.
    await keyDown(cdp, 'KeyW'); await sleep(3000); await keyUp(cdp, 'KeyW');
    s = await state(cdp);
    check('drive builds speed', s.car.speedKmh > 20, s.car.speedKmh + ' km/h');

    // 5. Mission M1: M starts it; steal stage completes (already in car);
    // drive to the garage to complete the delivery stage.
    await key(cdp, 'KeyM', 100);
    await sleep(300);
    s = await state(cdp);
    check('M starts M1 Hot Wheels', s.mission === 'M1 stage 1', s.mission);
    ok = false;
    let bestDist = 1e9, stale = 0;
    for (let i = 0; i < 300; i++) {
      s = await state(cdp);
      if (!s.mission) { ok = true; break; }
      const d = Math.hypot(s.car.x + 150, s.car.z - 136);
      if (d < bestDist - 2) { bestDist = d; stale = 0; } else stale++;
      if (stale > 25) {
        // Stuck against something: reverse out, then retry.
        await keyUp(cdp, 'KeyW');
        await keyDown(cdp, 'KeyS'); await sleep(1200); await keyUp(cdp, 'KeyS');
        stale = 0; bestDist = 1e9;
        continue;
      }
      const h = await cdp.eval(`window.__game.car.heading`);
      const want = Math.atan2(-150 - s.car.x, 136 - s.car.z);
      const diff = angDiff(h, want);
      await keyDown(cdp, 'KeyW');
      if (diff > 0.2) await keyDown(cdp, 'KeyA'); else await keyUp(cdp, 'KeyA');
      if (diff < -0.2) await keyDown(cdp, 'KeyD'); else await keyUp(cdp, 'KeyD');
      await sleep(120);
    }
    await keyUp(cdp, 'KeyW'); await keyUp(cdp, 'KeyA'); await keyUp(cdp, 'KeyD');
    s = await state(cdp);
    check('M1 completes at garage (+$2500, +120 RP)', ok && s.cash === 3700 && s.rp === 120, `cash=${s.cash} rp=${s.rp} mission=${s.mission}`);
    check('M1 in completed jobs', s.completedJobs.includes('M1'), JSON.stringify(s.completedJobs));

    // 6. Garage shop: drive/park near garage, G opens shop, buy Nitro Kit.
    await key(cdp, 'KeyG', 100);
    await sleep(400);
    const shopOpen = await cdp.eval(`document.querySelector('.hud-shop').style.display === 'block'`);
    check('garage shop opens with G', shopOpen);
    const bought = await cdp.eval(`(() => {
      const rows = [...document.querySelectorAll('.hud-shop-row')];
      const row = rows.find(r => r.textContent.includes('Nitro Kit'));
      if (!row) return 'no-row';
      const btn = row.querySelector('button');
      btn.click();
      return btn.textContent;
    })()`);
    await sleep(300);
    s = await state(cdp);
    check('buy Nitro Kit ($2000)', s.nitroOwned === true && s.cash === 1700, `bought=${bought} cash=${s.cash}`);
    await key(cdp, 'KeyG', 100);
    await sleep(200);

    // 7. Nitro: drive with Shift, meter must drain and speed must jump.
    const nitroBefore = await cdp.eval(`Math.round(window.__game.car.nitro)`);
    await keyDown(cdp, 'KeyW'); await keyDown(cdp, 'ShiftLeft');
    await sleep(2500);
    const nitroMid = await cdp.eval(`Math.round(window.__game.car.nitro)`);
    const speedBoost = (await state(cdp)).car.speedKmh;
    await keyUp(cdp, 'ShiftLeft'); await keyUp(cdp, 'KeyW');
    check('nitro drains meter + high speed', nitroMid < nitroBefore && speedBoost > 100, `nitro ${nitroBefore}->${nitroMid}, ${speedBoost} km/h`);

    // 8. Weapon wheel: hold Tab, pick SMG (2), release.
    await keyDown(cdp, 'Tab'); await sleep(400);
    const wheelOpen = await cdp.eval(`document.querySelector('.hud-wheel').style.display === 'flex'`);
    await key(cdp, 'Digit2', 100);
    await sleep(200);
    await keyUp(cdp, 'Tab');
    await sleep(200);
    const sel = await cdp.eval(`window.__game.combat.selected`);
    check('weapon wheel opens + picks SMG', wheelOpen && sel === 1, `wheel=${wheelOpen} selected=${sel}`);

    // 9. Combat: click to shoot, ammo drops.
    const ammoBefore = await cdp.eval(`window.__game.combat.current().ammo`);
    await cdp.eval(`window.dispatchEvent(new MouseEvent('mousedown',{clientX:640,clientY:450,bubbles:true}))`);
    await cdp.eval(`window.dispatchEvent(new MouseEvent('mouseup',{clientX:640,clientY:450,bubbles:true}))`);
    await sleep(400);
    const ammoAfter = await cdp.eval(`window.__game.combat.current().ammo`);
    check('shooting spends ammo', ammoAfter === ammoBefore - 1, `${ammoBefore}->${ammoAfter}`);

    // 10. Police + helicopter: set wanted 3, check units + heli; crew X drops a star.
    await cdp.eval(`window.__game.police.setWanted(3)`);
    await sleep(1500);
    s = await state(cdp);
    check('wanted 3 spawns heli + dispatch', s.heli === true && s.dispatch >= 4, `heli=${s.heli} dispatch=${s.dispatch} policeCars=${s.policeCars}`);
    check('IN SIGHT banner shows', await cdp.eval(`document.querySelector('.hud-insight').style.display === 'block'`));
    await key(cdp, 'KeyX', 100);
    await sleep(300);
    s = await state(cdp);
    check('crew X (Loop Feeds) drops a star', s.wanted === 2, 'wanted=' + s.wanted);

    // 11. Crew Z slipstream + C ram.
    await key(cdp, 'KeyZ', 100);
    await sleep(200);
    const slip = await cdp.eval(`window.__game.car.slipstream > 0`);
    check('crew Z (Slipstream) boosts car', slip);
    await key(cdp, 'KeyC', 100);
    await sleep(400);
    const ramToast = await cdp.eval(`document.querySelector('.hud-toast').textContent`);
    const ramCd = await cdp.eval(`window.__game.crew[2].cooldown > 0`);
    // Note: the wrecked cruiser is replaced by a reinforcement (wanted stays),
    // so the observable effect is the toast + cooldown, not a count drop.
    check('crew C (Ram) wrecks a cruiser', ramToast.includes('wrecked') && ramCd, `toast="${ramToast}" cooldown=${ramCd}`);

    // 12. Race: start M9, drive through gates by teleporting the car near each.
    await cdp.eval(`window.__game.missions.start('M9')`);
    await sleep(500);
    const raceStarted = await cdp.eval(`!!window.__game.races.active`);
    check('race M9 starts', raceStarted);
    if (raceStarted) {
      for (let i = 0; i < 8; i++) {
        const cp = await cdp.eval(`(() => { const a = window.__game.races.active; return a ? a.def.checkpoints[a.cpIndex] : null; })()`);
        if (!cp) break;
        await cdp.eval(`window.__game.car.setPos(${cp[0]}, ${cp[1]}, 0)`);
        await sleep(350);
      }
      await sleep(500);
      s = await state(cdp);
      check('race won, prize paid, best time saved', s.cash >= 1700 + 4000 && s.raceBest['strand-gp'] !== undefined, `cash=${s.cash} best=${JSON.stringify(s.raceBest)}`);
    }

    // 13. Pause / resume.
    await key(cdp, 'KeyP', 100);
    await sleep(300);
    s = await state(cdp);
    check('pause works', s.mode === 'paused', s.mode);
    await key(cdp, 'KeyP', 100);
    await sleep(300);
    s = await state(cdp);
    check('resume works', s.mode === 'playing', s.mode);

    // 14. Save + reload round-trip.
    const cashBefore = (await state(cdp)).cash;
    const rpBefore = (await state(cdp)).rp;
    await cdp.eval(`window.__game.saveGame()`);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await cdp.eval('window.__gameReady === true')) break; }
    const hasContinue = await cdp.eval(`document.querySelector('.screen-button:not(.primary)').style.display !== 'none'`);
    await cdp.eval(`document.querySelectorAll('.screen-button')[1].click()`);
    await sleep(500);
    s = await state(cdp);
    check('save + reload restores cash/RP', hasContinue && s.cash === cashBefore && s.rp === rpBefore, `cash ${cashBefore}->${s.cash}, rp ${rpBefore}->${s.rp}`);

    const errs = cdp.consoleErrors();
    console.log('CONSOLE ERRORS (' + errs.length + '):');
    for (const e of errs) console.log('  ' + e);
    check('zero console errors during playtest', errs.length === 0, errs.join(' | ').slice(0, 300));
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\nPLAYTEST: ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
