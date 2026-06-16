/* ============================================================================
 * BlackjackEngine.js — правила и состояние игры «21» (Blackjack).
 *
 * Это «State Manager + Game Engine» из ТЗ: чистая логика без DOM и анимаций.
 * UI-слой читает состояние и вызывает пошаговые методы, сам управляя таймингом
 * анимаций (раздача, добор дилера и т.д.).
 *
 * Правила:
 *   • Игрок и дилер получают по 2 карты из свежей колоды 52 карты.
 *   • Действия игрока: Hit (взять), Stand (стоп), Double (удвоить — бонус).
 *   • Дилер добирает, пока сумма < 17 (стоит на 17 и выше, в т.ч. «мягких»).
 *   • A = 1 или 11; J/Q/K = 10.
 *   • Натуральный блэкджек платит 3:2, обычная победа 1:1, ничья — возврат.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Engine = (function () {
  'use strict';

  var Deck = BJ.Deck;
  var Hand = BJ.Hand;
  var Storage = BJ.Storage;

  var MIN_BET = 10;
  var START_BALANCE = 1000;
  var DEALER_STANDS_ON = 17;

  function Engine() {
    var save = Storage.load();
    this.balance = save.balance;
    this.stats = save.stats;

    this.deck = Deck.create();
    this.player = [];
    this.dealer = [];
    this.bet = 0;
    this.doubled = false;
    this.phase = 'idle';   // idle | player | dealer | over
    this.resolved = false;
    this.result = null;
  }

  var P = Engine.prototype;

  /* --- геттеры состояния --- */
  P.getBalance = function () { return this.balance; };
  P.getStats = function () { return this.stats; };
  P.getBet = function () { return this.bet; };
  P.getPhase = function () { return this.phase; };
  P.getPlayer = function () { return this.player; };
  P.getDealer = function () { return this.dealer; };
  P.playerValue = function () { return Hand.value(this.player); };
  P.dealerValue = function () { return Hand.value(this.dealer); };

  // Значение руки дилера: при скрытой «дырке» считаем только открытую карту.
  P.dealerVisibleValue = function (revealAll) {
    if (revealAll) return Hand.value(this.dealer);
    return this.dealer.length ? Hand.value([this.dealer[0]]) : 0;
  };

  P.playerHasBlackjack = function () { return Hand.isBlackjack(this.player); };
  P.dealerHasBlackjack = function () { return Hand.isBlackjack(this.dealer); };
  P.playerBust = function () { return Hand.isBust(this.player); };

  /* --- ставки --- */
  P.canStartRound = function (bet) {
    return this.phase === 'idle' || this.phase === 'over'
      ? bet >= MIN_BET && bet <= this.balance
      : false;
  };

  /**
   * Начинает раунд: списывает ставку, тасует свежую колоду 52 карты,
   * раздаёт по 2 карты. Вторая карта дилера — закрытая «дырка» (индекс 1).
   */
  P.newRound = function (bet) {
    bet = Math.max(MIN_BET, Math.min(bet, this.balance));
    this.balance -= bet;
    this.bet = bet;
    this.doubled = false;
    this.resolved = false;
    this.result = null;

    this.deck.reset(); // свежая колода 52 карты на каждый раунд
    this.player = [this.deck.draw(), this.deck.draw()];
    this.dealer = [this.deck.draw(), this.deck.draw()];
    this.phase = 'player';

    return { player: this.player.slice(), dealer: this.dealer.slice() };
  };

  /** Есть ли натуральный блэкджек у кого-либо (раунд завершится сразу). */
  P.hasNatural = function () {
    return this.playerHasBlackjack() || this.dealerHasBlackjack();
  };

  /* --- действия игрока --- */
  P.canHit = function () { return this.phase === 'player'; };

  P.canDouble = function () {
    return this.phase === 'player' &&
      this.player.length === 2 &&
      !this.doubled &&
      this.balance >= this.bet;
  };

  P.hit = function () {
    if (this.phase !== 'player') return null;
    var card = this.deck.draw();
    this.player.push(card);
    if (this.playerBust()) this.phase = 'over';
    return card;
  };

  P.stand = function () {
    if (this.phase !== 'player') return;
    this.phase = 'dealer';
  };

  P.double = function () {
    if (!this.canDouble()) return null;
    this.balance -= this.bet; // вторая ставка
    this.bet *= 2;
    this.doubled = true;
    var card = this.deck.draw();
    this.player.push(card);
    // После удвоения — ровно одна карта, затем обязательный стоп.
    this.phase = this.playerBust() ? 'over' : 'dealer';
    return card;
  };

  /* --- ход дилера --- */
  P.dealerShouldHit = function () {
    return this.phase === 'dealer' && Hand.value(this.dealer) < DEALER_STANDS_ON;
  };

  P.dealerHit = function () {
    var card = this.deck.draw();
    this.dealer.push(card);
    return card;
  };

  /* --- подведение итогов --- */
  P.resolve = function () {
    if (this.resolved) return this.result;
    this.resolved = true;
    if (this.phase !== 'over') this.phase = 'over';

    var pv = Hand.value(this.player);
    var dv = Hand.value(this.dealer);
    var pBJ = this.playerHasBlackjack();
    var dBJ = this.dealerHasBlackjack();

    var outcome;   // 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'dealer_bust'
    var payout = 0; // сколько возвращается на баланс (включая возврат ставки)

    if (pBJ && dBJ) {
      outcome = 'push';
      payout = this.bet;
    } else if (pBJ) {
      outcome = 'blackjack';
      payout = this.bet + Math.round(this.bet * 1.5); // 3:2
    } else if (dBJ) {
      outcome = 'lose';
      payout = 0;
    } else if (pv > 21) {
      outcome = 'bust';
      payout = 0;
    } else if (dv > 21) {
      outcome = 'dealer_bust';
      payout = this.bet * 2;
    } else if (pv > dv) {
      outcome = 'win';
      payout = this.bet * 2;
    } else if (pv < dv) {
      outcome = 'lose';
      payout = 0;
    } else {
      outcome = 'push';
      payout = this.bet;
    }

    this.balance += payout;
    var net = payout - this.bet; // чистый результат раунда

    this._updateStats(outcome, net);
    this._persist();

    this.result = {
      outcome: outcome,
      payout: payout,
      net: net,
      bet: this.bet,
      playerValue: pv,
      dealerValue: dv,
      playerBlackjack: pBJ,
      dealerBlackjack: dBJ,
      balance: this.balance
    };
    return this.result;
  };

  P._updateStats = function (outcome, net) {
    var s = this.stats;
    s.hands += 1;
    var win = outcome === 'win' || outcome === 'blackjack' || outcome === 'dealer_bust';
    var lose = outcome === 'lose' || outcome === 'bust';
    if (win) {
      s.wins += 1;
      s.streak += 1;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      if (net > s.biggestWin) s.biggestWin = net;
      if (outcome === 'blackjack') s.blackjacks += 1;
    } else if (lose) {
      s.losses += 1;
      s.streak = 0;
    } else {
      s.pushes += 1;
    }
    if (this.balance > s.bestBalance) s.bestBalance = this.balance;
  };

  P._persist = function () {
    var self = this;
    Storage.update(function (data) {
      data.balance = self.balance;
      data.stats = self.stats;
    });
  };

  /** Выдать бонусные фишки, если игрок остался без денег (никогда не тупик). */
  P.grantBonus = function () {
    if (this.balance < MIN_BET) {
      this.balance = START_BALANCE;
      this._persist();
    }
    return this.balance;
  };

  P.isBroke = function () { return this.balance < MIN_BET; };

  return {
    create: function () { return new Engine(); },
    MIN_BET: MIN_BET,
    START_BALANCE: START_BALANCE
  };
})();
