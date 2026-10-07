(function () {
  var doc = document.documentElement;
  doc.classList.add('js');
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = motionQuery.matches;
  var forceStacked = /[?&]state=(stacked|final)/.test(location.search);

  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Header ---------- */
  var header = document.querySelector('[data-header]');
  var hero = document.querySelector('.hero');
  var lastY = window.scrollY;
  function onHeader() {
    var y = window.scrollY;
    var limit = hero ? hero.offsetHeight - 90 : 40;
    header.classList.toggle('is-scrolled', y > limit);
    if (y > lastY + 4 && y > limit + 200) header.classList.add('is-hidden');
    if (y < lastY - 4 || y < limit) header.classList.remove('is-hidden');
    lastY = y;
  }
  header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });

  /* ---------- Hero video slot ---------- */
  var heroVideo = document.querySelector('[data-hero-video]');
  if (heroVideo) {
    var hasSource = heroVideo.querySelector('source[src]:not([src=""])') || heroVideo.getAttribute('src');
    if (!hasSource || reduced) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
      heroVideo.hidden = true;
    } else {
      heroVideo.load();
      var p = heroVideo.play();
      if (p && p.then) p.then(function () { heroVideo.classList.add('is-playing'); }).catch(function () { heroVideo.hidden = true; });
    }
    motionQuery.addEventListener && motionQuery.addEventListener('change', function (e) {
      if (e.matches) { heroVideo.pause(); heroVideo.hidden = true; }
    });
  }

  /* ---------- Reveals and wipes ----------
     A wipe is clipped to zero area before it reveals, so it is checked against
     its parent's position on scroll instead of with an IntersectionObserver. */
  var revealEls = $all('.reveal, .wipe');
  var pendingWipes = [];
  function onWipes() {
    if (!pendingWipes.length) return;
    var vh = window.innerHeight;
    pendingWipes = pendingWipes.filter(function (w) {
      var r = w.parentElement.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) { w.classList.add('is-in'); return false; }
      return true;
    });
  }
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var wipeHosts = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (wipeHosts.has(e.target)) {
          wipeHosts.get(e.target).forEach(function (w) { w.classList.add('is-in'); });
          pendingWipes = pendingWipes.filter(function (w) { return wipeHosts.get(e.target).indexOf(w) < 0; });
        } else {
          e.target.classList.add('is-in');
        }
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealEls.forEach(function (el) {
      if (el.classList.contains('wipe')) {
        var host = el.parentElement;
        if (!wipeHosts.has(host)) { wipeHosts.set(host, []); io.observe(host); }
        wipeHosts.get(host).push(el);
        pendingWipes.push(el);
        return;
      }
      var idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(idx, 5) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* ---------- Parallax (uses the independent `translate` property so it never fights reveal transforms) ---------- */
  var parallaxEls = $all('[data-parallax]');
  function onParallax() {
    if (reduced) return;
    var vh = window.innerHeight;
    var mobile = window.innerWidth <= 900;
    parallaxEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var f = parseFloat(el.getAttribute('data-parallax')) * (mobile ? .5 : 1);
      var offset = (r.top + r.height / 2 - vh / 2) * -f;
      el.style.translate = '0 ' + offset.toFixed(1) + 'px';
    });
  }

  /* ---------- Rails (decisions, team): [data-rail="id"] with matching prev, next and bar ---------- */
  var railUpdates = [];
  $all('[data-rail]').forEach(function (rail) {
    var id = rail.getAttribute('data-rail');
    var prev = document.querySelector('[data-rail-prev="' + id + '"]');
    var next = document.querySelector('[data-rail-next="' + id + '"]');
    var bar = document.querySelector('[data-rail-bar="' + id + '"]');
    var track = rail.querySelector('.rail-track');
    function step() {
      var item = track.firstElementChild;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return item.offsetWidth + gap;
    }
    function update() {
      var max = rail.scrollWidth - rail.clientWidth;
      var ratio = rail.clientWidth / rail.scrollWidth;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
      bar.style.left = (max > 0 ? (rail.scrollLeft / max) * (1 - ratio) * 100 : 0).toFixed(2) + '%';
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max - 2;
    }
    prev.addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' }); });
    rail.addEventListener('keydown', function (e) {
      if (e.target !== rail) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
    rail.addEventListener('scroll', update, { passive: true });
    update();
    railUpdates.push(update);
  });

  /* ---------- Sheets: build the five mark fragments ----------
     The mark lives in [data-mark-source]. Either:
       a) five <path data-piece> elements, one per sheet in order, or
       b) one path with data-split="5", cut here into five equal lengths.
          The path may hold several subpaths (one per letter); the cut runs
          across their combined length, so a fragment can span two letters.
     An optional [data-accent] element is added to the last sheet. */
  var section = document.getElementById('pieces');
  var stage = document.querySelector('[data-stage]');
  var sheets = stage ? $all('.sheet', stage) : [];
  var source = document.querySelector('[data-mark-source]');
  var NS = 'http://www.w3.org/2000/svg';

  function buildMark() {
    if (!source || !sheets.length) return;
    var slots = sheets.map(function (s) { return s.querySelector('[data-slot]'); });
    var pieces = $all('[data-piece]', source);
    var accent = source.querySelector('[data-accent]');
    if (pieces.length) {
      pieces.forEach(function (piece, i) {
        if (!slots[i]) return;
        var c = piece.cloneNode(true);
        c.removeAttribute('data-piece');
        c.classList.add('piece');
        slots[i].appendChild(c);
      });
    } else {
      var whole = source.querySelector('[data-split]');
      var subpaths = whole.getAttribute('d').trim().split(/(?=[Mm])/);
      var probe = document.createElementNS(NS, 'path');
      source.appendChild(probe);
      var lens = subpaths.map(function (d) { probe.setAttribute('d', d); return probe.getTotalLength(); });
      source.removeChild(probe);
      var total = lens.reduce(function (a, b) { return a + b; }, 0);
      var seg = total / slots.length;
      slots.forEach(function (slot, i) {
        var from = i * seg, to = from + seg, start = 0;
        subpaths.forEach(function (d, j) {
          var s = Math.max(from, start), e = Math.min(to, start + lens[j]);
          if (e - s > 0.5) {
            var c = document.createElementNS(NS, 'path');
            c.setAttribute('d', d);
            c.setAttribute('class', 'piece');
            c.style.strokeDasharray = (e - s + 0.6).toFixed(2) + ' ' + (lens[j] * 2).toFixed(2);
            c.style.strokeDashoffset = (start - s).toFixed(2);
            slot.appendChild(c);
          }
          start += lens[j];
        });
      });
    }
    if (accent) {
      var a = accent.cloneNode(true);
      a.removeAttribute('data-accent');
      a.setAttribute('class', 'accent');
      slots[slots.length - 1].appendChild(a);
    }
  }

  var rot = [-3, 2, -1, 2.4, -2];
  var lift = [14, -12, 4, -18, 8];
  function layout(p) {
    var mobile = window.innerWidth <= 900;
    var w = sheets[0].offsetWidth;
    var spread = mobile ? w * 0.04 : w * 0.56;
    var e = ease(p);
    var joined = clamp((p - 0.88) / 0.12);
    sheets.forEach(function (s, i) {
      var k = 1 - e;
      var x = (i - 2) * spread * k;
      var y = (mobile ? Math.abs(i - 2) * 8 : lift[i]) * k;
      var r = (mobile ? (i - 2) * 1.6 : rot[i]) * k;
      s.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)';
      s.style.setProperty('--p', e.toFixed(3));
    });
    section.style.setProperty('--joined', joined.toFixed(3));
  }
  function sheetProgress() {
    if (reduced || forceStacked) return 1;
    var r = stage.getBoundingClientRect();
    var vh = window.innerHeight;
    return clamp((vh * 0.72 - r.top) / (vh * 0.5));
  }
  buildMark();

  /* ---------- How to begin: a line drawn through the steps on scroll ----------
     The line follows the staircase from dot to dot. A soft cobalt pulse travels
     the drawn part and lights each marker as it arrives. Static captures add
     .is-in to [data-draw], which shows the finished state. */
  var stairWrap = document.querySelector('[data-stair]');
  var stairPaint = null;
  if (stairWrap) (function () {
    var track = stairWrap.querySelector('.stair-track');
    var drawn = stairWrap.querySelector('.stair-drawn');
    var pulse = stairWrap.querySelector('.stair-pulse');
    var steps = $all('.step', stairWrap);
    var segs = [], stops = [], total = 0, cur = 0, running = false, t0 = performance.now();

    function offsetWithin(el) {
      var x = 0, y = 0;
      while (el && el !== stairWrap) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return { x: x, y: y };
    }
    function measure() {
      var pts = steps.map(function (s) {
        var dot = s.querySelector('.step-dot');
        var o = offsetWithin(dot), so = offsetWithin(s);
        return { x: o.x + dot.offsetWidth / 2, y: o.y + dot.offsetHeight / 2, bottom: so.y + s.offsetHeight };
      });
      var d = 'M' + pts[0].x + ' ' + pts[0].y;
      var x = pts[0].x, y = pts[0].y;
      segs = []; stops = [0]; total = 0;
      function to(nx, ny) {
        var len = Math.abs(nx - x) + Math.abs(ny - y);
        segs.push({ y0: y, y1: ny, len: len });
        total += len; x = nx; y = ny;
        d += ' L' + nx + ' ' + ny;
      }
      for (var i = 1; i < pts.length; i++) {
        to(x, pts[i - 1].bottom);
        to(pts[i].x, y);
        to(x, pts[i].y);
        stops.push(total);
      }
      track.setAttribute('d', d);
      drawn.setAttribute('d', d);
      drawn.style.strokeDasharray = total + ' ' + total;
      cur = Math.min(cur, total);
      paint(performance.now());
    }
    function lengthAtY(t) {
      var acc = 0;
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (s.y0 === s.y1) { if (t >= s.y0) { acc += s.len; continue; } break; }
        if (t >= s.y1) { acc += s.len; continue; }
        if (t > s.y0) acc += t - s.y0;
        break;
      }
      return acc;
    }
    function finished() { return reduced || forceStacked || stairWrap.classList.contains('is-in'); }
    function paint(now) {
      var target = finished() ? total : lengthAtY(window.innerHeight * 0.62 - stairWrap.getBoundingClientRect().top);
      cur = finished() ? total : cur + (target - cur) * 0.08;
      if (Math.abs(target - cur) < 0.5) cur = target;
      drawn.style.strokeDashoffset = (total - cur).toFixed(1);
      var pos = -1;
      if (!reduced && cur > 4 && total > 0) {
        var cycle = total / 0.2 + 1400;
        pos = ((now - t0) % cycle) * 0.2;
      }
      if (pos >= 0 && pos <= cur) {
        var pt = track.getPointAtLength(pos);
        pulse.setAttribute('cx', pt.x.toFixed(1));
        pulse.setAttribute('cy', pt.y.toFixed(1));
        pulse.style.opacity = (0.75 * Math.min(1, pos / 40 + 0.4, (cur - pos) / 40 + 0.2)).toFixed(2);
      } else {
        pulse.style.opacity = 0;
      }
      steps.forEach(function (s, i) {
        s.classList.toggle('is-lit', cur >= stops[i] - 2);
        s.classList.toggle('is-ping', pos >= 0 && Math.abs(pos - stops[i]) < 26);
      });
    }
    function tick(now) {
      if (!running) return;
      paint(now);
      requestAnimationFrame(tick);
    }
    measure();
    stairPaint = function () { if (!running) paint(performance.now()); };
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if (reduced) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; requestAnimationFrame(tick); }
        if (!vis) running = false;
      }, { rootMargin: '120px 0px' }).observe(stairWrap);
    } else {
      running = true; requestAnimationFrame(tick);
    }
  })();

  /* ---------- Signs: the item at the centre of the screen is active ---------- */
  var signs = $all('[data-signs] li');
  if (signs.length && 'IntersectionObserver' in window && !reduced) {
    signs[0].classList.add('is-active');
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          signs.forEach(function (li) { li.classList.toggle('is-active', li === e.target); });
        }
      });
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    signs.forEach(function (li) { so.observe(li); });
  }

  /* ---------- Lightbox for story and team videos ---------- */
  var dialog = document.querySelector('[data-lightbox]');
  var stageEl = dialog.querySelector('[data-lightbox-stage]');
  var titleEl = dialog.querySelector('#lightbox-title');
  var closeBtn = dialog.querySelector('[data-lightbox-close]');
  var opener = null;

  function openVideo(btn) {
    opener = btn;
    var d = btn.dataset;
    stageEl.innerHTML = '';
    titleEl.textContent = d.videoTitle || 'Video';
    if (d.videoEmbed) {
      var f = document.createElement('iframe');
      f.src = d.videoEmbed;
      f.title = d.videoTitle || 'Video';
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.allowFullscreen = true;
      stageEl.appendChild(f);
    } else if (d.videoSrc) {
      var v = document.createElement('video');
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      var s = document.createElement('source');
      s.src = d.videoSrc;
      s.type = 'video/mp4';
      v.appendChild(s);
      var t = document.createElement('track');
      t.kind = 'captions';
      t.srclang = 'en';
      t.label = 'English';
      if (d.videoCaptions) { t.src = d.videoCaptions; t.default = true; }
      v.appendChild(t);
      stageEl.appendChild(v);
    } else {
      stageEl.innerHTML = '<div class="lightbox-empty"><p>The film will play here.</p><p><span class="ph ph-dark">[Video placeholder: add data-video-src or data-video-embed]</span></p></div>';
    }
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    closeBtn.focus();
  }
  function closeVideo() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener('close', function () {
    stageEl.innerHTML = '';
    if (opener) opener.focus();
  });
  closeBtn.addEventListener('click', closeVideo);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeVideo(); });
  dialog.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $all('button, [href], iframe, video[controls], [tabindex]:not([tabindex="-1"])', dialog);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $all('[data-video-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { openVideo(btn); });
  });

  /* ---------- Team: silent preview on hover (mouse) or tap (touch) ---------- */
  $all('[data-member]').forEach(function (m) {
    var vid = m.querySelector('.portrait-preview');
    var portrait = m.querySelector('.portrait');
    var src = m.getAttribute('data-preview');
    function start() {
      m.classList.add('is-previewing');
      if (!src || reduced) return;
      if (!vid.src) vid.src = src;
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    function stop() {
      m.classList.remove('is-previewing');
      if (vid && !vid.paused) vid.pause();
    }
    m.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') start(); });
    m.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') stop(); });
    portrait.addEventListener('click', function () {
      m.classList.contains('is-previewing') ? stop() : start();
    });
    m.addEventListener('focusin', start);
    m.addEventListener('focusout', stop);
  });

  /* ---------- Locations: an office card and its map pin and line highlight together ---------- */
  var locations = document.querySelector('[data-locations]');
  if (locations) {
    var linked = $all('[data-office], [data-office-line]', locations);
    var setOffice = function (id) {
      linked.forEach(function (el) {
        el.classList.toggle('is-active', id !== null && (el.getAttribute('data-office') || el.getAttribute('data-office-line')) === id);
      });
    };
    $all('[data-office]', locations).forEach(function (el) {
      var id = el.getAttribute('data-office');
      el.addEventListener('pointerenter', function () { setOffice(id); });
      el.addEventListener('pointerleave', function () { setOffice(null); });
      el.addEventListener('focusin', function () { setOffice(id); });
      el.addEventListener('focusout', function () { setOffice(null); });
    });
  }

  /* ---------- Planning comes first: the joined bar comes apart ----------
     --p runs 0 to 1 while the bar's centre moves from 60% to 44% of the screen
     height, so the whole block is in view as it plays. On narrow screens the
     steps are stacked, so the bar is shown finished and each part reveals as it
     enters. Static captures add .is-in to [data-draw], which shows the finished state. */
  var splitBar = document.querySelector('[data-split-bar]');
  var narrow = window.matchMedia('(max-width: 900px)');
  function onSplit() {
    if (!splitBar) return;
    var p;
    if (reduced || forceStacked || narrow.matches || splitBar.classList.contains('is-in')) p = 1;
    else {
      var r = splitBar.getBoundingClientRect();
      var vh = window.innerHeight;
      p = clamp((vh * 0.60 - (r.top + r.height / 2)) / (vh * 0.16));
    }
    splitBar.style.setProperty('--p', p.toFixed(3));
  }

  /* ---------- The pause: the timeline plays with the scroll ----------
     On wide screens --q runs 0 to 1 while the timeline's centre moves from 69%
     to 45% of the screen height: line, milestone, pause panel, then step two.
     Narrow screens, reduced motion and static captures keep the one-shot reveal. */
  var pauseLine = document.querySelector('.pause-line');
  function onPause() {
    if (!pauseLine) return;
    var scrub = !(reduced || forceStacked || narrow.matches);
    pauseLine.classList.toggle('is-scrub', scrub);
    if (!scrub) return;
    var r = pauseLine.getBoundingClientRect();
    var vh = window.innerHeight;
    pauseLine.style.setProperty('--q', clamp((vh * 0.69 - (r.top + r.height / 2)) / (vh * 0.24)).toFixed(3));
  }

  /* ---------- Frame loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    onHeader();
    onWipes();
    onParallax();
    onSplit();
    onPause();
    if (sheets.length) layout(sheetProgress());
    if (stairPaint) stairPaint();
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { request(); railUpdates.forEach(function (u) { u(); }); });
  frame();
})();
