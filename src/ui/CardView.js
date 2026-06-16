/* ============================================================================
 * CardView.js — DOM-представление одной карты.
 *
 * Структура — 3D-переворот: внешний .card, внутренний .card-inner с двумя
 * гранями (.card-front с картинкой и .card-back — рубашка). По умолчанию видна
 * рубашка; класс .show-front переворачивает карту лицом.
 *
 * Fallback: если PNG карты не загрузился (Assets.isLoaded === false), лицо
 * рисуется средствами CSS — крупный ранг и символ масти. Игра не ломается.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.CardView = (function () {
  'use strict';

  var Assets = BJ.Assets;

  var SUIT_SYMBOL = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
  var SUIT_RED = { diamonds: true, hearts: true };
  var RANK_LABEL = { A: 'A', J: 'J', Q: 'Q', K: 'K' };

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  /**
   * Создаёт элемент карты.
   * @param {{rank,suit}} card
   * @param {boolean} faceUp — показывать ли сразу лицом
   * @returns {HTMLElement}
   */
  function create(card, faceUp) {
    var root = el('div', 'card');
    root.dataset.rank = card.rank;
    root.dataset.suit = card.suit;

    var inner = el('div', 'card-inner');

    // Лицо карты
    var front = el('div', 'card-face card-front');
    var url = Assets.urlFor(card);
    if (Assets.isLoaded(url)) {
      front.style.backgroundImage = 'url("' + url + '")';
    } else {
      // CSS-fallback: ранг в углах + крупный символ масти
      front.classList.add('card-fallback');
      if (SUIT_RED[card.suit]) front.classList.add('is-red');
      var label = RANK_LABEL[card.rank] || card.rank;
      var sym = SUIT_SYMBOL[card.suit];
      var tl = el('span', 'fb-corner fb-tl');
      tl.innerHTML = label + '<br>' + sym;
      var br = el('span', 'fb-corner fb-br');
      br.innerHTML = label + '<br>' + sym;
      var center = el('span', 'fb-center');
      center.textContent = sym;
      front.appendChild(tl);
      front.appendChild(center);
      front.appendChild(br);
    }

    // Рубашка
    var back = el('div', 'card-face card-back');

    inner.appendChild(back);
    inner.appendChild(front);
    root.appendChild(inner);

    if (faceUp) root.classList.add('show-front');
    return root;
  }

  return { create: create };
})();
