/* ============================================================================
 * main.js — точка входа. Инициализирует SDK Яндекса (если есть), поднимает UI,
 * предзагружает карты с прогрессом и сообщает платформе о готовности.
 * ========================================================================== */
(function () {
  'use strict';

  function boot() {
    // SDK Яндекса опционален: вне фрейма Яндекс Игр init() вернёт null быстро.
    BJ.Yandex.init().then(function () {
      // независимо от наличия SDK — поднимаем игру
    });

    BJ.UI.init();

    BJ.Assets.preloadAll(function (done, total) {
      BJ.UI.setLoadingProgress(done, total);
    }).then(function () {
      BJ.UI.onAssetsReady();
      // Просим Яндекс убрать свой прелоадер — игра загружена.
      BJ.Yandex.signalReady();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
