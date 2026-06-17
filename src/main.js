/* ============================================================================
 * main.js — точка входа. Инициализирует SDK Яндекса (если есть), поднимает UI,
 * предзагружает карты с прогрессом и сообщает платформе о готовности.
 * ========================================================================== */
(function () {
  'use strict';

  function boot() {
    BJ.UI.init();

    // Заранее декодируем аудиофайлы (перемешивание, раздача) на экране загрузки.
    BJ.Audio.preload();

    // SDK Яндекса опционален: вне фрейма Яндекс Игр init() вернёт null быстро.
    // После инициализации подтягиваем облачное сохранение игрока (если есть).
    var sdkReady = BJ.Yandex.init().then(function () {
      return BJ.UI.syncFromCloud();
    }).catch(function () {});

    BJ.Assets.preloadAll(function (done, total) {
      BJ.UI.setLoadingProgress(done, total);
    }).then(function () {
      // Открываем «Играть» только когда и ассеты готовы, и облако синхронизировано
      // (но SDK не может заблокировать игру — у init() есть таймаут).
      sdkReady.then(function () {
        BJ.UI.onAssetsReady();
        // Просим Яндекс убрать свой прелоадер — игра загружена.
        BJ.Yandex.signalReady();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
