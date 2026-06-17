/* ============================================================================
 * Storage.js — безопасная обёртка над localStorage.
 * Хранит баланс фишек, статистику и пользовательские настройки.
 * Если localStorage недоступен (приватный режим / iframe), всё работает
 * в памяти и игра не падает.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Storage = (function () {
  'use strict';

  var KEY = 'bj21_save_v1';

  // Значения по умолчанию для нового игрока.
  var DEFAULTS = {
    balance: 1000,
    settings: { sound: true, haptics: true, lang: '' },
    // Магазин/бонусы: dailyAt — время последнего ежедневного бонуса (мс);
    // packTimes — времена выдач пакета «3 рекламы» (для лимита 2 раза в час).
    bonus: { dailyAt: 0, packTimes: [] },
    stats: {
      hands: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      blackjacks: 0,
      biggestWin: 0,
      bestBalance: 1000,
      streak: 0,
      bestStreak: 0
    }
  };

  var memoryFallback = null; // используется, если localStorage заблокирован
  var available = (function () {
    try {
      var t = '__bj_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function deepMerge(base, extra) {
    var out = JSON.parse(JSON.stringify(base));
    if (!extra) return out;
    Object.keys(extra).forEach(function (k) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) {
        out[k] = deepMerge(out[k] || {}, extra[k]);
      } else {
        out[k] = extra[k];
      }
    });
    return out;
  }

  function read() {
    if (!available) {
      if (!memoryFallback) memoryFallback = deepMerge(DEFAULTS, {});
      return memoryFallback;
    }
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return deepMerge(DEFAULTS, {});
      return deepMerge(DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return deepMerge(DEFAULTS, {});
    }
  }

  function write(data) {
    if (!available) {
      memoryFallback = data;
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* запись не удалась — игнорируем, но не ломаемся */
    }
  }

  return {
    load: read,
    save: write,
    /** Точечное обновление: получает текущие данные, мутирует через fn, сохраняет. */
    update: function (fn) {
      var data = read();
      fn(data);
      write(data);
      return data;
    },
    reset: function () {
      var fresh = deepMerge(DEFAULTS, {});
      write(fresh);
      return fresh;
    },
    /** Слить внешние данные (напр. облачное сохранение) поверх текущих и сохранить. */
    merge: function (extra) {
      var data = deepMerge(read(), extra || {});
      write(data);
      return data;
    }
  };
})();
