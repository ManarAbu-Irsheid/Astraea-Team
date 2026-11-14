/* ==========================================================================
   Section dots (same look as the home page), driven by markup:
   <section data-dot-en="Roadmap" data-dot-ar="خارطة الطريق"> ...
   ========================================================================== */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isAr = () => (window.I18n && window.I18n.currentLang === 'ar') || document.documentElement.lang === 'ar';

  function init() {
    if (document.getElementById('sectionDotNav')) return;
    const secs = Array.from(document.querySelectorAll('[data-dot-en]'));
    if (secs.length < 2) return;

    const nav = document.createElement('nav');
    nav.className = 'section-dot-nav';
    nav.id = 'sectionDotNav';
    const dots = secs.map((el, i) => {
      const a = document.createElement('a');
      if (!el.id) el.id = 'dotSection' + i;
      a.href = '#' + el.id;
      a.className = 'section-dot' + (i === 0 ? ' active' : '');
      a.innerHTML = '<span class="dot-indicator"></span><span class="dot-label"></span>';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      nav.appendChild(a);
      return a;
    });
    document.body.appendChild(nav);

    const relabel = () => {
      nav.setAttribute('aria-label', isAr() ? 'أقسام الصفحة' : 'Page sections');
      dots.forEach((a, i) => {
        const t = isAr() ? (secs[i].dataset.dotAr || secs[i].dataset.dotEn) : secs[i].dataset.dotEn;
        a.querySelector('.dot-label').textContent = t;
        a.title = t;
        a.setAttribute('aria-label', t);
      });
    };
    relabel();
    document.addEventListener('languageChanged', () => setTimeout(relabel, 60));
    let n = 0; const t = setInterval(() => { relabel(); if (++n > 12) clearInterval(t); }, 250);

    const setActive = () => {
      const line = Math.min(window.innerHeight * 0.4, 180);
      let cur = 0;
      secs.forEach((el, i) => { if (el.getBoundingClientRect().top <= line) cur = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs.length - 1;
      dots.forEach((a, i) => {
        a.classList.toggle('active', i === cur);
        if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    let tick = false;
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { setActive(); tick = false; }); } }, { passive: true });
    window.addEventListener('resize', setActive);
    setActive();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
