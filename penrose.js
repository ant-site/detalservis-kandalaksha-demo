/* Penrose Bloom: стеклянная мозаика Пенроуза «расцветает» от центра.
   Идея: 21st.dev / Penrose Glass Tile Logo. Здесь переписано на чистом canvas.
   <canvas class="pb" data-pb data-pb-hole="0.28" data-pb-size="46"> */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHI = (1 + Math.sqrt(5)) / 2;

  function rnd(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* Робинсон-треугольники: 0 – тонкий (36°), 1 – толстый (108°) */
  function subdivide(tris) {
    var out = [];
    tris.forEach(function (t) {
      var c = t.t, A = t.a, B = t.b, C = t.c;
      if (c === 0) {
        var P = { x: A.x + (B.x - A.x) / PHI, y: A.y + (B.y - A.y) / PHI };
        out.push({ t: 0, a: C, b: P, c: B }, { t: 1, a: P, b: C, c: A });
      } else {
        var Q = { x: B.x + (A.x - B.x) / PHI, y: B.y + (A.y - B.y) / PHI };
        var R = { x: B.x + (C.x - B.x) / PHI, y: B.y + (C.y - B.y) / PHI };
        out.push({ t: 1, a: R, b: C, c: A }, { t: 1, a: Q, b: R, c: B }, { t: 0, a: R, b: Q, c: A });
      }
    });
    return out;
  }

  function build(R, depth) {
    var tris = [];
    for (var i = 0; i < 10; i++) {
      var B = { x: Math.cos((2 * i - 1) * Math.PI / 10) * R, y: Math.sin((2 * i - 1) * Math.PI / 10) * R };
      var C = { x: Math.cos((2 * i + 1) * Math.PI / 10) * R, y: Math.sin((2 * i + 1) * Math.PI / 10) * R };
      if (i % 2 === 0) { var tmp = B; B = C; C = tmp; }
      tris.push({ t: 0, a: { x: 0, y: 0 }, b: B, c: C });
    }
    for (var d = 0; d < depth; d++) tris = subdivide(tris);
    /* склеиваем пары треугольников в ромбы: ключ – общая сторона b–c */
    var map = {}, rh = [];
    function key(p, q) { var a = p.x.toFixed(2) + ',' + p.y.toFixed(2), b = q.x.toFixed(2) + ',' + q.y.toFixed(2); return a < b ? a + '|' + b : b + '|' + a; }
    tris.forEach(function (t) {
      var k = t.t + ':' + key(t.b, t.c);
      if (map[k]) { var o = map[k]; delete map[k]; rh.push({ thin: t.t === 0, p: [t.a, t.b, o.a, t.c] }); }
      else map[k] = t;
    });
    return rh;
  }

  function Bloom(cv) {
    var ctx = cv.getContext('2d');
    var fx = parseFloat(cv.dataset.pbHx || '0.26'), fy = parseFloat(cv.dataset.pbHy || '0.4');
    var size = parseFloat(cv.dataset.pbSize || '46');
    var cA = cv.dataset.pbA || '#ff7a2f', cB = cv.dataset.pbB || '#3a2f26', cC = cv.dataset.pbC || '#8b6a4d';
    var w = 0, h = 0, dpr = 1, tiles = [], maxRing = 1, t0 = null, vis = true, raf = 0, mx = -1, my = -1, rev = 1;
    var delay = parseFloat(cv.dataset.pbDelay || '0');
    var raw = null, cache = {};

    function setup() {
      var r = cv.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr;
      var R = Math.hypot(w, h) * 0.62;
      var depth = 5, need = Math.hypot(w, h) * .56;
      /* ребро ромба на глубине 5 ≈ R*0.0295*k; подбираем R так, чтобы ребро ≈ size px */
      var scale = 0;
      for (depth = 5; depth <= 8; depth++) {
        if (!cache[depth]) cache[depth] = build(100, depth);
        var pr = cache[depth][0]; var edge = Math.hypot(pr.p[1].x - pr.p[0].x, pr.p[1].y - pr.p[0].y);
        scale = size / edge;
        if (100 * scale >= need) break;
      }
      raw = cache[Math.min(depth, 8)];
      var cx = w / 2, cy = h / 2, hx = w * (w < 700 ? Math.max(fx, .62) : fx), hy = h * fy;
      var rand = rnd(7);
      tiles = [];
      var mr = 0;
      raw.forEach(function (rr) {
        var pts = rr.p.map(function (p) { return { x: cx + p.x * scale, y: cy + p.y * scale }; });
        var mxp = 0, myp = 0; pts.forEach(function (p) { mxp += p.x / 4; myp += p.y / 4; });
        if (mxp < -size * 2 || mxp > w + size * 2 || myp < -size * 2 || myp > h + size * 2) return;
        var dx = (mxp - cx) / hx, dy = (myp - cy) / hy, d = Math.pow(Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3), 1 / 3) / (1 + .07 * Math.sin(10 * Math.atan2(dy, dx)));
        if (d < 1) return; /* дыра под контент */
        var ring = (d - 1);
        mr = Math.max(mr, ring);
        tiles.push({ pts: pts, cx: mxp, cy: myp, thin: rr.thin, ring: ring, g: rand(), glint: rand() < .1, j: rand() });
      });
      maxRing = mr || 1;
      tiles.forEach(function (t) { t.s = Math.min(1, t.ring / maxRing) * 1.55 + t.j * .35; });
      if (reduce) draw(99);
    }

    function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    var A = hex(cA), B = hex(cB), C = hex(cC);
    function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    function rgb(a, al) { return 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')'; }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var sweep = ((t * 0.16) % 2.4) - .7; /* световая полоса, проходит раз в ~15 с */
      for (var i = 0; i < tiles.length; i++) {
        var k = tiles[i];
        var st = (t - delay - k.s * .9);
        var p = Math.max(0, Math.min(1, st / .7));
        if (p <= 0) continue;
        var e = 1 - Math.pow(1 - p, 3);
        var sc = .55 + .45 * e;
        var pts = k.pts, cx = k.cx, cy = k.cy;
        ctx.beginPath();
        for (var j = 0; j < 4; j++) {
          var x = cx + (pts[j].x - cx) * sc * .94, y = cy + (pts[j].y - cy) * sc * .94;
          if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        /* стекло: основа + диагональный градиент */
        var base = k.thin ? mix(A, B, .12 + k.g * .22) : mix(B, C, k.g * .35);
        var lit = (Math.sin((cx / w + cy / h) * 5 - t * .6) + 1) * .5;
        var sw = Math.max(0, 1 - Math.abs((cx / w + (1 - cy / h) * .35) - sweep) * 5);
        var pointer = mx < 0 ? 0 : Math.max(0, 1 - Math.hypot(cx - mx, cy - my) / 170);
        var glow = Math.min(1, sw * .9 + pointer * .9 + lit * .08);
        var col = mix(base, k.thin ? [255, 226, 190] : [190, 160, 130], glow * (k.thin ? .75 : .35));
        var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[2].x, pts[2].y);
        g.addColorStop(0, rgb(mix(col, [255, 255, 255], .14), e));
        g.addColorStop(1, rgb(mix(col, [0, 0, 0], .32), e));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,236,214,' + (.16 + glow * .5) * e + ')';
        ctx.stroke();
        if (k.glint && p >= 1) {
          var ph = (Math.sin(t * 1.3 + k.j * 40) + 1) / 2;
          if (ph > .93) {
            var a = (ph - .93) / .07, r = size * .34 * a;
            ctx.strokeStyle = 'rgba(255,246,230,' + a + ')';
            ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
          }
        }
      }
    }

    function frame(ts) {
      raf = 0;
      if (t0 === null) t0 = ts;
      draw((ts - t0) / 1000);
      if (vis) raf = requestAnimationFrame(frame);
    }
    function run() { if (!raf && vis && !reduce) raf = requestAnimationFrame(frame); }

    setup();
    var ro = new ResizeObserver(function () { setup(); });
    ro.observe(cv);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) run(); }, { rootMargin: '100px' }).observe(cv);
    cv.parentElement.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; }, { passive: true });
    cv.parentElement.addEventListener('pointerleave', function () { mx = -1; });
    run();
    if (reduce) draw(99);
  }

  function init() { document.querySelectorAll('canvas[data-pb]').forEach(Bloom); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
