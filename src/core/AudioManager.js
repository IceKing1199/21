/* ============================================================================
 * AudioManager.js — все звуки игры, синтезируемые на лету через Web Audio API.
 *
 * Почему не аудио-файлы: процедурный звук весит 0 байт, грузится мгновенно
 * (важно для требования «старт < 3с») и не нагружает сеть. Это «аналог»
 * Howler.js из ТЗ, построенный на нижележащем Web Audio.
 *
 * Звуки: раздача карты, клик кнопки, фишка, победа, блэкджек, проигрыш, ничья.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Audio = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;
  var unlocked = false;

  // Звуки, проигрываемые из реальных аудиофайлов (остальные синтезируются ниже).
  var SAMPLE_URLS = {
    shuffle: 'assets/sounds/shuffle.wav', // перемешивание колоды
    deal:    'assets/sounds/deal.wav'     // раздача карты
  };
  var buffers = {};        // name -> AudioBuffer (после декодирования)
  var preloadStarted = false;

  function ensureContext() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    return ctx;
  }

  // Браузеры запускают звук только после жеста пользователя.
  function unlock() {
    var c = ensureContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    if (!unlocked) {
      // короткий беззвучный буфер «прогревает» аудио-движок на iOS
      var b = c.createBuffer(1, 1, 22050);
      var s = c.createBufferSource();
      s.buffer = b;
      s.connect(master);
      s.start(0);
      unlocked = true;
    }
    preload(); // подстраховка: гарантируем загрузку сэмплов после жеста
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  /* --- загрузка и воспроизведение аудиофайлов --- */

  // Декодирует один файл в AudioBuffer (декодирование работает и в suspended-контексте).
  function loadSample(name, url) {
    var c = ensureContext();
    if (!c) return;
    fetch(url)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) {
        return new Promise(function (resolve, reject) {
          // callback-форма decodeAudioData надёжнее в старых WebKit
          c.decodeAudioData(buf, resolve, reject);
        });
      })
      .then(function (audioBuffer) { buffers[name] = audioBuffer; })
      .catch(function () { /* файл недоступен — play() откатится на синтез */ });
  }

  // Заранее декодирует все файлы (вызывается на экране загрузки).
  function preload() {
    if (preloadStarted) return;
    preloadStarted = true;
    if (!ensureContext()) return;
    Object.keys(SAMPLE_URLS).forEach(function (name) {
      loadSample(name, SAMPLE_URLS[name]);
    });
  }

  // Воспроизводит готовый сэмпл. Новый источник на каждый вызов — корректное
  // наложение при быстрой раздаче нескольких карт.
  function playSample(name) {
    if (!enabled) return false;
    var c = ensureContext();
    if (!c || !buffers[name]) return false;
    var src = c.createBufferSource();
    src.buffer = buffers[name];
    var gain = c.createGain();
    gain.gain.value = 0.8;
    src.connect(gain);
    gain.connect(master);
    src.start(0);
    return true;
  }

  /* --- низкоуровневые помощники синтеза --- */

  // Тон с ADSR-огибающей.
  function tone(opts) {
    if (!enabled) return;
    var c = ensureContext();
    if (!c) return;
    var t0 = now() + (opts.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.toFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.toFreq), t0 + opts.dur);
    }
    var peak = opts.gain != null ? opts.gain : 0.25;
    var atk = opts.attack != null ? opts.attack : 0.005;
    var dur = opts.dur || 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Короткий шумовой импульс (для «снапа» карты и фишек).
  function noise(opts) {
    if (!enabled) return;
    var c = ensureContext();
    if (!c) return;
    var t0 = now() + (opts.delay || 0);
    var dur = opts.dur || 0.08;
    var frames = Math.floor(c.sampleRate * dur);
    var buffer = c.createBuffer(1, frames, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      // затухающий белый шум
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, opts.decay || 2);
    }
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.value = opts.freq || 2200;
    filter.Q.value = opts.q || 0.8;
    var gain = c.createGain();
    gain.gain.value = opts.gain != null ? opts.gain : 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* --- игровые звуки --- */

  var SFX = {
    deal: function () {
      // мягкий «шорох-снап» скользящей карты
      noise({ freq: 1800, dur: 0.07, gain: 0.22, q: 1.2, decay: 3 });
      tone({ type: 'triangle', freq: 320, toFreq: 180, dur: 0.06, gain: 0.06 });
    },
    flip: function () {
      noise({ freq: 2600, dur: 0.05, gain: 0.18, q: 1.5, decay: 4 });
    },
    click: function () {
      tone({ type: 'triangle', freq: 540, toFreq: 660, dur: 0.06, gain: 0.16, attack: 0.002 });
    },
    chip: function () {
      noise({ freq: 4200, dur: 0.03, gain: 0.16, q: 2, decay: 6 });
      noise({ freq: 5200, dur: 0.03, gain: 0.13, q: 2, decay: 6, delay: 0.04 });
    },
    win: function () {
      // восходящее мажорное арпеджио, колокольный тембр
      var seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach(function (f, i) {
        tone({ type: 'sine', freq: f, dur: 0.5, gain: 0.22, delay: i * 0.09, attack: 0.004 });
        tone({ type: 'triangle', freq: f * 2, dur: 0.3, gain: 0.05, delay: i * 0.09 });
      });
    },
    blackjack: function () {
      // фанфара: арпеджио + блеск сверху
      var seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach(function (f, i) {
        tone({ type: 'sine', freq: f, dur: 0.55, gain: 0.24, delay: i * 0.08 });
        tone({ type: 'triangle', freq: f * 1.5, dur: 0.3, gain: 0.06, delay: i * 0.08 });
      });
      tone({ type: 'sine', freq: 1568, dur: 0.7, gain: 0.12, delay: 0.45 });
    },
    lose: function () {
      // нисходящий минорный «вздох»
      tone({ type: 'sawtooth', freq: 311.13, toFreq: 155, dur: 0.5, gain: 0.16 });
      tone({ type: 'sine', freq: 207.65, toFreq: 130, dur: 0.55, gain: 0.12, delay: 0.05 });
    },
    bust: function () {
      noise({ freq: 700, dur: 0.25, gain: 0.3, filter: 'lowpass', q: 0.5, decay: 1.4 });
      tone({ type: 'sawtooth', freq: 180, toFreq: 70, dur: 0.4, gain: 0.18 });
    },
    push: function () {
      tone({ type: 'sine', freq: 392, dur: 0.25, gain: 0.16 });
      tone({ type: 'sine', freq: 392, dur: 0.25, gain: 0.14, delay: 0.18 });
    }
  };

  return {
    unlock: unlock,
    preload: preload,
    setEnabled: function (v) { enabled = !!v; if (v) unlock(); },
    isEnabled: function () { return enabled; },
    play: function (name) {
      if (!enabled) return;
      ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      // Сначала пробуем реальный аудиофайл; если не загружен — синтезируем.
      if (SAMPLE_URLS[name]) {
        if (playSample(name)) return;
      }
      if (SFX[name]) SFX[name]();
    }
  };
})();
