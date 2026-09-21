/* ==========================================================================
   背景飘落的樱花花瓣
   对应「粒子特效」那一类（Particles.js / Proton Engine），
   这里用原生 Canvas 写，省掉一个 CDN 依赖，也能完全贴合本站配色。

   - 花瓣数量按屏幕宽度自适应，最多 26 片，不至于烧 CPU
   - 跟随主题色（--accent），切换深浅色时自动取新颜色
   - 标签页切到后台就暂停，不空转
   - 系统开启「减少动态效果」时直接不跑
   ========================================================================== */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.getElementById('petals');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var doc = document;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;
  var petals = [];
  var raf = null;
  var last = 0;
  var color = '#ff92c2';

  /* ---------------------------- 颜色跟随主题 ---------------------------- */
  function readColor() {
    try {
      var v = window.getComputedStyle(doc.documentElement).getPropertyValue('--accent');
      if (v && v.trim()) color = v.trim();
    } catch (e) {
      /* 读不到就用默认樱花粉 */
    }
  }

  doc.addEventListener('sakura:theme', readColor);

  /* ------------------------------ 花瓣状态 ------------------------------ */
  function makePetal(randomY) {
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : -20,
      r: 3.5 + Math.random() * 4.5,
      sway: 10 + Math.random() * 26,      // 左右摆幅(px)
      swayFreq: 0.5 + Math.random() * 0.9, // 摆动频率
      phase: Math.random() * Math.PI * 2,
      speed: 16 + Math.random() * 26,      // 下落速度(px/s)
      drift: (Math.random() - 0.5) * 8,    // 固定的横向漂移
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.1,   // 自转(弧度/s)
      t: 0,
      alpha: 0.18 + Math.random() * 0.32
    };
  }

  /** 屏幕越宽花瓣越多，但封顶，避免大屏上糊满 */
  function targetCount() {
    return Math.min(26, Math.max(8, Math.round(W / 72)));
  }

  function syncCount() {
    var want = targetCount();
    while (petals.length < want) petals.push(makePetal(true));
    while (petals.length > want) petals.pop();
  }
  /* ------------------------------ 绘制 ------------------------------ */
  /** 一片花瓣：两段二次贝塞尔拼出的梭形 */
  function drawPetal(p, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(0, -p.r);
    ctx.quadraticCurveTo(p.r * 0.85, -p.r * 0.25, 0, p.r);
    ctx.quadraticCurveTo(-p.r * 0.85, -p.r * 0.25, 0, -p.r);
    ctx.fill();

    ctx.restore();
  }

  function step(now) {
    // 首帧 / 从后台切回来时没有上一帧时间，先跳过一帧
    if (!last) {
      last = now;
      raf = window.requestAnimationFrame(step);
      return;
    }

    // 限幅：标签页切回来时 dt 可能是好几秒，不加限制花瓣会瞬移
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];

      p.t += dt;
      p.y += p.speed * dt;
      p.rot += p.spin * dt;

      var x = p.x + p.drift * p.t + Math.sin(p.t * p.swayFreq + p.phase) * p.sway;

      // 飘出下边界就换个位置从顶上重新来
      if (p.y - p.r > H) {
        petals[i] = makePetal(false);
        continue;
      }

      drawPetal(p, x, p.y);
    }

    raf = window.requestAnimationFrame(step);
  }

  function start() {
    if (raf === null) raf = window.requestAnimationFrame(step);
  }

  function stop() {
    if (raf !== null) {
      window.cancelAnimationFrame(raf);
      raf = null;
      last = 0;
    }
  }

  /* ------------------------------ 尺寸 ------------------------------ */
  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);

    // 之后都按 CSS 像素作图，高分屏靠这个缩放搞定
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    petals.forEach(function (p) {
      p.x = Math.min(p.x, W);
    });
    syncCount();
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 180);
  });

  // 切后台就停，别占着 CPU
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) stop();
    else start();
  });

  readColor();
  resize();
  start();
})();