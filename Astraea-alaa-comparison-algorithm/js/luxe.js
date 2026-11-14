/* TerraTwin luxury theme — motion layer only (no data, no page logic). */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var SPOT = [
    '.twin-site-card', '.kpi-card', '.tt-card', '.suggestion-card', '.ethics-section-card',
    '.footer-team-card', '.planet-telemetry-strip', '.twin-comparative-matrix-bar',
    '.lx-card'
  ].join(',');

  var REVEAL = [
    '.home-intro-block', '.planet-telemetry-strip', '.showcase-header', '.twin-site-card',
    '.twin-center-ring-panel', '.kpi-card', '.tt-footer-col', '.section-title', '.page-title',
    '.lx-card'
  ].join(',');

  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // 1) cursor-following glow on cards
    function bindSpot(el) {
      if (el.__lxSpot) return;
      var cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      el.__lxSpot = true;
      el.classList.add('lx-spot');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    }
    if (fine) {
      document.querySelectorAll(SPOT).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > 120 && r.height > 60 && !el.closest('.leaflet-container') && !el.closest('canvas')) bindSpot(el);
      });
    }

    // 2) scroll reveal (only below the first screen, so nothing above the fold flickers)
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('lx-in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      var seen = new Set();
      document.querySelectorAll(REVEAL).forEach(function (el, i) {
        if (seen.has(el) || el.closest('.site-header, .tour-overlay, .chatbot-dialog, .leaflet-container')) return;
        seen.add(el);
        var top = el.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.9) return;
        el.classList.add('lx-reveal');
        el.style.transitionDelay = (Math.min(i % 4, 3) * 90) + 'ms';
        io.observe(el);
      });
    }

    // 3) soft champagne halo that follows the cursor
    if (fine && !reduce) {
      var halo = document.createElement('div');
      halo.className = 'lx-cursor';
      document.body.appendChild(halo);
      var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
      addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
      (function loop() {
        x += (tx - x) * 0.12; y += (ty - y) * 0.12;
        halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        requestAnimationFrame(loop);
      })();
    }

    // 4) reading-progress hairline
    var bar = document.createElement('div');
    bar.className = 'lx-progress';
    document.body.appendChild(bar);
    function prog() {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(scrollY / h, 1) : 0) + ')';
    }
    addEventListener('scroll', prog, { passive: true }); prog();

    // 5) gentle 3D tilt on the twin cards
    if (fine && !reduce) {
      document.querySelectorAll('.lx-tilt').forEach(function (card) {
        card.style.transition = (card.style.transition ? card.style.transition + ',' : '') + 'transform .8s cubic-bezier(.22,1,.36,1)';
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = 'perspective(1200px) rotateY(' + (px * 4) + 'deg) rotateX(' + (-py * 4) + 'deg)';
        });
        card.addEventListener('pointerleave', function () { card.style.transform = ''; });
      });
    }
  });
})();
