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
  var ready = false;

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
          .then(function (sdk) { finish(sdk); })
          .catch(function () { finish(null); });
      } catch (e) {
        finish(null);
      }
      // Страховка по таймауту, чтобы загрузка игры не зависла из-за SDK
      setTimeout(function () { finish(null); }, 4000);
    });
  }

  function safe(fn) {
    try { fn(); } catch (e) { /* SDK мог измениться — не падаем */ }
  }

  return {
    init: init,
    isReady: function () { return !!ysdk; },

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
