/* ============================================================================
 * Deck.js — колода из 52 карт, перемешивание и раздача.
 * Карта: { rank, suit, id }. rank ∈ {A,2..10,J,Q,K}, suit ∈ 4 масти.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Deck = (function () {
  'use strict';

  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

  function build() {
    var cards = [];
    var id = 0;
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        cards.push({ rank: RANKS[r], suit: SUITS[s], id: id++ });
      }
    }
    return cards;
  }

  // Перемешивание Фишера—Йетса (равномерное, без смещения).
  function shuffle(cards) {
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cards[i];
      cards[i] = cards[j];
      cards[j] = tmp;
    }
    return cards;
  }

  function Deck() {
    this.cards = shuffle(build());
  }

  Deck.prototype.count = function () { return this.cards.length; };

  // Берём карту сверху. На всякий случай восполняем колоду, если опустела.
  Deck.prototype.draw = function () {
    if (this.cards.length === 0) {
      this.cards = shuffle(build());
    }
    return this.cards.pop();
  };

  Deck.prototype.reset = function () {
    this.cards = shuffle(build());
  };

  return {
    create: function () { return new Deck(); },
    RANKS: RANKS,
    SUITS: SUITS
  };
})();
