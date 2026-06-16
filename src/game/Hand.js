/* ============================================================================
 * Hand.js — подсчёт очков руки.
 * Номинал: 2–10 = значение, J/Q/K = 10, A = 1 или 11 (берётся оптимальное).
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Hand = (function () {
  'use strict';

  // Базовая ценность одной карты (туз пока считаем как 11).
  function cardValue(card) {
    if (card.rank === 'A') return 11;
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
    return parseInt(card.rank, 10);
  }

  /**
   * Считает руку. Возвращает { total, soft, aces }.
   * total — лучшая сумма ≤ 21, если возможно.
   * soft  — true, если хотя бы один туз ещё засчитан как 11 (рука «мягкая»).
   */
  function evaluate(cards) {
    var total = 0;
    var aces = 0;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].rank === 'A') aces++;
      total += cardValue(cards[i]);
    }
    // Понижаем тузы с 11 до 1, пока есть перебор.
    var softAces = aces;
    while (total > 21 && softAces > 0) {
      total -= 10;
      softAces--;
    }
    return { total: total, soft: softAces > 0, aces: aces };
  }

  function value(cards) { return evaluate(cards).total; }

  function isBust(cards) { return evaluate(cards).total > 21; }

  // Натуральный блэкджек: ровно 2 карты, дающие 21 (туз + «десятка»).
  function isBlackjack(cards) {
    return cards.length === 2 && evaluate(cards).total === 21;
  }

  return {
    cardValue: cardValue,
    evaluate: evaluate,
    value: value,
    isBust: isBust,
    isBlackjack: isBlackjack
  };
})();
