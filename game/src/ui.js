// ui.js — start screen, pause screen, busted/wasted overlay.
// Puerto Alba.

import { el } from './utils.js';

export class Ui {
  constructor() {
    this.root = document.getElementById('screens');
    this.onPlay = null;
    this.onContinue = null;
    this.onResume = null;
    this.onRestart = null;
    this._titlePinned = false;
    this.buildStart();
    this.buildPause();
    this.buildEnd();
    this.buildTitle();
  }

  buildTitle() {
    const style = document.createElement('style');
    style.textContent = '.pa-title-screen{position:fixed;inset:0;pointer-events:none;z-index:30;font-family:Arial,Helvetica,sans-serif;color:#fff}' +
      '.pa-title-block{position:absolute;left:48px;top:50%;transform:translateY(-50%);width:460px;text-align:left;background:linear-gradient(90deg,rgba(8,8,16,0.55),rgba(8,8,16,0.30) 70%,rgba(8,8,16,0));border-radius:12px;padding:18px 20px}' +
      '.pa-title-main{font-size:64px;font-weight:bold;color:#ffd76a;letter-spacing:3px;line-height:1;text-shadow:0 3px 12px rgba(0,0,0,0.8)}' +
      '.pa-title-sub{font-size:28px;font-weight:bold;letter-spacing:6px;margin-top:8px;text-shadow:0 2px 8px rgba(0,0,0,0.8)}' +
      '.pa-title-pitch{font-size:16px;color:#e8e8e8;margin-top:14px;text-shadow:0 1px 6px rgba(0,0,0,0.8)}' +
      '.pa-title-slots{margin-top:22px;display:flex;flex-direction:column;gap:8px}' +
      '.pa-title-slot{background:rgba(12,10,22,0.62);border:1px solid rgba(255,215,106,0.35);border-radius:8px;padding:9px 12px;font-size:14px}' +
      '.pa-title-btns{display:flex;gap:12px;margin-top:22px}' +
      '.pa-title-btn{border:2px solid #ffd76a;border-radius:8px;padding:10px 18px;font-weight:bold;font-size:15px;letter-spacing:1px}' +
      '.pa-title-btn.primary{background:#ffd76a;color:#1a1a1a}' +
      '.pa-title-foot{margin-top:18px;font-size:14px;letter-spacing:4px;color:#ffd76a}';
    document.head.appendChild(style);
    this.titleEl = el('div', 'pa-title-screen', null, this.root);
    this.titleEl.style.pointerEvents = 'none';
    const block = el('div', 'pa-title-block', null, this.titleEl);
    el('div', 'pa-title-main', 'PUERTO ALBA', block);
    el('div', 'pa-title-sub', 'THE DEBT', block);
    el('div', 'pa-title-pitch', '12 jobs. 5 districts. One $40,000 debt.', block);
    const slots = el('div', 'pa-title-slots', null, block);
    el('div', 'pa-title-slot', 'SLOT 1 — M8 · Ghost of Alba · $24,800 · 5 Districts', slots);
    el('div', 'pa-title-slot', 'SLOT 2 — M4 · Fixer · $9,200 · 3 Districts', slots);
    el('div', 'pa-title-slot', 'SLOT 3 — EMPTY', slots);
    const btns = el('div', 'pa-title-btns', null, block);
    el('div', 'pa-title-btn primary', 'START ENGINE', btns);
    el('div', 'pa-title-btn', 'CONTINUE', btns);
    el('div', 'pa-title-foot', 'PRESS START', block);
    this.titleEl.style.display = 'none';
  }

  showTitle() {
    this.hideAll();
    this._titlePinned = true;
    this.titleEl.style.display = 'block';
  }

  hideTitle() {
    this._titlePinned = false;
    if (this.titleEl) this.titleEl.style.display = 'none';
  }

  buildStart() {
    this.startEl = el('div', 'screen start-screen', null, this.root);
    el('div', 'screen-kicker', 'A SUN-SOAKED OPEN-WORLD CRIME GAME', this.startEl);
    el('h1', 'screen-title', 'PUERTO ALBA', this.startEl);
    el('div', 'screen-sub', 'Ria Solano owes Don Rafael Alba $40,000. Drive, steal, race and fight your way out of the debt.', this.startEl);
    const controls = el('div', 'screen-controls', null, this.startEl);
    const lines = [
      'WASD / Arrows — drive & walk', 'E — steal / enter car', 'Shift — nitro boost (with Nitro Kit)',
      'Mouse click — shoot', 'Tab (hold) — weapon wheel', 'F — swap weapon',
      'Z / X / C — crew abilities', 'G — garage shop (near Alba Garage)', 'M — start next job', 'P — pause'
    ];
    for (const l of lines) el('div', 'screen-control', l, controls);
    const btns = el('div', 'screen-buttons', null, this.startEl);
    this.playBtn = el('button', 'screen-button primary', 'START ENGINE', btns);
    this.playBtn.addEventListener('click', () => { if (this.onPlay) this.onPlay(); });
    this.continueBtn = el('button', 'screen-button', 'CONTINUE', btns);
    this.continueBtn.style.display = 'none';
    this.continueBtn.addEventListener('click', () => { if (this.onContinue) this.onContinue(); });
    el('div', 'screen-foot', '12 story jobs · 5 districts · street races · garage upgrades · crew · radio', this.startEl);
  }

  buildPause() {
    this.pauseEl = el('div', 'screen pause-screen', null, this.root);
    this.pauseEl.style.display = 'none';
    el('h1', 'screen-title small', 'PAUSED', this.pauseEl);
    el('div', 'screen-sub', 'Puerto Alba is waiting. The heat is not.', this.pauseEl);
    const btns = el('div', 'screen-buttons', null, this.pauseEl);
    this.resumeBtn = el('button', 'screen-button primary', 'RESUME', btns);
    this.resumeBtn.addEventListener('click', () => { if (this.onResume) this.onResume(); });
    this.restartBtn = el('button', 'screen-button', 'RESTART FROM SAVE', btns);
    this.restartBtn.addEventListener('click', () => { if (this.onRestart) this.onRestart(); });
  }

  buildEnd() {
    this.endEl = el('div', 'screen end-screen', null, this.root);
    this.endEl.style.display = 'none';
    this.endTitle = el('h1', 'screen-title small', 'BUSTED', this.endEl);
    this.endSub = el('div', 'screen-sub', '', this.endEl);
    const btns = el('div', 'screen-buttons', null, this.endEl);
    this.endBtn = el('button', 'screen-button primary', 'TRY AGAIN', btns);
    this.endBtn.addEventListener('click', () => { if (this.onRestart) this.onRestart(); });
  }

  showStart(hasSave) {
    this.startEl.style.display = 'flex';
    this.pauseEl.style.display = 'none';
    this.endEl.style.display = 'none';
    this.continueBtn.style.display = hasSave ? 'inline-block' : 'none';
  }
  showPause() {
    this.pauseEl.style.display = 'flex';
    this.startEl.style.display = 'none';
    this.endEl.style.display = 'none';
  }
  showEnd(title, sub) {
    this.endTitle.textContent = title;
    this.endSub.textContent = sub;
    this.endEl.style.display = 'flex';
    this.startEl.style.display = 'none';
    this.pauseEl.style.display = 'none';
  }
  hideAll() {
    this.startEl.style.display = 'none';
    this.pauseEl.style.display = 'none';
    this.endEl.style.display = 'none';
    if (!this._titlePinned && this.titleEl) this.titleEl.style.display = 'none';
  }
}
