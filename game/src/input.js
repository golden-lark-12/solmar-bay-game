// Puerto Alba — input.js
// Keyboard + mouse state with edge-triggered "pressed" events.
(function () {
  'use strict';

  var keys = {};
  var pressed = {};
  var mouse = { x: 0, y: 0, down: false, clicked: false, dragDX: 0, dragDY: 0 };
  var lastX = 0, lastY = 0, dragging = false;
  var anyKey = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function init(canvas) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () {
      for (var k in keys) keys[k] = false;
    });
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        mouse.down = true;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      window.addEventListener('mouseup', function (e) {
        mouse.down = false;
        dragging = false;
        mouse.clicked = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      });
      window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        if (dragging) {
          mouse.dragDX += e.clientX - lastX;
          mouse.dragDY += e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
        }
      });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
  }

  function isDown(code) { return !!keys[code]; }

  function wasPressed(code) {
    if (pressed[code]) {
      pressed[code] = false;
      return true;
    }
    return false;
  }

  function consumeClick() {
    var c = mouse.clicked;
    mouse.clicked = false;
    return c;
  }

  function consumeDrag() {
    var dx = mouse.dragDX, dy = mouse.dragDY;
    mouse.dragDX = 0;
    mouse.dragDY = 0;
    return { dx: dx, dy: dy };
  }

  // Movement axes: x = strafe/right, y = forward. WASD + arrows.
  function axes() {
    var x = 0, y = 0;
    if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
    if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
    if (isDown('KeyW') || isDown('ArrowUp')) y += 1;
    if (isDown('KeyS') || isDown('ArrowDown')) y -= 1;
    return { x: x, y: y };
  }

  function endFrame() {
    pressed = {};
    mouse.clicked = false;
  }

  function hadAnyKey() { return anyKey; }

  window.PA = window.PA || {};
  PA.input = {
    init: init, isDown: isDown, wasPressed: wasPressed,
    consumeClick: consumeClick, consumeDrag: consumeDrag,
    axes: axes, endFrame: endFrame, hadAnyKey: hadAnyKey, mouse: mouse
  };
})();
