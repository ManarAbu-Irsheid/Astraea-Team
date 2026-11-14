/**
 * TerraTwin - Shared living space background.
 * Adds the same nebula, drifting stars, twinkles and shooting stars as the
 * Home page to any page that loads css/space-bg.css + this script.
 * The Home page already has the markup and its own motion code, so this
 * script does nothing there.
 */
(function () {
  if (document.querySelector('.space-living-background')) return;

  const sky = document.createElement('div');
  sky.className = 'space-living-background';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = `
    <div class="nebula-container">
      <div class="nebula-cloud nebula-blue"></div>
      <div class="nebula-cloud nebula-teal"></div>
      <div class="nebula-cloud nebula-planet-tint"></div>
    </div>
    <div class="starfield-layer starfield-far"></div>
    <div class="starfield-layer starfield-near"></div>
    <div class="twinkle-stars-layer">
      ${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<span class="twinkle-dot tk-${i}"></span>`).join('')}
    </div>`;
  document.body.prepend(sky);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Scroll parallax (near stars move faster than far ones)
  const far = sky.querySelector('.starfield-far');
  const near = sky.querySelector('.starfield-near');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.pageYOffset || document.documentElement.scrollTop;
      far.style.transform = `translateY(-${(y * 0.1).toFixed(1)}px)`;
      near.style.transform = `translateY(-${(y * 0.3).toFixed(1)}px)`;
      ticking = false;
    });
  }, { passive: true });

  // Occasional shooting stars
  const launch = () => {
    if (!document.hidden) {
      const star = document.createElement('span');
      star.className = 'shooting-star';
      star.style.left = (10 + Math.random() * 80) + '%';
      star.style.top = (3 + Math.random() * 40) + '%';
      star.style.setProperty('--angle', (140 + Math.random() * 30) + 'deg');
      star.style.setProperty('--distance', (320 + Math.random() * 260) + 'px');
      star.addEventListener('animationend', () => star.remove());
      sky.appendChild(star);
    }
    setTimeout(launch, 5000 + Math.random() * 6000);
  };
  setTimeout(launch, 2500);
})();
