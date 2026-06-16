/* ============================================================================
 * Anim.js — помощники анимации (движение раздачи, переворот, счётчик очков).
 * Использует Web Animations API + requestAnimationFrame. Это «аналог» GSAP
 * из ТЗ без внешней зависимости. Уважает prefers-reduced-motion.
 * ========================================================================== */
window.BJ = window.BJ || {};

BJ.Anim = (function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isReduced() { return reduced; }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, reduced ? Math.min(ms, 60) : ms); });
  }

  /**
   * Раздача карты: элемент «вылетает» из колоды в свой слот и (если faceUp)
   * переворачивается лицом. Возвращает промис, который резолвится по окончании.
   */
  function dealCard(cardEl, deckEl, faceUp, onFlip) {
    return new Promise(function (resolve) {
      // Стартовая позиция = центр колоды относительно финального слота карты.
      var cardRect = cardEl.getBoundingClientRect();
      var deckRect = deckEl ? deckEl.getBoundingClientRect() : cardRect;
      var dx = (deckRect.left + deckRect.width / 2) - (cardRect.left + cardRect.width / 2);
      var dy = (deckRect.top + deckRect.height / 2) - (cardRect.top + cardRect.height / 2);

      var flip = function () {
        if (faceUp) cardEl.classList.add('show-front');
        if (onFlip) onFlip();
      };

      if (reduced || !cardEl.animate) {
        flip();
        resolve();
        return;
      }

      var startRot = (Math.random() * 14 - 7).toFixed(1); // лёгкий разворот
      var anim = cardEl.animate(
        [
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + startRot + 'deg) scale(0.92)', opacity: 0.65 },
          { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }
        ],
        { duration: 300, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'both' }
      );

      // Переворачиваем ближе к концу прилёта — выглядит как «шлепок» карты.
      var flipped = false;
      var flipTimer = setTimeout(function () {
        flipped = true;
        flip();
      }, 170);

      anim.onfinish = function () {
        if (!flipped) { clearTimeout(flipTimer); flip(); }
        try { anim.cancel(); } catch (e) {}
        resolve();
      };
    });
  }

  /** Переворот уже лежащей карты (например, «дырки» дилера). */
  function flipCard(cardEl) {
    return new Promise(function (resolve) {
      cardEl.classList.add('show-front');
      wait(reduced ? 0 : 360).then(resolve);
    });
  }

  /** Анимированный счётчик: число в элементе плавно меняется from → to. */
  function countUp(elNode, from, to, dur) {
    if (from === to) { elNode.textContent = to; return Promise.resolve(); }
    if (reduced || !window.requestAnimationFrame) {
      elNode.textContent = to;
      return Promise.resolve();
    }
    dur = dur || 320;
    return new Promise(function (resolve) {
      var start = performance.now();
      elNode.classList.add('counting');
      function step(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        var val = Math.round(from + (to - from) * eased);
        elNode.textContent = val;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          elNode.textContent = to;
          elNode.classList.remove('counting');
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  /** Короткий «поп» — масштабный отклик элемента. */
  function pop(elNode, scale) {
    if (reduced || !elNode.animate) return;
    elNode.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(' + (scale || 1.18) + ')' }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'ease-out' }
    );
  }

  /** Лёгкая тряска (для проигрыша/перебора). */
  function shake(elNode) {
    if (reduced || !elNode.animate) return;
    elNode.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(0)' }
      ],
      { duration: 380, easing: 'ease-in-out' }
    );
  }

  return {
    isReduced: isReduced,
    wait: wait,
    dealCard: dealCard,
    flipCard: flipCard,
    countUp: countUp,
    pop: pop,
    shake: shake
  };
})();
