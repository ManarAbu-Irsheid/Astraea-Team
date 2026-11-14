/* ==========================================================================
   Drifting satellite — a small, dim satellite crosses the sky behind the page
   on a wide orbital arc, now and then. Pure decoration: behind all content,
   never clickable, skipped for reduced motion and while the tab is hidden.
   ========================================================================== */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.body || !Element.prototype.animate) return;

  const style = document.createElement('style');
  style.textContent = `
  .tt-satellite { position: fixed; top: 0; left: 0; z-index: -1; pointer-events: none;
    width: 112px; height: 86px; opacity: 0; will-change: transform, opacity;
    filter: drop-shadow(0 0 8px rgba(120, 180, 255, 0.25)); }
  .tt-satellite svg { width: 100%; height: 100%; display: block; }
  @media (max-width: 760px) { .tt-satellite { width: 70px; height: 54px; } }
  @media print { .tt-satellite { display: none !important; } }`;
  document.head.appendChild(style);

  const sat = document.createElement('div');
  sat.className = 'tt-satellite';
  sat.setAttribute('aria-hidden', 'true');
  sat.innerHTML = `<svg aria-hidden="true" viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">
<defs>
 <linearGradient id="ttSat_cellA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c7ff0"/><stop offset=".5" stop-color="#1c3b98"/><stop offset="1" stop-color="#0b1f5a"/></linearGradient>
 <linearGradient id="ttSat_cellB" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d5bd0"/><stop offset=".6" stop-color="#132c78"/><stop offset="1" stop-color="#081640"/></linearGradient>
 <linearGradient id="ttSat_frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#cdd3dc"/><stop offset=".75" stop-color="#8d96a3"/><stop offset="1" stop-color="#3c434d"/></linearGradient>
 <linearGradient id="ttSat_gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe6a6"/><stop offset=".35" stop-color="#d4a640"/><stop offset=".7" stop-color="#9c7020"/><stop offset="1" stop-color="#5a3d0c"/></linearGradient>
 <filter id="ttSat_foil" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .5  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="overlay"/></filter>
 <radialGradient id="ttSat_dish" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d9dee5"/><stop offset=".85" stop-color="#8c95a3"/><stop offset="1" stop-color="#4a525e"/></radialGradient>
 <radialGradient id="ttSat_tank" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c7ccd4"/><stop offset=".75" stop-color="#5d6570"/><stop offset="1" stop-color="#14181e"/></radialGradient>
</defs>
<!-- booms -->
<line x1="128" y1="96" x2="152" y2="81" stroke="#d6dce5" stroke-width="2.4"/>
<line x1="112" y1="108" x2="92" y2="118" stroke="#9aa3af" stroke-width="2.4"/>
<polygon points="142.5,71.4 176.1,47.8 191.0,69.1 157.5,92.6" fill="url(#ttSat_cellA)" stroke="#c9d6ea" stroke-width=".9"/>
<line x1="146.7" y1="68.4" x2="161.7" y2="89.7" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="150.9" y1="65.5" x2="165.9" y2="86.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="155.1" y1="62.5" x2="170.1" y2="83.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="159.3" y1="59.6" x2="174.2" y2="80.9" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="163.5" y1="56.7" x2="178.4" y2="78.0" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="167.7" y1="53.7" x2="182.6" y2="75.0" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="171.9" y1="50.8" x2="186.8" y2="72.1" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="146.3" y1="76.7" x2="179.9" y2="53.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="150.0" y1="82.0" x2="183.6" y2="58.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="153.7" y1="87.3" x2="187.3" y2="63.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="147.6" y1="67.8" x2="175.9" y2="79.7" stroke="#ffffff" stroke-width="3" opacity=".12"/>
<polygon points="181.0,44.4 214.6,20.9 229.5,42.2 196.0,65.7" fill="url(#ttSat_cellA)" stroke="#c9d6ea" stroke-width=".9"/>
<line x1="185.2" y1="41.5" x2="200.2" y2="62.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="189.4" y1="38.5" x2="204.4" y2="59.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="193.6" y1="35.6" x2="208.6" y2="56.9" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="197.8" y1="32.6" x2="212.7" y2="53.9" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="202.0" y1="29.7" x2="216.9" y2="51.0" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="206.2" y1="26.8" x2="221.1" y2="48.1" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="210.4" y1="23.8" x2="225.3" y2="45.1" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="184.8" y1="49.7" x2="218.4" y2="26.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="188.5" y1="55.0" x2="222.1" y2="31.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="192.2" y1="60.4" x2="225.8" y2="36.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="186.1" y1="40.9" x2="214.4" y2="52.8" stroke="#ffffff" stroke-width="3" opacity=".12"/>
<polygon points="84.5,107.4 51.0,130.9 65.9,152.2 99.5,128.6" fill="url(#ttSat_cellB)" stroke="#c9d6ea" stroke-width=".9"/>
<line x1="80.3" y1="110.3" x2="95.3" y2="131.6" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="76.1" y1="113.2" x2="91.1" y2="134.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="71.9" y1="116.2" x2="86.9" y2="137.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="67.8" y1="119.1" x2="82.7" y2="140.4" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="63.6" y1="122.0" x2="78.5" y2="143.3" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="59.4" y1="125.0" x2="74.3" y2="146.3" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="55.2" y1="127.9" x2="70.1" y2="149.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="88.3" y1="112.7" x2="54.7" y2="136.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="92.0" y1="118.0" x2="58.4" y2="141.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="95.7" y1="123.3" x2="62.1" y2="146.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="79.5" y1="110.9" x2="81.0" y2="141.6" stroke="#ffffff" stroke-width="3" opacity=".12"/>
<polygon points="46.0,134.3 12.5,157.8 27.4,179.1 61.0,155.6" fill="url(#ttSat_cellB)" stroke="#c9d6ea" stroke-width=".9"/>
<line x1="41.8" y1="137.2" x2="56.8" y2="158.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="37.6" y1="140.2" x2="52.6" y2="161.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="33.4" y1="143.1" x2="48.4" y2="164.4" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="29.3" y1="146.1" x2="44.2" y2="167.4" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="25.1" y1="149.0" x2="40.0" y2="170.3" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="20.9" y1="151.9" x2="35.8" y2="173.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="16.7" y1="154.9" x2="31.6" y2="176.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="49.8" y1="139.6" x2="16.2" y2="163.2" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="53.5" y1="145.0" x2="19.9" y2="168.5" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="57.2" y1="150.3" x2="23.6" y2="173.8" stroke="#0e0d14" stroke-width=".7" opacity=".85"/>
<line x1="41.0" y1="137.8" x2="42.5" y2="168.5" stroke="#ffffff" stroke-width="3" opacity=".12"/>
<!-- bus: front face (gold foil), top face (silver), side face (shadow) -->
<polygon points="104,82 136,74 146,80 114,88" fill="url(#ttSat_frame)" stroke="#515862" stroke-width=".6"/>
<polygon points="104,82 114,88 118,124 108,118" fill="#3a3f47" stroke="#272b31" stroke-width=".6"/>
<polygon points="114,88 146,80 150,116 118,124" fill="url(#ttSat_gold)" stroke="#6e5115" stroke-width=".6" filter="url(#ttSat_foil)"/>
<path d="M118 97 L148 89 M119 106 L149 98 M120 115 L150 107" stroke="#6b4c10" stroke-width=".6" opacity=".55"/>
<rect x="128" y="96" width="9" height="6" fill="#20252c" transform="rotate(-14 132 99)" opacity=".8"/>
<!-- tank -->
<circle cx="150" cy="128" r="17" fill="url(#ttSat_tank)"/>
<!-- small dish -->
<ellipse cx="120" cy="134" rx="8" ry="5" fill="url(#ttSat_dish)" stroke="#6c7480" stroke-width=".6" transform="rotate(-25 120 134)"/>
<!-- main dish on mast -->
<line x1="110" y1="82" x2="98" y2="62" stroke="#c4cbd5" stroke-width="2"/>
<ellipse cx="88" cy="50" rx="26" ry="17" fill="url(#ttSat_dish)" stroke="#7a8391" stroke-width=".8" transform="rotate(-28 88 50)"/>
<ellipse cx="88" cy="50" rx="20" ry="12" fill="none" stroke="#a8b0bc" stroke-width=".6" opacity=".7" transform="rotate(-28 88 50)"/>
<ellipse cx="91" cy="54" rx="22" ry="13" fill="#000" opacity=".12" transform="rotate(-28 91 54)"/>
<path d="M88 50 L74 28 M88 50 L100 31 M88 50 L70 44" stroke="#d3d9e1" stroke-width=".9"/>
<circle cx="76" cy="30" r="2.6" fill="#e8edf3" stroke="#7a8391" stroke-width=".5"/>
<!-- tiny antenna -->
<line x1="140" y1="76" x2="146" y2="62" stroke="#c4cbd5" stroke-width="1.2"/>
<circle cx="146" cy="61" r="1.5" fill="#dfe5ec"/>
</svg>`;
  document.body.appendChild(sat);

  const rand = (a, b) => a + Math.random() * (b - a);
  let timer = 0;

  // crosses the sky on a wide, shallow orbital arc near the top of the screen:
  // small (far) at the edges, a little larger mid-way, slowly turning,
  // with one sun glint on the solar panels as it passes overhead.
  const glint = document.createElement('span');
  glint.style.cssText = 'position:absolute;inset:0;border-radius:50%;pointer-events:none;opacity:0;' +
    'background:radial-gradient(circle at 70% 35%, rgba(255,255,255,.95), rgba(160,200,255,.35) 18%, transparent 40%);';
  sat.style.position = 'fixed';
  sat.appendChild(glint);

  function fly() {
    if (document.hidden) { schedule(); return; }
    const w = window.innerWidth, h = window.innerHeight;
    const sw = sat.offsetWidth || 112, sh = sat.offsetHeight || 86;
    const ltr = Math.random() < 0.5;
    const yEdge = rand(0.24, 0.40) * h;          // height at the screen edges
    const lift = rand(0.06, 0.10) * h;           // how much higher it rides mid-way
    const tilt = rand(-0.06, 0.06) * h;          // slight slope of the whole path
    const r0 = rand(-18, 18), turn = rand(-22, 22);
    const steps = 10, frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = ltr ? t : 1 - t;
      const px = -sw - 30 + u * (w + sw * 2 + 60);
      const py = yEdge + tilt * (u - 0.5) * 2 - lift * Math.sin(Math.PI * t);
      const sc = 0.62 + 0.42 * Math.sin(Math.PI * t);
      frames.push({
        transform: `translate(${px}px, ${py}px) rotate(${r0 + turn * t}deg) scale(${sc.toFixed(3)})`,
        opacity: (i === 0 || i === steps) ? 0 : 0.6,
        offset: t
      });
    }
    const dur = rand(36000, 48000);
    const anim = sat.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
    glint.animate([
      { opacity: 0 }, { opacity: 0, offset: 0.46 }, { opacity: 0.9, offset: 0.5 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }
    ], { duration: dur, easing: 'ease-in-out' });
    anim.onfinish = schedule;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(fly, rand(8000, 16000));
  }
  timer = setTimeout(fly, rand(3000, 6000));
})();
