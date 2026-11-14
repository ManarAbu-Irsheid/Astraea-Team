/* ==========================================================================
   TerraTwin — cinema background for the inner pages.
   The same look as the cinematic home page (js/home-cinema.js), without
   three.js: deep #030409 space, thousands of twinkling tinted stars in
   depth layers, faint coloured nebula light, film grain, a soft vignette,
   and the stars drift with the mouse (parallax) like on the home page.
   Also adds the home page's ring cursor on desktop.
   Decoration only: behind all content, never clickable.
   ========================================================================== */
(function () {
  'use strict';
  if (document.getElementById('gl')) return;           // the home page has its own 3D scene
  if (document.querySelector('.tt-cinema-bg')) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const css = `
  html { background: #030409 !important; }
  body { background: transparent !important; }
  .space-living-background { display: none !important; }
  .tt-cinema-bg { position: fixed; inset: 0; z-index: -2; pointer-events: none; background: #030409; }
  .tt-cinema-bg canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .tt-cinema-vignette { position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,.55) 100%); }
  .tt-cinema-grain { position: fixed; inset: -50%; z-index: -1; pointer-events: none; opacity: .07; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: ttGrain 1.2s steps(6) infinite; }
  @keyframes ttGrain { 0%{transform:translate(0,0)} 25%{transform:translate(-3%,2%)} 50%{transform:translate(2%,-3%)} 75%{transform:translate(-2%,-1%)} 100%{transform:translate(0,0)} }
  .tt-cursor { position: fixed; z-index: 9999; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(238,241,246,.4); pointer-events: none; mix-blend-mode: difference;
    transition: width .4s cubic-bezier(.16,1,.3,1), height .4s cubic-bezier(.16,1,.3,1), margin .4s cubic-bezier(.16,1,.3,1), box-shadow .4s; }
  .tt-cursor i { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: #fff; }
  .tt-cursor.big { width: 70px; height: 70px; margin: -35px 0 0 -35px; box-shadow: inset 0 0 0 1px #e9c47e; }
  @media (prefers-reduced-motion: reduce) { .tt-cinema-grain { animation: none; } }
  @media print { .tt-cinema-bg, .tt-cinema-vignette, .tt-cinema-grain, .tt-cursor { display: none !important; } }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'tt-cinema-bg';
  wrap.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  wrap.appendChild(cv);
  // film grain + vignette: luxe.css already draws them; add ours only if it is missing
  if (!document.querySelector('link[href*="luxe.css"]')) {
    const vig = document.createElement('div'); vig.className = 'tt-cinema-vignette'; vig.setAttribute('aria-hidden', 'true');
    const grain = document.createElement('div'); grain.className = 'tt-cinema-grain'; grain.setAttribute('aria-hidden', 'true');
    document.body.prepend(grain);
    document.body.prepend(vig);
  }
  document.body.prepend(wrap);

  const ctx = cv.getContext('2d');
  const TINTS = [[255, 255, 255], [207, 228, 255], [255, 226, 194], [188, 210, 255]];
  // nebula: same colours as the home page, kept very faint (home is almost black)
  const NEB = [
    { c: [60, 90, 200], x: .28, y: .38, r: .55, o: .06, d: .02 },
    { c: [140, 60, 160], x: .74, y: .62, r: .6, o: .035, d: .03 },
    { c: [255, 120, 60], x: .82, y: .22, r: .42, o: .025, d: .015 },
    { c: [40, 140, 190], x: .14, y: .78, r: .5, o: .03, d: .025 }
  ];
  let W = 0, H = 0, DPR = 1, stars = [];

  function build() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round(Math.min(900, (W * H) / 1400));
    stars = [];
    for (let i = 0; i < n; i++) {
      const z = Math.random();                       // 0 far … 1 near
      const near = z > 0.86;
      stars.push({
        x: Math.random() * (W + 80) - 40, y: Math.random() * (H + 80) - 40,
        z, r: near ? 0.9 + Math.random() * 0.9 : 0.45 + Math.random() * 0.6,
        c: TINTS[(Math.random() * TINTS.length) | 0],
        ph: Math.random() * 6.283, sp: 0.8 + Math.random() * 1.6
      });
    }
  }

  // mouse parallax (smoothed), like the home page camera
  const m = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!reduce) window.addEventListener('pointermove', (e) => { m.x = e.clientX / W * 2 - 1; m.y = e.clientY / H * 2 - 1; }, { passive: true });

  function draw(t) {
    m.sx += (m.x - m.sx) * 0.05; m.sy += (m.y - m.sy) * 0.05;
    const sy = window.scrollY || 0;
    ctx.clearRect(0, 0, W, H);
    // nebula light
    ctx.globalCompositeOperation = 'lighter';
    for (const n of NEB) {
      const cx = n.x * W - m.sx * W * n.d, cy = n.y * H - m.sy * H * n.d;
      const rad = n.r * Math.max(W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(${n.c[0]},${n.c[1]},${n.c[2]},${n.o})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // stars: twinkle + depth parallax with the mouse and a little with scroll
    for (const s of stars) {
      const depth = 0.15 + s.z * 0.85;
      let x = s.x - m.sx * 26 * depth;
      let y = s.y - m.sy * 18 * depth - sy * 0.04 * depth;
      y = ((y % (H + 80)) + (H + 80)) % (H + 80) - 40;
      const tw = reduce ? 0.85 : 0.55 + 0.45 * Math.sin(t * 0.0016 * s.sp + s.ph * 3);
      const a = Math.min(0.85, tw * (0.4 + s.z * 0.5));
      const col = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},`;
      if (s.z > 0.86) {                                   // near stars get a soft halo
        const rr = s.r * 3.2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, col + (a * 0.55) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      ctx.fillStyle = col + a + ')';
      ctx.beginPath(); ctx.arc(x, y, s.r * 0.75, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  let raf = 0;
  function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
  build();
  window.addEventListener('resize', () => { build(); if (reduce) draw(0); });
  if (reduce) draw(0);
  else {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(loop);
    });
  }

  // ring cursor (desktop mouse only), grows over links and buttons
  if (fine && !reduce) {
    const cur = document.createElement('div');
    cur.className = 'tt-cursor'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<i></i>';
    document.body.appendChild(cur);
    let cx = W / 2, cy = H / 2, tx = cx, ty = cy, shown = false;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; if (!shown) { shown = true; cx = tx; cy = ty; } }, { passive: true });
    document.addEventListener('pointerover', (e) => { if (e.target.closest && e.target.closest('a, button, select, [role="button"], input[type="range"], label')) cur.classList.add('big'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('a, button, select, [role="button"], input[type="range"], label')) cur.classList.remove('big'); });
    document.addEventListener('mouseleave', () => { cur.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { cur.style.opacity = '1'; });
    (function follow() { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(follow); })();
  }
})();
