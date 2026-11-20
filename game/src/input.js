// input.js — keyboard + mouse state with edge detection.
// Keys: WASD/arrows drive & walk, E steal/enter car, Shift nitro, Tab weapon wheel
// (hold), F cycle weapon, 1-6 pick weapon, Z/X/C crew abilities, G garage,
// M start mission, P/Esc pause, Enter confirm. Puerto Alba.

export class Input {
  constructor() {
    this.downKeys = new Set();
    this.pressedKeys = new Set();
    this.mouseDown = false;
    this.mousePressed = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this._onKeyDown = (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.downKeys.add(e.code);
    };
    this._onKeyUp = (e) => { this.downKeys.delete(e.code); };
    this._onMouseDown = (e) => {
      this.mouseDown = true; this.mousePressed = true;
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.downKeys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) { return this.downKeys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }
  clickPressed() { return this.mousePressed; }

  // Driving axes, -1..1.
  get throttle() {
    let t = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) t += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) t -= 1;
    return t;
  }
  get steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s += 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s -= 1;
    return s;
  }
  get walkX() {
    let x = 0;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    return x;
  }
  get walkY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return y;
  }
  get nitro() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight'); }

  // Called at the end of each frame: clear edge-triggered state.
  endFrame() {
    this.pressedKeys.clear();
    this.mousePressed = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
