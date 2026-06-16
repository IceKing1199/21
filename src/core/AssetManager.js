/* ============================================================================
 * AssetManager.js — предзагрузка изображений карт с прогрессом.
 *
 * Все 52 карты + рубашка грузятся на стартовом экране, чтобы во время игры
 * карты появлялись мгновенно, без «подгрузки». Есть fallback: если картинка
 * не загрузилась, CardView нарисует карту средствами CSS (см. CardView.js).
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Assets = (function () {
  'use strict';

  var BASE = 'assets/cards/';
  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
  var SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

  var RANK_FILE = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };

  var cache = {};        // filename -> { img, ok }
  var loadedOk = {};     // filename -> true, если изображение реально загрузилось

  /** Имя файла для карты вида {rank:'A', suit:'spades'} -> 'ace_of_spades.png' */
  function fileFor(card) {
    var r = RANK_FILE[card.rank] || card.rank; // '10','2'... остаются как есть
    return r + '_of_' + card.suit + '.png';
  }

  function urlFor(card) {
    return BASE + fileFor(card);
  }

  function backUrl() {
    return BASE + 'back.png';
  }

  function preloadOne(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        loadedOk[url] = true;
        cache[url] = { img: img, ok: true };
        resolve(true);
      };
      img.onerror = function () {
        loadedOk[url] = false;
        cache[url] = { img: null, ok: false };
        resolve(false); // не отклоняем — fallback нарисует карту через CSS
      };
      img.src = url;
    });
  }

  function allUrls() {
    var urls = [backUrl()];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        urls.push(BASE + RANKS[r] + '_of_' + SUITS[s] + '.png');
      }
    }
    return urls;
  }

  return {
    urlFor: urlFor,
    backUrl: backUrl,
    /** true, если для данного url изображение успешно загружено. */
    isLoaded: function (url) { return loadedOk[url] === true; },

    /**
     * Грузит все изображения. onProgress(done, total) вызывается по мере загрузки.
     * Возвращает промис, который резолвится всегда (даже если часть картинок упала).
     */
    preloadAll: function (onProgress) {
      var urls = allUrls();
      var total = urls.length;
      var done = 0;
      if (onProgress) onProgress(0, total);
      return Promise.all(
        urls.map(function (u) {
          return preloadOne(u).then(function () {
            done++;
            if (onProgress) onProgress(done, total);
          });
        })
      );
    }
  };
})();
