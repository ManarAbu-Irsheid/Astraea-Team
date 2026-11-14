/**
 * TerraTwin — guide marker.
 * While the page tour runs, a "?" marker and a light ring glide to the part of
 * the page being explained, step by step. Works with js/tour.js; nothing in the
 * tour steps changes.
 */
(function () {
  'use strict';
  function setup() {
    const T = window.GuidedTour;
    if (!T || T.__markerHooked || typeof T.renderStep !== 'function') return !!(T && T.__markerHooked);
    let ring = null, mark = null, target = null, raf = 0;

    function ensure() {
      if (ring) return;
      ring = document.createElement('div'); ring.id = 'tourSpot'; ring.setAttribute('aria-hidden', 'true');
      mark = document.createElement('div'); mark.id = 'tourMark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = '?';
      document.body.appendChild(ring); document.body.appendChild(mark);
    }
    function place() {
      if (!target || !document.body.contains(target)) return;
      const r = target.getBoundingClientRect(), pad = 8;
      const x = Math.max(6, r.left - pad), y = Math.max(6, r.top - pad);
      const w = Math.min(window.innerWidth - 12, r.width + pad * 2), h = Math.min(window.innerHeight - 12, r.height + pad * 2);
      ring.style.transform = `translate(${x}px, ${y}px)`; ring.style.width = w + 'px'; ring.style.height = h + 'px';
      const rtl = document.documentElement.dir === 'rtl';
      const mx = rtl ? Math.min(window.innerWidth - 40, x + w - 18) : Math.max(4, x - 14);
      mark.style.transform = `translate(${mx}px, ${Math.max(4, y - 14)}px)`;
    }
    function loop() { place(); raf = requestAnimationFrame(loop); }
    function show(el) {
      ensure(); target = el;
      ring.classList.add('on'); mark.classList.add('on');
      mark.classList.remove('pop'); void mark.offsetWidth; mark.classList.add('pop');
      cancelAnimationFrame(raf); loop();
    }
    function hide() {
      cancelAnimationFrame(raf); target = null;
      if (ring) { ring.classList.remove('on'); mark.classList.remove('on'); }
    }

    const orig = T.renderStep;
    T.renderStep = function (index) {
      const r = orig.apply(this, arguments);
      try {
        const step = this.steps && this.steps[index];
        const el = step && document.querySelector(step.target);
        const overlay = document.getElementById('tourOverlay');
        if (el && overlay && overlay.classList.contains('active')) show(el);
      } catch (e) { /* marker is decorative */ }
      return r;
    };
    const origHide = T.hideOverlay;
    T.hideOverlay = function () { hide(); return origHide.apply(this, arguments); };
    document.addEventListener('tourEnded', hide);
    T.__markerHooked = true;
    return true;
  }
  let tries = 0;
  const wait = setInterval(() => { if (setup() || ++tries > 60) clearInterval(wait); }, 100);
})();
