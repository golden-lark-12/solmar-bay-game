// take-shots.mjs — serves game/ locally, drives headless Chromium over CDP,
// captures the 4 shots from shots.json at 1280x900 JPEG, prints game state
// and any console errors. Node stdlib only. Puerto Alba v3.

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, 'game');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const CHROME = process.env.CHROME || path.join(process.env.HOME, '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const PORT = 8123;
const DEBUG_PORT = 9333;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

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

async function getJson(url) {
  const r = await fetch(url);
  return r.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  consoleErrors() {
    const out = [];
    for (const e of this.events) {
      if (e.method === 'Runtime.exceptionThrown') {
        out.push('EXCEPTION: ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text));
      } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
        out.push('CONSOLE.ERROR: ' + e.params.args.map(a => a.value || a.description || '').join(' '));
      } else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
        out.push('LOG.ERROR: ' + e.params.entry.text + ' ' + (e.params.entry.url || ''));
      }
    }
    return out;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const shots = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
  const server = await serve();
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    '--window-size=1600,900', '--hide-scrollbars',
    `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`); break; }
      catch (e) { /* not up yet */ }
    }
    if (!targets) throw new Error('Chromium DevTools did not come up');
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

    for (const shot of shots) {
      const url = `http://127.0.0.1:${PORT}/index.html${shot.query}`;
      await cdp.send('Page.navigate', { url });
      // Wait for the game to signal ready, then let the scene settle.
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        const r = await cdp.send('Runtime.evaluate', { expression: 'window.__gameReady === true', returnByValue: true });
        if (r.result && r.result.value) { ready = true; break; }
      }
      if (!ready) console.log(shot.name + ': WARNING game never signalled ready');
      await sleep(5000);
      const state = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__gameState())', returnByValue: true });
      console.log(shot.name + ' state: ' + (state.result ? state.result.value : 'n/a'));
      const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      const buf = Buffer.from(shotRes.data, 'base64');
      fs.writeFileSync(path.join(SHOTS_DIR, shot.name), buf);
      console.log(shot.name + ': ' + buf.length + ' bytes');
    }
    const errs = cdp.consoleErrors();
    console.log('CONSOLE ERRORS (' + errs.length + '):');
    for (const e of errs) console.log('  ' + e);
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
