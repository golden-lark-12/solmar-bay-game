// probe-ram.mjs — focused check of the Ram crew ability.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, 'game');
const CHROME = path.join(process.env.HOME, '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const PORT = 8125, DEBUG_PORT = 9335;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.join(GAME_DIR, url === '/' ? 'index.html' : url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
  '--window-size=1280,900', `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'], { stdio: 'ignore' });
try {
  let targets = null;
  for (let i = 0; i < 40; i++) { await sleep(500); try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json(); break; } catch (e) {} }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result ? r.result.value : undefined; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev('window.__gameReady === true')) break; }
  await ev(`document.querySelector('.screen-button.primary').click()`);
  await sleep(500);
  await ev(`window.__game.player.inCar = true; window.__game.car.setPos(-100, 160, 0);`);
  await ev(`window.__game.police.setWanted(3)`);
  await sleep(2500);
  console.log('car:', await ev(`[window.__game.car.x, window.__game.car.z]`));
  console.log('police dists:', await ev(`window.__game.police.cars.map(c => +Math.hypot(c.x - window.__game.car.x, c.z - window.__game.car.z).toFixed(1))`));
  console.log('crew2 cooldown:', await ev(`window.__game.crew[2].cooldown`));
  const before = await ev(`window.__game.police.cars.length`);
  await ev(`window.__game.useCrew(2)`);
  await sleep(300);
  console.log('before:', before, 'after:', await ev(`window.__game.police.cars.length`));
  console.log('crew2 cooldown now:', await ev(`window.__game.crew[2].cooldown`));
  console.log('toast:', await ev(`document.querySelector('.hud-toast').textContent + ' / ' + document.querySelector('.hud-toast').style.display`));
  ws.close();
} finally { chrome.kill('SIGKILL'); server.close(); }
