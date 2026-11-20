// input.js — keyboard + mouse state with edge-triggered "just pressed" actions.
// Pointer lock is requested by the game only after a real user click; shot mode
// (headless screenshots) never asks for it and drives the camera itself.
// Crew keys (Z / X / C) and weapon keys (1-6) are read through the same
// pressed()/down() helpers as the movement keys.
export const keys = Object.create(null);
export const justPressed = Object.create(null);
export let mouseDX = 0;
export let mouseDY = 0;
export let mouseClicked = false;
export let locked = false;

const HANDLED = ['Space', 'KeyE', 'KeyF', 'KeyR', 'KeyM', 'Escape', 'Tab'];

export function initInput(canvas, onLockChange) {
  window.addEventListener('keydown', (e) => {
    if (HANDLED.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (e.code === 'Escape' && document.pointerLockElement) document.exitPointerLock();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement === canvas && e.button === 0) mouseClicked = true;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(locked);
  });
  canvas.addEventListener('click', () => {
    if (!locked && !window.__PUERTO_ALBA_SHOT__) {
      try { canvas.requestPointerLock(); } catch { /* headless / denied */ }
    }
  });
}

export function endFrame() {
  for (const k in justPressed) justPressed[k] = false;
  mouseDX = 0; mouseDY = 0; mouseClicked = false;
}
export function pressed(code) { return !!justPressed[code]; }
export function down(code) { return !!keys[code]; }
