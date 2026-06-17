/* ============================================================================
 * Haptics.js — вибро-отклик на мобильных устройствах.
 * Использует navigator.vibrate, если он доступен. На ПК — тихо ничего не делает.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Haptics = (function () {
  'use strict';

  var enabled = true;
  var supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function';

  function buzz(pattern) {
    if (!enabled || !supported) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      /* нет доступа — игнорируем */
    }
  }

  return {
    isSupported: function () { return supported; },
    isEnabled: function () { return enabled; },
    setEnabled: function (v) { enabled = !!v; },
    tap:   function () { buzz(8); },        // лёгкий клик по кнопке
    deal:  function () { buzz(12); },       // карта легла на стол
    win:   function () { buzz([0, 40, 60, 40]); },
    lose:  function () { buzz(120); },
    bust:  function () { buzz([0, 30, 40, 30, 40, 60]); }
  };
})();
