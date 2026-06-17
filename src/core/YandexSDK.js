/* ============================================================================
 * YandexSDK.js — необязательная интеграция с Yandex Games SDK.
 *
 * Работает только внутри настоящего фрейма Яндекс Игр. Локально и в любом
 * другом окружении SDK просто отсутствует — все вызовы превращаются в no-op,
 * и игра продолжает работать как обычная HTML5-страница.
 *
 * Что делает:
 *   • сигналит LoadingAPI.ready() — Яндекс убирает свой прелоадер;
 *   • даёт безопасную обёртку для межраундовой рекламы (interstitial);
 *   • помечает начало/конец активной игры (gameplayStart/Stop).
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Yandex = (function () {
  'use strict';

  var ysdk = null;
  var player = null;        // объект игрока (для облачных сохранений)
  var lb = null;            // объект leaderboards
  var ready = false;

  var LEADERBOARD_NAME = 'chips'; // технический ID лидерборда в консоли Яндекс Игр

  function safe(fn) {
    try { fn(); } catch (e) { /* SDK мог измениться — не падаем */ }
  }

  // Подтягиваем игрока и лидерборды. Любая ошибка не критична — просто
  // соответствующая фича останется недоступной.
  function loadServices(sdk) {
    var tasks = [];
    if (sdk && sdk.getPlayer) {
      tasks.push(
        sdk.getPlayer({ scopes: false })
          .then(function (p) { player = p; })
          .catch(function () { player = null; })
      );
    }
    if (sdk && sdk.getLeaderboards) {
      tasks.push(
        sdk.getLeaderboards()
          .then(function (l) { lb = l; })
          .catch(function () { lb = null; })
      );
    }
    return Promise.all(tasks).catch(function () {});
  }

  function init() {
    return new Promise(function (resolve) {
      // Глобальная YaGames появляется, только если подключён скрипт SDK
      if (typeof window.YaGames === 'undefined') {
        resolve(null);
        return;
      }
      var done = false;
      var finish = function (sdk) {
        if (done) return;
        done = true;
        ysdk = sdk;
        resolve(sdk);
      };
      try {
        window.YaGames.init()
          .then(function (sdk) {
            ysdk = sdk;
            // Сервисы грузим параллельно, но не дольше общего таймаута.
            loadServices(sdk).then(function () { finish(sdk); });
          })
          .catch(function () { finish(null); });
      } catch (e) {
        finish(null);
      }
      // Страховка по таймауту, чтобы загрузка игры не зависла из-за SDK
      setTimeout(function () { finish(ysdk); }, 4000);
    });
  }

  /* --- облачные сохранения (per-player) --- */

  var saveTimer = null;
  var pendingData = null;

  function flushSave() {
    saveTimer = null;
    if (!player || !player.setData || !pendingData) return;
    var data = pendingData;
    pendingData = null;
    safe(function () { player.setData(data, true); });
  }

  /* --- лидерборды --- */

  function normalizeEntries(res) {
    var out = [];
    if (!res || !res.entries) return out;
    res.entries.forEach(function (e) {
      var p = e.player || {};
      out.push({
        rank: e.rank,
        score: e.score,
        name: p.publicName || '',
        isCurrent: !!(res.userRank && e.rank === res.userRank)
      });
    });
    return out;
  }

  return {
    init: init,
    isReady: function () { return !!ysdk; },
    hasSDK: function () { return !!ysdk; },

    /** Сообщить Яндексу, что игра загружена и готова к показу. */
    signalReady: function () {
      if (ready) return;
      ready = true;
      if (!ysdk || !ysdk.features || !ysdk.features.LoadingAPI) return;
      safe(function () { ysdk.features.LoadingAPI.ready(); });
    },

    gameplayStart: function () {
      if (ysdk && ysdk.features && ysdk.features.GameplayAPI) {
        safe(function () { ysdk.features.GameplayAPI.start(); });
      }
    },
    gameplayStop: function () {
      if (ysdk && ysdk.features && ysdk.features.GameplayAPI) {
        safe(function () { ysdk.features.GameplayAPI.stop(); });
      }
    },

    /** Загрузить облачное сохранение игрока. Резолвится объектом или null. */
    cloudGet: function () {
      if (!player || !player.getData) return Promise.resolve(null);
      return player.getData()
        .then(function (d) { return d && typeof d === 'object' ? d : null; })
        .catch(function () { return null; });
    },

    /** Сохранить данные в облако (с дебаунсом, чтобы не спамить SDK). */
    cloudSet: function (data) {
      if (!player || !player.setData) return;
      pendingData = data;
      if (saveTimer) return;
      saveTimer = setTimeout(flushSave, 1500);
    },

    /** Залогинен ли игрок (не анонимный «lite»-режим). */
    isAuthorized: function () {
      if (!player || !player.getMode) return false;
      try { return player.getMode() !== 'lite'; } catch (e) { return false; }
    },

    /** Предложить вход, чтобы игрок мог попасть в таблицу лидеров. */
    openAuth: function () {
      if (!ysdk || !ysdk.auth || !ysdk.auth.openAuthDialog) {
        return Promise.resolve(false);
      }
      return ysdk.auth.openAuthDialog()
        .then(function () {
          if (!ysdk.getPlayer) return false;
          return ysdk.getPlayer({ scopes: true })
            .then(function (p) { player = p; return true; })
            .catch(function () { return false; });
        })
        .catch(function () { return false; });
    },

    /** Отправить текущий счёт (баланс фишек) в лидерборд. */
    submitScore: function (score) {
      if (!lb || !lb.setLeaderboardScore) return;
      var val = Math.max(0, Math.floor(score || 0));
      safe(function () { lb.setLeaderboardScore(LEADERBOARD_NAME, val); });
    },

    /** Получить записи лидерборда. Резолвится массивом {rank,name,score,isCurrent}. */
    getLeaderboard: function () {
      if (!lb || !lb.getLeaderboardEntries) return Promise.resolve(null);
      return lb.getLeaderboardEntries(LEADERBOARD_NAME, {
        quantityTop: 10,
        includeUser: true,
        quantityAround: 4
      })
        .then(normalizeEntries)
        .catch(function () { return null; });
    },

    /**
     * Полноэкранная реклама между раундами. Звук игры приглушается на время показа.
     * Колбэки необязательны. Если SDK нет — onClose вызывается сразу.
     */
    showInterstitial: function (cbs) {
      cbs = cbs || {};
      var finish = function () { if (cbs.onClose) cbs.onClose(); };
      if (!ysdk || !ysdk.adv) { finish(); return; }
      safe(function () {
        ysdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: function () { finish(); },
            onError: function () { finish(); }
          }
        });
      });
    }
  };
})();
