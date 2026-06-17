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
  var I18n = BJ.I18n;

  var CHIPS = [10, 25, 50, 100, 500];

  // Тексты исхода берутся из i18n по ключу outcome.*; cls — CSS-классы баннера.
  var OUTCOME_TEXT = {
    blackjack:   { key: 'outcome.blackjack',   cls: 'win gold' },
    win:         { key: 'outcome.win',         cls: 'win' },
    dealer_bust: { key: 'outcome.dealer_bust', cls: 'win' },
    push:        { key: 'outcome.push',        cls: 'push' },
    lose:        { key: 'outcome.lose',        cls: 'lose' },
    bust:        { key: 'outcome.bust',        cls: 'lose' }
  };

  // Магазин/бонусы.
  var DAY_MS = 24 * 60 * 60 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var DAILY_AMOUNT = 500;
  var AD1_AMOUNT = 1000;
  var PACK_AMOUNT = 5000;
  var PACK_ADS = 3;       // сколько реклам в пакете
  var PACK_PER_HOUR = 2;  // лимит выдач пакета в час

  function t(key, params) { return I18n.t(key, params); }

  var engine;
  var els = {};
  var shopTimer = null;   // интервал обновления отсчётов в магазине
  var state = {
    busy: false,        // идёт анимация — блокируем ввод
    currentBet: 50,
    roundsSinceAd: 0,
    lastAdTime: 0,
    lastResult: null    // последний итог раунда (для перерисовки при смене языка)
  };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    [
      'screen-loading', 'screen-game', 'loading-fill', 'btn-play', 'loading-hint',
      'coins-value', 'coins', 'btn-stats', 'btn-sound', 'btn-leaders',
      'dealer-hand', 'player-hand', 'dealer-score', 'player-score',
      'dealer-area', 'player-area', 'center-status', 'deck-stack', 'table',
      'controls', 'bet-panel', 'bet-value', 'chips', 'btn-clear-bet', 'btn-deal',
      'action-panel', 'btn-hit', 'btn-double', 'btn-stand',
      'next-panel', 'btn-next',
      'broke-panel', 'btn-bonus',
      'modal-stats', 'stats-body', 'btn-stats-close', 'btn-reset',
      'modal-leaders', 'leaders-body', 'btn-leaders-close', 'btn-leaders-auth',
      'btn-shop', 'btn-settings', 'btn-rules',
      'modal-rules', 'rules-body', 'btn-rules-close',
      'modal-settings', 'settings-body', 'btn-settings-close',
      'modal-shop', 'shop-body', 'btn-shop-close'
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
      chip.setAttribute('aria-label', t('bet.place', { v: value }));
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
    state.lastResult = null;
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
    engine.newRound(bet);       // свежая колода перемешивается
    Audio.play('shuffle');      // звук перемешивания в начале раздачи
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
    state.lastResult = result;
    var meta = OUTCOME_TEXT[result.outcome] || OUTCOME_TEXT.push;
    var banner = document.createElement('div');
    banner.className = 'result-banner ' + meta.cls;

    var title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = t(meta.key);

    var sub = document.createElement('div');
    sub.className = 'result-net';
    if (result.net > 0) sub.textContent = t('result.win', { n: result.net });
    else if (result.net < 0) sub.textContent = t('result.lose', { n: Math.abs(result.net) });
    else sub.textContent = t('result.push');

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
    Storage.update(function (d) { d.settings.sound = on; });
    pushCloud();
    refreshSoundButton();
    if (on) Audio.play('click');
  }

  /* --------------------------------------------------------- статистика UI */
  function renderStats() {
    var s = engine.getStats();
    var rate = s.hands ? Math.round((s.wins / s.hands) * 100) : 0;
    var chips = t('unit.chips');
    var rows = [
      [t('stats.hands'), s.hands],
      [t('stats.wins'), s.wins],
      [t('stats.losses'), s.losses],
      [t('stats.pushes'), s.pushes],
      [t('stats.blackjacks'), s.blackjacks],
      [t('stats.winrate'), rate + '%'],
      [t('stats.beststreak'), s.bestStreak],
      [t('stats.biggestwin'), s.biggestWin + ' ' + chips],
      [t('stats.bestbalance'), s.bestBalance + ' ' + chips],
      [t('stats.current'), engine.getBalance() + ' ' + chips]
    ];
    els['stats-body'].innerHTML = rows.map(function (r) {
      return '<div class="stat-row"><span>' + escapeHtml(r[0]) + '</span><b>' + escapeHtml(r[1]) + '</b></div>';
    }).join('');
  }

  function openStats() {
    Audio.play('click');
    renderStats();
    els['modal-stats'].hidden = false;
  }

  function closeStats() {
    Audio.play('click');
    els['modal-stats'].hidden = true;
  }

  /* ----------------------------------------------------- таблица лидеров UI */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderLeaders(entries) {
    if (!entries || !entries.length) {
      els['leaders-body'].innerHTML =
        '<div class="leaders-empty">' + escapeHtml(t('leaders.empty')) + '</div>';
      return;
    }
    els['leaders-body'].innerHTML = entries.map(function (e) {
      var name = e.name ? escapeHtml(e.name) : escapeHtml(t('leaders.anon'));
      return '<div class="leader-row' + (e.isCurrent ? ' me' : '') + '">' +
        '<span class="lead-rank">' + e.rank + '</span>' +
        '<span class="lead-name">' + name + '</span>' +
        '<b class="lead-score">' + e.score + '</b>' +
        '</div>';
    }).join('');
  }

  function refreshLeaders() {
    // Кнопка входа — только для незалогиненных игроков внутри Яндекса.
    els['btn-leaders-auth'].hidden = !Yandex.hasSDK() || Yandex.isAuthorized();
    Yandex.getLeaderboard().then(function (entries) {
      if (entries === null) {
        els['leaders-body'].innerHTML =
          '<div class="leaders-empty">' + escapeHtml(t('leaders.unavailable')) + '</div>';
        return;
      }
      renderLeaders(entries);
    });
  }

  function openLeaders() {
    Audio.play('click');
    els['leaders-body'].innerHTML = '<div class="leaders-empty">' + escapeHtml(t('common.loading')) + '</div>';
    els['modal-leaders'].hidden = false;
    refreshLeaders();
  }

  function closeLeaders() {
    Audio.play('click');
    els['modal-leaders'].hidden = true;
  }

  function onLeadersAuth() {
    Audio.play('click');
    Yandex.openAuth().then(function () {
      // После входа отправим текущий счёт и обновим таблицу.
      Yandex.submitScore(engine.getBalance());
      refreshLeaders();
    });
  }

  /** Подтянуть облачное сохранение игрока (Яндекс) поверх локального кэша. */
  function syncFromCloud() {
    return Yandex.cloudGet().then(function (data) {
      if (!data) return;
      // Облако — источник истины для баланса/статистики/настроек/бонусов игрока.
      Storage.merge({
        balance: data.balance,
        stats: data.stats,
        settings: data.settings,
        bonus: data.bonus
      });
      engine.applySave();
      var save = Storage.load();
      if (save.settings && save.settings.lastBet) state.currentBet = save.settings.lastBet;
      // Язык: явный выбор из облака применяем; иначе берём язык окружения Яндекса.
      if (save.settings && save.settings.lang) {
        I18n.setLang(save.settings.lang);
      } else {
        I18n.detectInitial();
        applyLang();
      }
      // Звук/вибро могли прийти из облака.
      Audio.setEnabled(save.settings.sound !== false);
      Haptics.setEnabled(save.settings.haptics !== false);
      refreshSoundButton();
      updateCoins(false);
    }).catch(function () {});
  }

  function resetProgress() {
    if (!window.confirm(t('stats.resetConfirm'))) return;
    Storage.reset();
    window.location.reload();
  }

  /** Сохранить служебные данные (настройки/бонусы) в облако Яндекса. */
  function pushCloud() {
    if (Yandex.cloudSet) Yandex.cloudSet(Storage.load());
  }

  /* =================================================================== ЯЗЫК */
  // Применить текущий язык ко всему статическому тексту + перерисовать
  // динамические части (открытые модалки, баннер итога, подсказку загрузки).
  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-title]'), function (n) {
      n.setAttribute('title', t(n.getAttribute('data-i18n-title')));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-aria]'), function (n) {
      n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria')));
    });
    try { document.title = t('brand') + ' — Blackjack'; } catch (e) {}

    // Фишки (aria), подсказка загрузки, кнопка звука.
    if (els.chips) {
      Array.prototype.forEach.call(els.chips.children, function (chip) {
        chip.setAttribute('aria-label', t('bet.place', { v: chip.dataset.value }));
      });
    }
    if (els['btn-play'] && els['btn-play'].hidden === false && els['loading-hint']) {
      els['loading-hint'].textContent = t('loading.ready');
    }

    // Перерисовать открытые динамические представления.
    if (state.lastResult && els['center-status'] && els['center-status'].firstChild) {
      showResult(state.lastResult);
    }
    if (els['modal-stats'] && !els['modal-stats'].hidden) renderStats();
    if (els['modal-leaders'] && !els['modal-leaders'].hidden) refreshLeaders();
    if (els['modal-rules'] && !els['modal-rules'].hidden) renderRules();
    if (els['modal-settings'] && !els['modal-settings'].hidden) renderSettings();
    if (els['modal-shop'] && !els['modal-shop'].hidden) renderShop();
  }

  /* ================================================================= ПРАВИЛА */
  function renderRules() {
    var lines = I18n.tList('rules.body');
    els['rules-body'].innerHTML = lines.map(function (line) {
      return '<p class="rule-line">' + escapeHtml(line) + '</p>';
    }).join('');
  }

  function openRules() {
    Audio.play('click');
    renderRules();
    els['modal-rules'].hidden = false;
  }

  function closeRules() {
    Audio.play('click');
    els['modal-rules'].hidden = true;
  }

  /* =============================================================== НАСТРОЙКИ */
  function renderSettings() {
    var cur = I18n.getLang();
    var langBtns = I18n.LANGS.map(function (l) {
      return '<button class="lang-btn' + (l.code === cur ? ' active' : '') +
        '" data-lang="' + l.code + '">' + escapeHtml(l.label) + '</button>';
    }).join('');

    var soundOn = Audio.isEnabled();
    var hapticsOn = Haptics.isEnabled ? Haptics.isEnabled() : soundOn;

    els['settings-body'].innerHTML =
      '<div class="set-group"><div class="set-label">' + escapeHtml(t('settings.language')) + '</div>' +
        '<div class="lang-grid">' + langBtns + '</div></div>' +
      '<div class="set-row"><span>' + escapeHtml(t('settings.sound')) + '</span>' +
        '<button class="toggle' + (soundOn ? ' on' : '') + '" id="set-sound">' +
        escapeHtml(soundOn ? t('settings.on') : t('settings.off')) + '</button></div>' +
      '<div class="set-row"><span>' + escapeHtml(t('settings.haptics')) + '</span>' +
        '<button class="toggle' + (hapticsOn ? ' on' : '') + '" id="set-haptics">' +
        escapeHtml(hapticsOn ? t('settings.on') : t('settings.off')) + '</button></div>';

    // Навешиваем обработчики на свежесозданные элементы.
    Array.prototype.forEach.call(els['settings-body'].querySelectorAll('.lang-btn'), function (b) {
      b.addEventListener('click', function () {
        Audio.play('click');
        I18n.setLang(b.getAttribute('data-lang')); // setLang вызовет applyLang → renderSettings
      });
    });
    var sBtn = document.getElementById('set-sound');
    if (sBtn) sBtn.addEventListener('click', function () { toggleSound(); renderSettings(); });
    var hBtn = document.getElementById('set-haptics');
    if (hBtn) hBtn.addEventListener('click', function () { toggleHaptics(); renderSettings(); });
  }

  function openSettings() {
    Audio.play('click');
    renderSettings();
    els['modal-settings'].hidden = false;
  }

  function closeSettings() {
    Audio.play('click');
    els['modal-settings'].hidden = true;
  }

  function toggleHaptics() {
    var on = !(Haptics.isEnabled ? Haptics.isEnabled() : false);
    Haptics.setEnabled(on);
    Storage.update(function (d) { d.settings.haptics = on; });
    pushCloud();
    if (on) Haptics.tap();
  }

  /* ============================================================ МАГАЗИН ФИШЕК */
  // Сколько раз пакет «3 рекламы» уже взят за последний час.
  function packTimesInHour() {
    var now = Date.now();
    var times = (Storage.load().bonus.packTimes || []).filter(function (ts) {
      return now - ts < HOUR_MS;
    });
    return times;
  }

  function fmtTime(ms) {
    if (ms < 0) ms = 0;
    var s = Math.ceil(ms / 1000);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (pad(m) + ':' + pad(s));
  }

  function creditAndRefresh(amount) {
    engine.creditChips(amount);
    updateCoins(true);
    floatCoins(amount);
    renderShop();
  }

  function renderShop() {
    var hasAds = Yandex.hasSDK();
    var bonus = Storage.load().bonus;
    var now = Date.now();

    // Ежедневный бонус.
    var dailyReady = (now - (bonus.dailyAt || 0)) >= DAY_MS;
    var dailyBtn = dailyReady
      ? '<button class="btn btn-primary shop-btn" id="shop-daily">' + escapeHtml(t('shop.daily.claim')) + '</button>'
      : '<button class="btn btn-ghost shop-btn" id="shop-daily" disabled>' +
        escapeHtml(t('shop.daily.next', { t: fmtTime(DAY_MS - (now - (bonus.dailyAt || 0))) })) + '</button>';

    // Пакет «3 рекламы» — лимит 2 раза в час.
    var times = packTimesInHour();
    var packLocked = times.length >= PACK_PER_HOUR;
    var packBtn;
    if (!hasAds) {
      packBtn = '<button class="btn btn-ghost shop-btn" disabled>' + escapeHtml(t('shop.unavailable')) + '</button>';
    } else if (packLocked) {
      var oldest = Math.min.apply(null, times);
      packBtn = '<button class="btn btn-ghost shop-btn" id="shop-pack" disabled>' +
        escapeHtml(t('shop.ad3.locked', { t: fmtTime(HOUR_MS - (now - oldest)) })) + '</button>';
    } else {
      packBtn = '<button class="btn btn-primary shop-btn" id="shop-pack">' + escapeHtml(t('shop.ad3.btn')) + '</button>';
    }

    // Одиночная реклама.
    var ad1Btn = hasAds
      ? '<button class="btn btn-primary shop-btn" id="shop-ad1">' + escapeHtml(t('shop.ad1.btn')) + '</button>'
      : '<button class="btn btn-ghost shop-btn" disabled>' + escapeHtml(t('shop.unavailable')) + '</button>';

    function card(title, desc, btn) {
      return '<div class="shop-item"><div class="shop-text"><b>' + escapeHtml(title) +
        '</b><span>' + escapeHtml(desc) + '</span></div>' + btn + '</div>';
    }

    els['shop-body'].innerHTML =
      card(t('shop.daily.title'), t('shop.daily.desc'), dailyBtn) +
      card(t('shop.ad1.title'), t('shop.ad1.desc'), ad1Btn) +
      card(t('shop.ad3.title'), t('shop.ad3.desc'), packBtn);

    var d = document.getElementById('shop-daily');
    if (d && dailyReady) d.addEventListener('click', onClaimDaily);
    var a1 = document.getElementById('shop-ad1');
    if (a1) a1.addEventListener('click', onWatchAd1);
    var pk = document.getElementById('shop-pack');
    if (pk && !packLocked && hasAds) pk.addEventListener('click', onWatchPack);
  }

  function onClaimDaily() {
    Audio.play('chip');
    Haptics.tap();
    Storage.update(function (d) { d.bonus.dailyAt = Date.now(); });
    pushCloud();
    creditAndRefresh(DAILY_AMOUNT);
  }

  function onWatchAd1() {
    var btn = document.getElementById('shop-ad1');
    if (btn) btn.disabled = true;
    Yandex.showRewardedVideo({
      onRewarded: function () { creditAndRefresh(AD1_AMOUNT); },
      onClose: function () { renderShop(); },
      onError: function () { renderShop(); }
    });
  }

  // Последовательно показываем PACK_ADS реклам; награда — только если все
  // просмотрены полностью. Прогресс пишем в подпись кнопки.
  function onWatchPack() {
    var rewarded = 0;
    var k = 0;
    var btn = document.getElementById('shop-pack');

    function setProgress() {
      if (btn) btn.textContent = t('shop.ad3.progress', { k: k, n: PACK_ADS });
    }

    function playNext() {
      if (k >= PACK_ADS) {
        if (rewarded >= PACK_ADS) {
          Storage.update(function (d) {
            var now = Date.now();
            var arr = (d.bonus.packTimes || []).filter(function (ts) { return now - ts < HOUR_MS; });
            arr.push(now);
            d.bonus.packTimes = arr;
          });
          pushCloud();
          creditAndRefresh(PACK_AMOUNT);
        } else {
          renderShop(); // не досмотрел — без награды
        }
        return;
      }
      k += 1;
      setProgress();
      Yandex.showRewardedVideo({
        onRewarded: function () { rewarded += 1; },
        onClose: function () { playNext(); },
        onError: function () { renderShop(); }
      });
    }

    if (btn) btn.disabled = true;
    playNext();
  }

  function openShop() {
    Audio.play('click');
    renderShop();
    els['modal-shop'].hidden = false;
    if (shopTimer) clearInterval(shopTimer);
    // Живой отсчёт времени для заблокированных опций.
    shopTimer = setInterval(function () {
      if (els['modal-shop'].hidden) { clearInterval(shopTimer); shopTimer = null; return; }
      renderShop();
    }, 1000);
  }

  function closeShop() {
    Audio.play('click');
    els['modal-shop'].hidden = true;
    if (shopTimer) { clearInterval(shopTimer); shopTimer = null; }
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
    els['btn-leaders'].addEventListener('click', openLeaders);
    els['btn-leaders-close'].addEventListener('click', closeLeaders);
    els['btn-leaders-auth'].addEventListener('click', onLeadersAuth);
    els['modal-leaders'].addEventListener('click', function (e) {
      if (e.target === els['modal-leaders']) closeLeaders();
    });
    // Старт-экран: магазин, настройки, правила.
    els['btn-shop'].addEventListener('click', openShop);
    els['btn-settings'].addEventListener('click', openSettings);
    els['btn-rules'].addEventListener('click', openRules);
    els['btn-shop-close'].addEventListener('click', closeShop);
    els['btn-settings-close'].addEventListener('click', closeSettings);
    els['btn-rules-close'].addEventListener('click', closeRules);
    els['modal-shop'].addEventListener('click', function (e) {
      if (e.target === els['modal-shop']) closeShop();
    });
    els['modal-settings'].addEventListener('click', function (e) {
      if (e.target === els['modal-settings']) closeSettings();
    });
    els['modal-rules'].addEventListener('click', function (e) {
      if (e.target === els['modal-rules']) closeRules();
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

      // Язык: сохранённый → окружение → браузер → ru, затем перевести интерфейс.
      I18n.detectInitial();
      applyLang();

      els['btn-play'].addEventListener('click', startGame);
    },

    /** Синхронизация облачного сохранения (вызывается из main.js после init SDK). */
    syncFromCloud: syncFromCloud,

    /** Прогресс предзагрузки для стартового экрана. */
    setLoadingProgress: function (done, total) {
      var pct = Math.round((done / total) * 100);
      if (els['loading-fill']) els['loading-fill'].style.width = pct + '%';
      if (els['loading-hint']) els['loading-hint'].textContent = t('loading.cards', { pct: pct });
    },

    /** Ассеты готовы — показываем кнопку «Играть». */
    onAssetsReady: function () {
      if (els['loading-hint']) els['loading-hint'].textContent = t('loading.ready');
      if (els['btn-play']) els['btn-play'].hidden = false;
    },

    /** Применить текущий язык ко всему интерфейсу (вызывается из I18n.setLang). */
    applyLang: applyLang
  };
})();
