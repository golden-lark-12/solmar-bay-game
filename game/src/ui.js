// Puerto Alba — ui.js
// Menus and overlays: start screen, pause, busted, mission recap.
(function () {
  'use strict';
  var U = PA.utils;

  var refs = {};
  var callbacks = {};

  function $(id) { return document.getElementById(id); }

  function init(cbs) {
    callbacks = cbs || {};
    refs.startScreen = $('start-screen');
    refs.startTitle = $('start-title');
    refs.startSub = $('start-sub');
    refs.startBtn = $('start-btn');
    refs.continueBtn = $('continue-btn');
    refs.pauseScreen = $('pause-screen');
    refs.resumeBtn = $('resume-btn');
    refs.restartBtn = $('restart-btn');
    refs.saveBtn = $('save-btn');
    refs.quitBtn = $('quit-btn');
    refs.bustedScreen = $('busted-screen');
    refs.bustedText = $('busted-text');
    refs.bustedBtn = $('busted-btn');
    refs.saveToast = $('save-toast');
    refs.loading = $('loading');

    if (refs.startBtn) refs.startBtn.addEventListener('click', function () { if (callbacks.onStart) callbacks.onStart(false); });
    if (refs.continueBtn) refs.continueBtn.addEventListener('click', function () { if (callbacks.onStart) callbacks.onStart(true); });
    if (refs.resumeBtn) refs.resumeBtn.addEventListener('click', function () { if (callbacks.onResume) callbacks.onResume(); });
    if (refs.restartBtn) refs.restartBtn.addEventListener('click', function () { if (callbacks.onRestart) callbacks.onRestart(); });
    if (refs.saveBtn) refs.saveBtn.addEventListener('click', function () { if (callbacks.onSave) callbacks.onSave(); });
    if (refs.quitBtn) refs.quitBtn.addEventListener('click', function () { if (callbacks.onQuit) callbacks.onQuit(); });
    if (refs.bustedBtn) refs.bustedBtn.addEventListener('click', function () { if (callbacks.onBusted) callbacks.onBusted(); });
  }

  function showStart(hasSave, stats) {
    if (!refs.startScreen) return;
    refs.startScreen.style.display = 'flex';
    if (refs.continueBtn) refs.continueBtn.style.display = hasSave ? 'inline-block' : 'none';
    if (refs.startSub && stats) {
      refs.startSub.textContent = stats;
    }
  }

  function hideStart() {
    if (refs.startScreen) refs.startScreen.style.display = 'none';
  }

  function showPause() {
    if (refs.pauseScreen) refs.pauseScreen.style.display = 'flex';
  }

  function hidePause() {
    if (refs.pauseScreen) refs.pauseScreen.style.display = 'none';
  }

  function showBusted(text) {
    if (!refs.bustedScreen) return;
    if (refs.bustedText) refs.bustedText.textContent = text || 'BUSTED — The Alba PD caught up with Ria.';
    refs.bustedScreen.style.display = 'flex';
  }

  function hideBusted() {
    if (refs.bustedScreen) refs.bustedScreen.style.display = 'none';
  }

  function flashSaved() {
    if (!refs.saveToast) return;
    refs.saveToast.classList.add('show');
    setTimeout(function () { refs.saveToast.classList.remove('show'); }, 1800);
  }

  function hideLoading() {
    if (refs.loading) refs.loading.style.display = 'none';
  }

  window.PA = window.PA || {};
  PA.ui = {
    init: init, showStart: showStart, hideStart: hideStart,
    showPause: showPause, hidePause: hidePause,
    showBusted: showBusted, hideBusted: hideBusted,
    flashSaved: flashSaved, hideLoading: hideLoading
  };
})();
