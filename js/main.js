/* ==========================================================================
   sakura 主题交互
   深浅色切换 / 返回顶部 / 阅读进度 / 图片灯箱 / 图片网格 /
   目录高亮 / 代码复制 / 入场动画
   全部是渐进增强：脚本挂了页面依然可读。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var THEME_KEY = 'sakura-theme';

  // 动效开关，由 head 里的内联脚本注入（见 layout/_partial/head.ejs）
  var MOTION = window.SAKURA_MOTION || {};

  /** 某个动效有没有开：没配置过就当作开 */
  function motionOn(name) {
    return MOTION[name] !== false;
  }

  /** 统一的滚动回调（rAF 节流） */
  function onScroll(fn) {
    var queued = false;
    function run() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        fn();
      });
    }
    window.addEventListener('scroll', run, { passive: true });
    window.addEventListener('resize', run);
  }

  /* ------------------------------ 深浅色 ------------------------------ */
  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    var toggle = doc.getElementById('theme-toggle');
    if (toggle) toggle.textContent = theme === 'light' ? '☀️' : '🌙';

    // 通知别处（比如背景花瓣）重新读取主题色
    try {
      doc.dispatchEvent(new CustomEvent('sakura:theme', { detail: { theme: theme } }));
    } catch (e) {
      /* 老浏览器不支持 CustomEvent 就跳过 */
    }

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {
        /* 无痕模式下忽略 */
      }
    }
  }

  function initTheme() {
    // 首屏主题已由 head 里的内联脚本定好，这里只负责同步按钮图标
    applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

    var toggle = doc.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
    });
  }

  /* --------------------------- 顶栏 / 返回顶部 --------------------------- */
  function initHeader() {
    var header = doc.getElementById('site-header');
    if (!header) return;
    onScroll(function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    });
  }

  function initBackToTop() {
    var btn = doc.getElementById('back-to-top');
    if (!btn) return;

    function update() {
      btn.classList.toggle('is-visible', window.scrollY > 420);
    }

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    onScroll(update);
    update();
  }

  /* ---------------------------- 阅读进度条 ---------------------------- */
  function initProgress() {
    var bar = doc.getElementById('progress-bar');
    var article = doc.querySelector('.post');
    if (!bar || !article) return;

    function update() {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var done = -rect.top;
      var pct = total > 0 ? (done / total) * 100 : (done > 0 ? 100 : 0);
      bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }

    onScroll(update);
    update();
  }
  /* ------------------------------ 图片 ------------------------------ */
  function getPostContent() {
    return doc.querySelector('.post-content');
  }

  /** 图片加载失败时，换几个常见后缀再试（修 xxx.pn 这类写错的链接） */
  function handleImageError(img) {
    if (img.__sakuraBroken) return;

    if (!img.__sakuraCandidates) {
      var src = img.getAttribute('src') || '';
      var match = /^(.*)\.[a-z0-9]+$/i.exec(src);
      img.__sakuraCandidates = match
        ? ['.png', '.jpg', '.jpeg', '.webp', '.gif']
            .map(function (ext) {
              return match[1] + ext;
            })
            .filter(function (candidate) {
              return candidate !== src;
            })
        : [];
    }

    if (!img.__sakuraCandidates.length) {
      img.__sakuraBroken = true;
      img.classList.add('img-broken');
      return;
    }

    img.src = img.__sakuraCandidates.shift();
  }

  function initImages() {
    var content = getPostContent();
    if (!content) return;

    Array.prototype.forEach.call(content.querySelectorAll('img'), function (img) {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.classList.add('zoomable');
      img.addEventListener('error', function () {
        handleImageError(img);
      });
    });
  }

  /** 把连续的「只有一张图」的段落合并成图片网格 */
  function initGallery() {
    var content = getPostContent();
    if (!content) return;

    var run = [];
    var children = Array.prototype.slice.call(content.children);

    function flush() {
      if (run.length >= 2) {
        var wrap = doc.createElement('div');
        wrap.className = 'gallery';
        wrap.setAttribute('data-count', String(run.length));
        run[0].parentNode.insertBefore(wrap, run[0]);

        run.forEach(function (paragraph) {
          var figure = doc.createElement('figure');
          figure.className = 'gallery-item';
          figure.appendChild(paragraph.firstElementChild);
          wrap.appendChild(figure);
          paragraph.parentNode.removeChild(paragraph);
        });
      } else {
        run.forEach(function (paragraph) {
          paragraph.classList.add('post-figure');
        });
      }
      run = [];
    }

    children.forEach(function (element) {
      var isSoloImage =
        element.tagName === 'P' &&
        element.children.length === 1 &&
        element.firstElementChild.tagName === 'IMG' &&
        !element.textContent.trim();

      if (isSoloImage) run.push(element);
      else flush();
    });

    flush();
  }

  /** 宽表格可以横向滚动 */
  function initTables() {
    var content = getPostContent();
    if (!content) return;

    Array.prototype.forEach.call(content.querySelectorAll('table'), function (table) {
      if (table.closest('.highlight') || table.closest('.table-wrap')) return;

      var wrap = doc.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }
  /* ------------------------------ 灯箱 ------------------------------ */
  function initLightbox() {
    var box = doc.getElementById('lightbox');
    if (!box) return;

    if (!motionOn('lightbox_zoom')) box.classList.add('lb-no-zoom');

    if (!motionOn('lightbox_zoom')) box.classList.add('lb-no-zoom');

    // 正文里的图 + 相册里的图，共用同一个灯箱
    var images = Array.prototype.slice.call(
      doc.querySelectorAll('.post-content img, .photo-grid img')
    );
    if (!images.length) return;

var stage = box.querySelector('.lb-stage');
    var stageImg = box.querySelector('.lb-img');
    var caption = box.querySelector('.lb-caption');
    var counter = box.querySelector('.lb-counter');
    var btnPrev = box.querySelector('.lb-prev');
    var btnNext = box.querySelector('.lb-next');
    var btnClose = box.querySelector('.lb-close');
    var index = 0;
    var lastFocus = null;

    function show(i) {
      index = (i + images.length) % images.length;
      var img = images[index];
      var multiple = images.length > 1;

      stageImg.src = img.currentSrc || img.src;
      stageImg.alt = img.alt || '';
      caption.textContent = img.alt || '';
      counter.textContent = index + 1 + ' / ' + images.length;
      counter.hidden = !multiple;
      btnPrev.hidden = !multiple;
      btnNext.hidden = !multiple;
    }

    function open(i, origin) {
      lastFocus = doc.activeElement;
      show(i);
      box.hidden = false;
      doc.body.classList.add('lb-open');

      // 把缩放中心对准你点的那个缩略图，灯箱就像是「从那里长出来」的
      if (stage && origin && origin.getBoundingClientRect) {
        var rect = origin.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        stage.style.transformOrigin =
          (cx / window.innerWidth) * 100 + '% ' + (cy / window.innerHeight) * 100 + '%';
      }

      window.requestAnimationFrame(function () {
        box.classList.add('open');
      });
      btnClose.focus();
    }

    function close() {
      box.classList.remove('open');
      doc.body.classList.remove('lb-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      window.setTimeout(function () {
        box.hidden = true;
        stageImg.removeAttribute('src');
      }, 200);
    }

    images.forEach(function (img, i) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute(
        'aria-label',
        '放大查看图片' + (images.length > 1 ? '（第 ' + (i + 1) + ' / ' + images.length + ' 张）' : '')
      );

      img.addEventListener('click', function () {
        open(i, img);
      });

      img.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(i, img);
        }
      });
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () {
      show(index - 1);
    });
    btnNext.addEventListener('click', function () {
      show(index + 1);
    });
    stageImg.addEventListener('click', close);

    var backdrop = box.querySelector('.lb-backdrop');
    if (backdrop) backdrop.addEventListener('click', close);

    doc.addEventListener('keydown', function (event) {
      if (box.hidden) return;
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') show(index - 1);
      else if (event.key === 'ArrowRight') show(index + 1);
    });

    // 手机左右滑动切换
    var startX = null;
    box.addEventListener(
      'touchstart',
      function (event) {
        startX = event.touches[0].clientX;
      },
      { passive: true }
    );
    box.addEventListener('touchend', function (event) {
      if (startX === null) return;
      var dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }
  /* --------------------------- 目录跟随高亮 --------------------------- */
  function initTocSpy() {
    var links = doc.querySelectorAll('.toc-link');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var targets = [];

    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#') return;

      var id = href.slice(1);
      var target = doc.getElementById(id);
      if (!target) {
        try {
          target = doc.getElementById(decodeURIComponent(id));
        } catch (e) {
          target = null;
        }
      }
      if (!target) return;

      if (!map[target.id]) {
        map[target.id] = [];
        targets.push(target);
      }
      map[target.id].push(link);
    });

    if (!targets.length) return;

    var active = [];

    function setActive(nextLinks) {
      if (active.join() === nextLinks.join()) return;
      active.forEach(function (link) {
        link.classList.remove('is-active');
      });
      active = nextLinks;
      active.forEach(function (link) {
        link.classList.add('is-active');
        try {
          link.scrollIntoView({ block: 'nearest' });
        } catch (e) {
          /* 老浏览器忽略即可 */
        }
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(map[entry.target.id] || []);
        });
      },
      { rootMargin: '-84px 0px -68% 0px', threshold: 0 }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  /* ---------------------------- 代码复制 ---------------------------- */
  function legacyCopy(text) {
    var area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    doc.body.appendChild(area);
    area.select();

    var ok = false;
    try {
      ok = doc.execCommand('copy');
    } catch (e) {
      ok = false;
    }

    doc.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function initCodeCopy() {
    var content = getPostContent();
    if (!content || !navigator) return;

    Array.prototype.forEach.call(
      content.querySelectorAll('figure.highlight, pre'),
      function (block) {
        // 代码块内部的 pre 由外层 figure 统一处理，避免加两个按钮
        if (block.tagName === 'PRE' && block.closest('figure.highlight')) return;
        if (block.__sakuraCopy) return;
        block.__sakuraCopy = true;

        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        btn.textContent = '复制';

        btn.addEventListener('click', function () {
          var code = block.querySelector('code') || block.querySelector('pre');
          copyText(code ? code.innerText : '').then(function (ok) {
            btn.textContent = ok ? '已复制' : '复制失败';
            btn.classList.add('is-done');
            window.setTimeout(function () {
              btn.textContent = '复制';
              btn.classList.remove('is-done');
            }, 1600);
          });
        });

        block.appendChild(btn);
      }
    );
  }
  /* ---------------------------- 入场动画 ---------------------------- */
  function initReveal() {
    if (!motionOn('reveal')) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var items = doc.querySelectorAll(
      '.archive-hero, .photo-hero, .card, .photo-card, .panel, .photo-empty'
    );
    if (!items.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var el = entry.target;
          el.classList.add('is-in');
          observer.unobserve(el);

          // 动画结束后摘掉标记类，否则 .reveal 的 transform 会盖住卡片 hover 的位移
          window.setTimeout(function () {
            el.classList.remove('reveal', 'is-in');
            el.style.transitionDelay = '';
          }, 760);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.02 }
    );

    Array.prototype.forEach.call(items, function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i % 5, 4) * 50 + 'ms';
      observer.observe(el);
    });
  }

/* ------------------ 图片加载：骨架微光 + 载入淡出 ------------------ */
  function initImageLoading() {
    if (!motionOn('image_fade')) return;

    var nodes = doc.querySelectorAll('img[loading="lazy"], .post-cover img');

    Array.prototype.forEach.call(nodes, function (img) {
      if (img.__sakuraLoaded) return;
      img.__sakuraLoaded = true;

      function done() {
        img.classList.remove('is-loading');
        img.classList.add('is-loaded');
      }

      // 已经在缓存里 / 首屏已经加载完的，不需要挂骨架
      if (img.complete && img.naturalWidth) {
        done();
        return;
      }

      img.classList.add('is-loading');
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  /* ------------------ 卡片上跟随鼠标的柔光 ------------------ */
  function initSpotlight() {
    if (!motionOn('spotlight')) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

    Array.prototype.forEach.call(doc.querySelectorAll('.card'), function (el) {
      if (el.__sakuraSpot) return;
      el.__sakuraSpot = true;
      el.classList.add('spotlight');

      el.addEventListener(
        'pointermove',
        function (event) {
          var rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          el.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width) * 100 + '%');
          el.style.setProperty('--my', ((event.clientY - rect.top) / rect.height) * 100 + '%');
        },
        { passive: true }
      );

      el.addEventListener('pointerleave', function () {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }

  /* ------------------ 站内跳转时淡出 ------------------ */
  function initPageFade() {
    if (!motionOn('page_fade')) return;
    // has-motion 是 head 里按「配置 + 系统偏好」决定的；没有它就别拦跳转，
    // 否则白白多等 170ms 却看不到任何淡出
    if (!root.classList.contains('has-motion')) return;

    // 从 bfcache 返回时要把淡出状态摘掉，否则页面是空的
    window.addEventListener('pageshow', function () {
      doc.body.classList.remove('is-leaving');
    });

    doc.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      var link = event.target && event.target.closest ? event.target.closest('a') : null;
      if (!link) return;

      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download') || link.getAttribute('rel') === 'external') return;
      if (link.host !== window.location.host) return;

      var url = new URL(link.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // 同页锚点 / 刷新，不用淡出
      }

      event.preventDefault();
      doc.body.classList.add('is-leaving');

      window.setTimeout(function () {
        window.location.href = url.href;
      }, 170);
    });
  }

  /* ------------------ 目录：按标题逐级折叠 ------------------ */
  function initTocTree() {
    var tocs = doc.querySelectorAll('.toc');
    if (!tocs.length) return;

    var KEY = 'sakura-toc-collapsed';
    var collapsed = {};

    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) {
        saved.forEach(function (k) {
          collapsed[k] = true;
        });
      }
    } catch (e) {
      collapsed = {};
    }

    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(Object.keys(collapsed)));
      } catch (e) {
        /* localStorage 不可用就只是不记忆 */
      }
    }

    /** 设置某个标题的折叠状态；窄屏折叠目录和宽屏侧栏两处一起同步 */
    function setKey(key, on) {
      if (on) collapsed[key] = true;
      else delete collapsed[key];

      Array.prototype.forEach.call(doc.querySelectorAll('.toc-caret'), function (caret) {
        if (caret.getAttribute('data-toc-key') !== key) return;
        var item = caret.parentNode;
        item.classList.toggle('is-collapsed', on);
        caret.setAttribute('aria-expanded', on ? 'false' : 'true');
        caret.setAttribute('aria-label', on ? '展开该节' : '折叠该节');
        /* 箭头由 CSS 的 ::before 绘制，这里只负责状态 */
      });
    }

    // 1. 给「有子目录」的条目插入折叠箭头
    Array.prototype.forEach.call(tocs, function (toc) {
      Array.prototype.forEach.call(toc.querySelectorAll('li.toc-item'), function (item) {
        var child = null;
        var link = null;

        Array.prototype.forEach.call(item.children, function (el) {
          if (el.classList && el.classList.contains('toc-child')) child = el;
          if (el.tagName === 'A' && el.classList.contains('toc-link')) link = el;
        });

        if (!child || !link) return;

        var caret = doc.createElement('button');
        caret.type = 'button';
        caret.className = 'toc-caret';
        caret.setAttribute('data-toc-key', link.getAttribute('href') || '');
        // 先给个默认展开态，后面 setKey 只会覆盖被折叠的那些；
        // 不写这两行的话，默认展开的条目对读屏软件就是「没有状态」
        caret.setAttribute('aria-expanded', 'true');
        caret.setAttribute('aria-label', '折叠该节');
        item.insertBefore(caret, child);
      });
    });

    // 2. 清掉文章结构变了之后已经不存在的标题
    var valid = {};
    Array.prototype.forEach.call(doc.querySelectorAll('.toc-caret'), function (caret) {
      valid[caret.getAttribute('data-toc-key')] = true;
    });
    Object.keys(collapsed).forEach(function (key) {
      if (!valid[key]) delete collapsed[key];
    });

    // 3. 套用上次的状态
    Object.keys(collapsed).forEach(function (key) {
      setKey(key, true);
    });
    save();

    // 4. 绑定点击
    Array.prototype.forEach.call(doc.querySelectorAll('.toc-caret'), function (caret) {
      caret.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var item = caret.parentNode;
        setKey(caret.getAttribute('data-toc-key'), !item.classList.contains('is-collapsed'));
        save();
      });
    });
  }
  /* ------------------------------ 启动 ------------------------------ */
  function boot() {
    initTheme();
    initHeader();
    initBackToTop();
    initProgress();
    initImages();
    initImageLoading();
    initGallery();
    initTables();
    initLightbox();
    initTocSpy();
    initTocTree();
    initCodeCopy();
    initSpotlight();
    initReveal();
    initPageFade();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();