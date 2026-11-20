// ui.js — menus: the start screen (title, Start Story / Free Roam / Continue),
// the pause screen (Esc), and the busted/wasted overlay. Plain DOM, no assets.
export class UI {
  constructor(callbacks) {
    this.cb = callbacks;
    this.menu = document.getElementById('menu');
    this.title = document.getElementById('menu-title');
    this.sub = document.getElementById('menu-sub');
    this.buttons = document.getElementById('menu-buttons');
    this.overlay = document.getElementById('overlay');
  }

  showStart(hasSave) {
    this.menu.style.display = 'flex';
    this.title.textContent = 'PUERTO ALBA';
    this.sub.textContent = 'A sun-soaked coastal city at golden hour. Ria Solano owes a debt — and the only way out is through it. Eight jobs. One crew. The whole bay watching.';
    this.buttons.innerHTML = '';
    this.addBtn('▶  Start Story', () => this.cb.onStartStory());
    this.addBtn('◎  Free Roam', () => this.cb.onFreeRoam());
    if (hasSave) this.addBtn('↻  Continue', () => this.cb.onContinue());
    const help = document.createElement('div');
    help.id = 'menu-help';
    help.innerHTML = 'WASD move / drive &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E enter &amp; steal cars &nbsp;·&nbsp; Space brake &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; F punch &nbsp;·&nbsp; R reload &nbsp;·&nbsp; 1-6 weapons &nbsp;·&nbsp; Z / X / C crew abilities &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; Esc pause &nbsp;·&nbsp; M mute';
    this.buttons.appendChild(help);
  }

  showPause() {
    this.menu.style.display = 'flex';
    this.title.textContent = 'PAUSED';
    this.sub.textContent = 'Puerto Alba waits for no one — except right now.';
    this.buttons.innerHTML = '';
    this.addBtn('▶  Resume', () => this.cb.onResume());
    this.addBtn('↻  Restart Story', () => this.cb.onStartStory());
    this.addBtn('◎  Free Roam', () => this.cb.onFreeRoam());
    this.addBtn('💾  Save Game', () => { this.cb.onSave(); });
  }

  hide() { this.menu.style.display = 'none'; }

  addBtn(label, fn) {
    const b = document.createElement('button');
    b.className = 'menu-btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    this.buttons.appendChild(b);
  }

  showOverlay(html, secs = 2.6) {
    this.overlay.innerHTML = html;
    this.overlay.style.opacity = '1';
    clearTimeout(this._ovT);
    this._ovT = setTimeout(() => { this.overlay.style.opacity = '0'; }, secs * 1000);
  }

  showBusted(fine) {
    this.showOverlay(`<div class="big">BUSTED</div><div class="small">The police took ${fine} and dropped you at the station.</div>`, 3);
  }
  showWasted(fine) {
    this.showOverlay(`<div class="big">WASTED</div><div class="small">You woke up at the clinic, ${fine} lighter.</div>`, 3);
  }
}
