/* ============================================================================
 * UI.js — слой интерфейса и оркестрация игрового цикла.
 *
 * Отвечает за: экраны (загрузка → игра), HUD (фишки, очки, статус), ставки,
 * кнопки действий, оверлей результата, модалку статистики и за тайминг всех
 * анимаций. Игровые правила живут в Engine — здесь только представление и поток.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.UI = (function () {
  'use strict';

  var Engine = BJ.Engine;
  var CardView = BJ.CardView;
  var Anim = BJ.Anim;
  var Audio = BJ.Audio;
  var Haptics = BJ.Haptics;
  var Storage = BJ.Storage;
  var Yandex = BJ.Yandex;

  var CHIPS = [10, 25, 50, 100, 500];

  var OUTCOME_TEXT = {
    blackjack:   { title: 'Блэкджек!',        cls: 'win gold' },
    win:         { title: 'Вы выиграли',      cls: 'win' },
    dealer_bust: { title: 'Перебор у дилера!', cls: 'win' },
    push:        { title: 'Ничья',            cls: 'push' },
    lose:        { title: 'Дилер выиграл',    cls: 'lose' },
    bust:        { title: 'Перебор',          cls: 'lose' }
  };

  var engine;
  var els = {};
  var state = {
    busy: false,        // идёт анимация — блокируем ввод
    currentBet: 50,
    roundsSinceAd: 0,
    lastAdTime: 0
  };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    [
      'screen-loading', 'screen-game', 'loading-fill', 'btn-play', 'loading-hint',
      'coins-value', 'coins', 'btn-stats', 'btn-sound',
      'dealer-hand', 'player-hand', 'dealer-score', 'player-score',
      'dealer-area', 'player-area', 'center-status', 'deck-stack', 'table',
      'controls', 'bet-panel', 'bet-value', 'chips', 'btn-clear-bet', 'btn-deal',
      'action-panel', 'btn-hit', 'btn-double', 'btn-stand',
      'next-panel', 'btn-next',
      'broke-panel', 'btn-bonus',
      'modal-stats', 'stats-body', 'btn-stats-close', 'btn-reset'
    ].forEach(function (id) {
      els[id] = $(id);
    });
  }

  /* ---------------------------------------------------------------- фишки */
  function buildChips() {
    els.chips.innerHTML = '';
    CHIPS.forEach(function (value) {
      var chip = document.createElement('button');
      chip.className = 'chip chip-' + value;
      chip.type = 'button';
      chip.dataset.value = value;
      chip.innerHTML = '<span class="chip-inner">' + value + '</span>';
      chip.setAttribute('aria-label', 'Поставить ' + value);
      chip.addEventListener('click', function () { addChip(value); });
      els.chips.appendChild(chip);
    });
  }

  function addChip(value) {
    if (state.busy) return;
    Audio.unlock();
    var bal = engine.getBalance();
    if (state.currentBet + value > bal) {
      state.currentBet = bal;       // нельзя поставить больше, чем есть
    } else {
      state.currentBet += value;
    }
    Audio.play('chip');
    Haptics.tap();
    updateBetDisplay();
    Anim.pop(els['bet-value'], 1.15);
  }

  function clearBet() {
    if (state.busy) return;
    state.currentBet = 0;
    Audio.play('click');
    Haptics.tap();
    updateBetDisplay();
  }

  function updateBetDisplay() {
    els['bet-value'].textContent = state.currentBet;
    els['btn-deal'].disabled = state.currentBet < Engine.MIN_BET;
    // подсветка фишек, которые уже не по карману
    var bal = engine.getBalance();
    Array.prototype.forEach.call(els.chips.children, function (chip) {
      var v = parseInt(chip.dataset.value, 10);
      chip.classList.toggle('disabled', state.currentBet + v > bal && v > bal - state.currentBet);
    });
  }

  /* ----------------------------------------------------------- индикаторы */
  function updateCoins(animated) {
    var to = engine.getBalance();
    var from = parseInt(els['coins-value'].textContent, 10) || to;
    if (animated) {
      Anim.countUp(els['coins-value'], from, to, 400);
      Anim.pop(els.coins, 1.12);
    } else {
      els['coins-value'].textContent = to;
    }
  }

  function floatCoins(delta) {
    if (!delta) return;
    var tag = document.createElement('div');
    tag.className = 'coin-float ' + (delta > 0 ? 'plus' : 'minus');
    tag.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
    els.coins.appendChild(tag);
    setTimeout(function () { tag.remove(); }, 1200);
  }

  function setPlayerScore() {
    var to = engine.playerValue();
    var from = parseInt(els['player-score'].textContent, 10) || 0;
    Anim.countUp(els['player-score'], from, to);
    els['player-score'].classList.toggle('bust', to > 21);
    els['player-score'].classList.toggle('twentyone', to === 21);
  }

  function setDealerScore(revealAll) {
    var to = engine.dealerVisibleValue(revealAll);
    var from = parseInt(els['dealer-score'].textContent, 10) || 0;
    Anim.countUp(els['dealer-score'], from, to);
    els['dealer-score'].classList.toggle('bust', revealAll && to > 21);
  }

  /* --------------------------------------------------------- панели/экраны */
  function showControls(which) {
    var map = {
      bet: 'bet-panel', action: 'action-panel',
      next: 'next-panel', broke: 'broke-panel'
    };
    Object.keys(map).forEach(function (key) {
      var node = els[map[key]];
      if (node) node.hidden = (key !== which);
    });
  }

  function clearStatus() {
    els['center-status'].innerHTML = '';
    els['center-status'].className = 'center-status';
    els['dealer-area'].classList.remove('glow-win', 'glow-lose');
    els['player-area'].classList.remove('glow-win', 'glow-lose');
  }

  /* ----------------------------------------------------- раздача одной карты */
  function dealOne(card, who, faceUp) {
    var handEl = who === 'player' ? els['player-hand'] : els['dealer-hand'];
    var view = CardView.create(card, false);
    handEl.appendChild(view);
    Audio.play('deal');
    Haptics.deal();
    return Anim.dealCard(view, els['deck-stack'], faceUp, function () {
      if (faceUp) Audio.play('flip');
    }).then(function () { return view; });
  }

  /* ------------------------------------------------------------ игровой цикл */
  function beginBetting() {
    state.busy = false;
    clearStatus();
    els['dealer-hand'].innerHTML = '';
    els['player-hand'].innerHTML = '';
    els['player-score'].textContent = '0';
    els['dealer-score'].textContent = '0';
    els['player-score'].className = 'score-badge';
    els['dealer-score'].className = 'score-badge';

    if (engine.isBroke()) {
      showControls('broke');
      return;
    }
    var bal = engine.getBalance();
    state.currentBet = Math.min(Math.max(state.currentBet || 50, Engine.MIN_BET), bal);
    updateBetDisplay();
    showControls('bet');
  }

  function onDeal() {
    if (state.busy) return;
    Audio.unlock();
    if (state.currentBet < Engine.MIN_BET) {
      Anim.shake(els['bet-value']);
      return;
    }
    Audio.play('click');
    startRound(state.currentBet);
  }

  function startRound(bet) {
    state.busy = true;
    Storage.update(function (d) { d.settings.lastBet = bet; });
    engine.newRound(bet);
    updateCoins(true);          // ставка списана
    showControls('action');
    setActionsEnabled(false);
    Yandex.gameplayStart();

    var p = engine.getPlayer();
    var d = engine.getDealer();

    // Классический порядок: игрок, дилер(открыто), игрок, дилер(закрыто).
    dealOne(p[0], 'player', true)
      .then(function () { setPlayerScore(); return dealOne(d[0], 'dealer', true); })
      .then(function () { setDealerScore(false); return dealOne(p[1], 'player', true); })
      .then(function () { setPlayerScore(); return dealOne(d[1], 'dealer', false); })
      .then(function () {
        if (engine.hasNatural()) {
          return revealAndResolve();
        }
        // ход игрока
        state.busy = false;
        setActionsEnabled(true);
        updateDoubleButton();
      });
  }

  function setActionsEnabled(on) {
    els['btn-hit'].disabled = !on;
    els['btn-stand'].disabled = !on;
    els['btn-double'].disabled = !on;
  }

  function updateDoubleButton() {
    var can = engine.canDouble();
    els['btn-double'].disabled = !can;
    els['btn-double'].classList.toggle('faded', !can);
  }

  function onHit() {
    if (state.busy || !engine.canHit()) return;
    state.busy = true;
    Audio.play('click');
    setActionsEnabled(false);
    var card = engine.hit();
    dealOne(card, 'player', true).then(function () {
      setPlayerScore();
      if (engine.getPhase() === 'over') {
        // перебор у игрока
        Audio.play('bust');
        Haptics.bust();
        Anim.shake(els['player-hand']);
        revealAndResolve();
      } else {
        state.busy = false;
        setActionsEnabled(true);
        updateDoubleButton(); // после взятия удвоение уже недоступно
      }
    });
  }

  function onStand() {
    if (state.busy || !engine.canHit()) return;
    Audio.play('click');
    Haptics.tap();
    engine.stand();
    dealerTurn();
  }

  function onDouble() {
    if (state.busy || !engine.canDouble()) return;
    state.busy = true;
    Audio.play('chip');
    Haptics.tap();
    var card = engine.double();
    updateCoins(true); // вторая ставка списана
    setActionsEnabled(false);
    dealOne(card, 'player', true).then(function () {
      setPlayerScore();
      if (engine.getPhase() === 'over') {
        Audio.play('bust');
        Haptics.bust();
        Anim.shake(els['player-hand']);
        revealAndResolve();
      } else {
        dealerTurn();
      }
    });
  }

  // Открыть «дырку» дилера и завершить раунд (для блэкджека/перебора игрока).
  function revealAndResolve() {
    state.busy = true;
    showControls('action');
    setActionsEnabled(false);
    var hole = els['dealer-hand'].children[1];
    var flip = hole ? Anim.flipCard(hole) : Promise.resolve();
    return flip.then(function () {
      if (hole) Audio.play('flip');
      setDealerScore(true);
      return Anim.wait(350);
    }).then(finishRound);
  }

  function dealerTurn() {
    state.busy = true;
    showControls('action');
    setActionsEnabled(false);

    var hole = els['dealer-hand'].children[1];
    var seq = hole ? Anim.flipCard(hole) : Promise.resolve();
    seq.then(function () {
      if (hole) Audio.play('flip');
      setDealerScore(true);
      return Anim.wait(400);
    }).then(drawDealer);
  }

  function drawDealer() {
    if (engine.dealerShouldHit()) {
      var card = engine.dealerHit();
      dealOne(card, 'dealer', true).then(function () {
        setDealerScore(true);
        Anim.wait(420).then(drawDealer);
      });
    } else {
      Anim.wait(300).then(finishRound);
    }
  }

  /* ---------------------------------------------------------- итог раунда */
  function finishRound() {
    var result = engine.resolve();
    updateCoins(true);
    if (result.net !== 0) floatCoins(result.net);

    showResult(result);
    Yandex.gameplayStop();
    state.busy = false;
    state.roundsSinceAd += 1;
    showControls('next');
  }

  function showResult(result) {
    var meta = OUTCOME_TEXT[result.outcome] || OUTCOME_TEXT.push;
    var banner = document.createElement('div');
    banner.className = 'result-banner ' + meta.cls;

    var title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = meta.title;

    var sub = document.createElement('div');
    sub.className = 'result-net';
    if (result.net > 0) sub.textContent = '+' + result.net + ' фишек';
    else if (result.net < 0) sub.textContent = '−' + Math.abs(result.net) + ' фишек';
    else sub.textContent = 'Ставка возвращена';

    banner.appendChild(title);
    banner.appendChild(sub);
    els['center-status'].innerHTML = '';
    els['center-status'].appendChild(banner);

    // Свечение руки-победителя и звук/вибро.
    var won = result.outcome === 'win' || result.outcome === 'blackjack' || result.outcome === 'dealer_bust';
    var lost = result.outcome === 'lose' || result.outcome === 'bust';
    if (won) {
      els['player-area'].classList.add('glow-win');
      Audio.play(result.outcome === 'blackjack' ? 'blackjack' : 'win');
      Haptics.win();
    } else if (lost) {
      els['dealer-area'].classList.add('glow-win');
      els['player-area'].classList.add('glow-lose');
      if (result.outcome !== 'bust') { Audio.play('lose'); Haptics.lose(); }
    } else {
      Audio.play('push');
    }

    if (banner.animate && !Anim.isReduced()) {
      banner.animate(
        [
          { transform: 'scale(0.6) translateY(10px)', opacity: 0 },
          { transform: 'scale(1.06)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        { duration: 460, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both' }
      );
    }
  }

  function onNext() {
    if (state.busy) return;
    Audio.play('click');
    Haptics.tap();

    // Иногда показываем межраундовую рекламу Яндекса (не чаще ~раз/3 раунда и 60с).
    var now = Date.now();
    var showAd = Yandex.isReady() &&
      state.roundsSinceAd >= 3 &&
      (now - state.lastAdTime) > 60000;

    if (showAd) {
      state.roundsSinceAd = 0;
      state.lastAdTime = now;
      var wasOn = Audio.isEnabled();
      Audio.setEnabled(false);
      Yandex.showInterstitial({
        onClose: function () {
          Audio.setEnabled(wasOn);
          beginBetting();
        }
      });
    } else {
      beginBetting();
    }
  }

  function onBonus() {
    Audio.play('chip');
    Haptics.tap();
    engine.grantBonus();
    updateCoins(true);
    beginBetting();
  }

  /* --------------------------------------------------------------- звук UI */
  function refreshSoundButton() {
    var on = Audio.isEnabled();
    els['btn-sound'].textContent = on ? '🔊' : '🔇';
    els['btn-sound'].classList.toggle('off', !on);
  }

  function toggleSound() {
    var on = !Audio.isEnabled();
    Audio.setEnabled(on);
    Haptics.setEnabled(on);
    Storage.update(function (d) { d.settings.sound = on; d.settings.haptics = on; });
    refreshSoundButton();
    if (on) Audio.play('click');
  }

  /* --------------------------------------------------------- статистика UI */
  function openStats() {
    Audio.play('click');
    var s = engine.getStats();
    var rate = s.hands ? Math.round((s.wins / s.hands) * 100) : 0;
    var rows = [
      ['Сыграно раздач', s.hands],
      ['Побед', s.wins],
      ['Поражений', s.losses],
      ['Ничьих', s.pushes],
      ['Блэкджеков', s.blackjacks],
      ['Процент побед', rate + '%'],
      ['Лучшая серия побед', s.bestStreak],
      ['Крупнейший выигрыш', s.biggestWin + ' фишек'],
      ['Рекорд баланса', s.bestBalance + ' фишек'],
      ['Текущий баланс', engine.getBalance() + ' фишек']
    ];
    els['stats-body'].innerHTML = rows.map(function (r) {
      return '<div class="stat-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    els['modal-stats'].hidden = false;
  }

  function closeStats() {
    Audio.play('click');
    els['modal-stats'].hidden = true;
  }

  function resetProgress() {
    if (!window.confirm('Сбросить весь прогресс и статистику?')) return;
    Storage.reset();
    window.location.reload();
  }

  /* ------------------------------------------------------------------ старт */
  function bindEvents() {
    els['btn-deal'].addEventListener('click', onDeal);
    els['btn-clear-bet'].addEventListener('click', clearBet);
    els['btn-hit'].addEventListener('click', onHit);
    els['btn-stand'].addEventListener('click', onStand);
    els['btn-double'].addEventListener('click', onDouble);
    els['btn-next'].addEventListener('click', onNext);
    els['btn-bonus'].addEventListener('click', onBonus);
    els['btn-sound'].addEventListener('click', toggleSound);
    els['btn-stats'].addEventListener('click', openStats);
    els['btn-stats-close'].addEventListener('click', closeStats);
    els['btn-reset'].addEventListener('click', resetProgress);
    els['modal-stats'].addEventListener('click', function (e) {
      if (e.target === els['modal-stats']) closeStats();
    });
    // Разблокировка звука по первому касанию в любом месте.
    document.addEventListener('pointerdown', function once() {
      Audio.unlock();
      document.removeEventListener('pointerdown', once);
    }, { once: true });
  }

  function startGame() {
    Audio.unlock();
    els['screen-loading'].classList.add('hide');
    setTimeout(function () { els['screen-loading'].hidden = true; }, 450);
    els['screen-game'].hidden = false;
    updateCoins(false);
    beginBetting();
  }

  return {
    /** Вызывается из main.js после предзагрузки ассетов. */
    init: function () {
      engine = Engine.create();
      cacheEls();
      buildChips();
      bindEvents();

      var save = Storage.load();
      Audio.setEnabled(save.settings.sound);
      Haptics.setEnabled(save.settings.haptics);
      if (save.settings.lastBet) state.currentBet = save.settings.lastBet;
      refreshSoundButton();
      updateCoins(false);

      els['btn-play'].addEventListener('click', startGame);
    },

    /** Прогресс предзагрузки для стартового экрана. */
    setLoadingProgress: function (done, total) {
      var pct = Math.round((done / total) * 100);
      if (els['loading-fill']) els['loading-fill'].style.width = pct + '%';
      if (els['loading-hint']) els['loading-hint'].textContent = 'Загрузка карт… ' + pct + '%';
    },

    /** Ассеты готовы — показываем кнопку «Играть». */
    onAssetsReady: function () {
      if (els['loading-hint']) els['loading-hint'].textContent = 'Готово!';
      if (els['btn-play']) els['btn-play'].hidden = false;
    }
  };
})();
