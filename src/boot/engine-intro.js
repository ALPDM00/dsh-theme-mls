/* ===========================================================================
 * dsh-theme-mls — Boot payload: intro stage engine + orchestrator
 * -----------------------------------------------------------------------------
 * Extracted from the standalone boot animation (启动动画.html), scoped to
 * #dshMarBootHost and adapted for in-page injection:
 *
 *   Timeline (fixed, tuned):
 *     0.00s  black screen + green deepseek logo + caption
 *     1.20s  inverted-blue pixel logo flicker (CSS mb-stage2)
 *     1.85s  blue pixel logo fades in (CSS mb-stage3)
 *     2.35s  green HUI frames pop in (mb-hui-1..5, CSS mb-appear)
 *     2.86s  frames begin their scaling rush (JS, ~2.8s)
 *     2.88s  blue logo + blue tile begin scaling to 40x (JS, ~2.85s)
 *     5.73s  solid #4D6CFE background fully covers (full-screen div reused)
 *     6.73s  green logo + caption fade out (0.4s)
 *     7.13s  #mb-boot fades in → window.__mbMarathon.start() (marathon stage)
 *
 * If the marathon engine failed to load, the orchestrator still calls
 * window.__mbBootDone() so the overlay is never left stuck on screen.
 * ========================================================================= */
(function () {
  'use strict';

  var hostEl = document.getElementById('dshMarBootHost');
  if (!hostEl) return;
  function q(s) { return hostEl.querySelector(s); }

  // ===== 启动1 引擎：绿框 / 蓝logo / 纯色背景 的放大袭来 =====
  var HUI_SPEED = 0.03, HUI_POWER = 6, HUI_DURATION = 2800;
  var HUI_END_SCALE = 7, HUI_LAYER_STEP = 0.3;
  var BLUE_SPEED = 0.01, BLUE_POWER = 30, BLUE_DURATION = 2850;

  var rafIds = [];

  function makeEase(endScale, initialSpeed, power) {
    return function (t) {
      var p = initialSpeed * t + (1 - initialSpeed) * Math.pow(t, power);
      return 1 + (endScale - 1) * p;
    };
  }
  function run(els, startMs, endScale, initialSpeed, power, durationMs) {
    var ease = makeEase(endScale, initialSpeed, power);
    setTimeout(function () {
      var t0 = performance.now();
      function step(now) {
        var t = Math.min((now - t0) / durationMs, 1);
        var scale = ease(t);
        for (var i = 0; i < els.length; i++) {
          els[i].style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
        }
        if (t < 1) rafIds.push(requestAnimationFrame(step));
      }
      rafIds.push(requestAnimationFrame(step));
    }, startMs);
  }

  [1, 2, 3, 4, 5].forEach(function (n) {
    var endScale = HUI_END_SCALE * (1 + (5 - n) * HUI_LAYER_STEP);
    run([q('.mb-hui-' + n)], 2860, endScale, HUI_SPEED, HUI_POWER, HUI_DURATION);
  });
  run([q('.mb-logo-blue')], 2880, 40, BLUE_SPEED, BLUE_POWER, BLUE_DURATION);
  run([q('.mb-logo-blue-bg')], 2880, 40, BLUE_SPEED, BLUE_POWER, BLUE_DURATION);

  // ===== 编排：启动1 -> 静止 1s -> 绿logo消失 -> marathon =====
  var SOLID_COVER_AT = 5730;   // 纯色背景覆盖完成 (2.88s + 2.85s)
  var HOLD_MS       = 1000;    // 静止时长
  var LOGO_FADE_MS  = 400;     // 绿 logo 淡出

  var solidBg    = q('#mb-solid-bg');
  var logoBlueBg = q('.mb-logo-blue-bg');
  var logoTop    = q('.mb-logo-top');
  var caption    = q('.mb-caption');
  var boot       = q('#mb-boot');

  // 1) 纯色背景覆盖完成：替换为全屏背景（等于浏览器大小），进入静止
  setTimeout(function () {
    solidBg.style.opacity = '1';
    logoBlueBg.style.display = 'none';
  }, SOLID_COVER_AT);

  // 2) 静止 1s 结束：绿 logo + 文字淡出
  setTimeout(function () {
    logoTop.style.transition = 'opacity ' + LOGO_FADE_MS + 'ms ease';
    caption.style.transition = 'opacity ' + LOGO_FADE_MS + 'ms ease';
    logoTop.style.opacity = '0';
    caption.style.opacity = '0';
  }, SOLID_COVER_AT + HOLD_MS);

  // 3) 绿 logo 完全消失：显示 marathon（canvas 透明透出 solid-bg 纯蓝，无缝衔接）、启动
  setTimeout(function () {
    boot.style.opacity = '1';
    if (window.__mbMarathon) {
      window.__mbMarathon.start();
    } else if (typeof window.__mbBootDone === 'function') {
      window.__mbBootDone();
    }
  }, SOLID_COVER_AT + HOLD_MS + LOGO_FADE_MS);

  // teardown hook used by the host driver / plugin dispose
  window.__mbIntroStop = function () {
    for (var i = 0; i < rafIds.length; i++) cancelAnimationFrame(rafIds[i]);
    rafIds = [];
  };
})();
