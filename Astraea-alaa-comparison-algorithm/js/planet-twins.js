/**
 * TerraTwin — click anywhere on Mars or the Moon (Home globe) to see its Earth twins.
 *
 * A click on a pin keeps working as before. A click on open ground finds the
 * nearest catalogued Moon/Mars site (data/targets.json) and lists the Earth
 * sites most similar to it, scored live with TASI (js/profile.js) and, when the
 * terrain patches are there, with the deep model (js/deep-model.js).
 */
(function () {
  'use strict';
  const RADIUS_KM = { mars: 3389.5, moon: 1737.4 };
  const TXT = {
    en: {
      badge: 'Nearest catalogued site', from: km => `${km} km from where you clicked`,
      twins: 'Most similar places on Earth', tasi: 'TASI', deep: 'Deep model',
      compare: 'Compare', finder: 'Open in Site Finder', none: 'No catalogued site on this body yet.',
      hint: 'Click anywhere on the surface to find its Earth twins', hintShort: 'Click Mars or the Moon anywhere for its Earth twins'
    },
    ar: {
      badge: 'أقرب موقع مفهرس', from: km => `على بعد ${km} كم من نقطة النقر`,
      twins: 'أكثر الأماكن شبهاً على الأرض', tasi: 'TASI', deep: 'النموذج العميق',
      compare: 'قارن', finder: 'افتح في مستكشف المواقع', none: 'لا يوجد موقع مفهرس على هذا الجرم بعد.',
      hint: 'انقر على أي مكان من السطح لإيجاد توائمه على الأرض', hintShort: 'انقر أي مكان على المريخ أو القمر لتوائمه الأرضية'
    }
  };
  const lang = () => (window.I18n && window.I18n.currentLang === 'ar') ? 'ar' : 'en';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let cache = null;
  async function data() {
    if (cache) return cache;
    const [t, c] = await Promise.all([window.App.fetchData('targets'), window.App.fetchData('cells')]);
    cache = { targets: (t && t.targets) || [], cells: (c && c.cells) || [] };
    return cache;
  }
  function parseLatLon(t) {
    if (typeof t.lat === 'number' && typeof t.lon === 'number') return [t.lat, t.lon];
    const m = String(t.coordinates || '').match(/([\d.]+)°\s*([NS])[, ]+([\d.]+)°\s*([EW])/i);
    if (!m) return null;
    return [parseFloat(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1), parseFloat(m[3]) * (m[4].toUpperCase() === 'W' ? -1 : 1)];
  }
  function angle(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  async function showTwins(P, body, lat, lon) {
    const t = TXT[lang()], isAr = lang() === 'ar';
    const popup = document.getElementById('planetSiteSelectedPopup');
    if (!popup) return;
    const d = await data();
    let best = null;
    d.targets.filter(x => x.body === body).forEach(x => {
      const ll = parseLatLon(x); if (!ll) return;
      const a = angle(lat, lon, ll[0], ll[1]);
      if (!best || a < best.a) best = { x, a, ll };
    });
    if (!best) { popup.innerHTML = `<div class="planet-site-popup-inner"><div class="popup-site-desc">${t.none}</div></div>`; popup.style.display = 'block'; return; }
    const target = best.x, km = Math.round(best.a * RADIUS_KM[body]);
    const mpm = window.MissionProfileManager;
    const rows = d.cells.filter(c => c.passed_ndvi_gate !== false && c.f && target.f)
      .map(c => ({ c, s: mpm.calculateTASI(c.f, target.f, body).score }))
      .sort((a, b) => b.s - a.s).slice(0, 5);
    const name = isAr ? (target.name_ar || target.name) : target.name;

    popup.innerHTML = `
      <div class="planet-site-popup-inner planet-twins-popup">
        <div class="popup-top">
          <span class="sci-badge validated">${t.badge}</span>
          <button class="popup-close" aria-label="Close" onclick="document.getElementById('planetSiteSelectedPopup').style.display='none'">✕</button>
        </div>
        <div class="popup-site-name">${esc(name)}</div>
        <div class="popup-site-coords">${esc(target.coordinates || '')} · ${t.from(km.toLocaleString('en-US'))}</div>
        <div class="popup-site-desc">${esc(isAr ? (target.environment_ar || target.description || '') : (target.description || target.environment || ''))}</div>
        <div class="planet-twins-title">${t.twins}</div>
        <ol class="planet-twins-list">
          ${rows.map((r, i) => `
            <li>
              <a href="compare.html?target=${encodeURIComponent(target.id)}&siteA=${encodeURIComponent(r.c.id)}" title="${t.compare}">
                <span class="pt-rank">${i + 1}</span>
                <span class="pt-name">${esc(isAr ? (r.c.name_ar || r.c.name) : r.c.name)}</span>
                <span class="pt-scores">
                  <span class="pt-tasi"><i>${t.tasi}</i> ${r.s.toFixed(1)}%</span>
                  <span class="pt-deep" data-earth="${esc(r.c.id)}"></span>
                </span>
              </a>
            </li>`).join('')}
        </ol>
        <div class="popup-actions">
          <a href="finder.html?body=${body}&ref=${encodeURIComponent(target.name)}" class="btn-popup-action primary">${t.finder}</a>
        </div>
      </div>`;
    popup.style.display = 'block';

    // marker on the matched site
    try {
      if (P.__twinMarker) P.markersGroup.remove(P.__twinMarker);
      const g = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.038, 48), new THREE.MeshBasicMaterial({ color: 0xf3df9a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
      const pos = P.latLonToVector3(best.ll[0], best.ll[1], 1.02);
      g.position.copy(pos); g.lookAt(pos.clone().multiplyScalar(2)); g.userData = { __twinMarker: true };
      P.markersGroup.add(g); P.__twinMarker = g;
    } catch (e) { /* marker is optional */ }

    // keep the twin showcase below the globe in step, when that site is part of it
    try {
      if (window.HomeShowcase && window.PLANETARY_DATABASE && window.PLANETARY_DATABASE.sites && window.PLANETARY_DATABASE.sites[target.id]) {
        window.HomeShowcase.displayCustomSitePair(target.id);
      }
    } catch (e) { /* optional */ }

    // deep model scores, when available
    if (window.DeepModel && typeof window.DeepModel.pair === 'function') {
      popup.querySelectorAll('.pt-deep').forEach(async el => {
        try {
          const p = await window.DeepModel.pair(target.id, el.getAttribute('data-earth'));
          if (p && p.row && document.body.contains(el)) el.innerHTML = `<i>${t.deep}</i> ${p.value}`;
        } catch (e) { /* leave empty */ }
      });
    }
  }

  function hook() {
    const P = window.Planetary3D;
    if (!P || P.__twinsHooked || typeof P.onPointerClick !== 'function' || !P.raycaster) return !!(P && P.__twinsHooked);
    const orig = P.onPointerClick;
    P.onPointerClick = function (e) {
      const body = this.currentPlanet;
      if (body !== 'mars' && body !== 'moon') return orig.call(this, e);
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const pins = this.markersGroup.children.filter(o => o.visible && !(o.userData && o.userData.__twinMarker));
      if (this.raycaster.intersectObjects(pins).length) return orig.call(this, e);
      if (!this.globeMesh) return;
      const hit = this.raycaster.intersectObject(this.globeMesh)[0];
      if (!hit) return;
      const p = this.markersGroup.worldToLocal(hit.point.clone()).normalize();
      const lat = 90 - Math.acos(Math.max(-1, Math.min(1, p.y))) * 180 / Math.PI;
      let lon = Math.atan2(p.z, -p.x) * 180 / Math.PI - 180;
      while (lon < -180) lon += 360; while (lon > 180) lon -= 360;
      showTwins(this, body, lat, lon).catch(err => console.error('[planet-twins]', err));
    };
    // the twin marker must not be treated as a pin by the hover tooltip
    const origMove = P.onPointerMove;
    if (typeof origMove === 'function') {
      P.onPointerMove = function (e) {
        const m = this.__twinMarker; if (m) m.visible = false;
        const r = origMove.call(this, e);
        if (m) m.visible = true;
        if ((this.currentPlanet === 'mars' || this.currentPlanet === 'moon') && document.body.style.cursor !== 'pointer' && this.globeMesh) {
          if (this.raycaster.intersectObject(this.globeMesh).length) document.body.style.cursor = 'crosshair';
        }
        return r;
      };
    }
    // drop the marker when the planet changes
    const origLoad = P.loadPlanet;
    if (typeof origLoad === 'function') {
      P.loadPlanet = function () { this.__twinMarker = null; return origLoad.apply(this, arguments); };
    }
    // tell the visitor about it, next to the existing globe hints
    const pill = document.querySelector('.planet-hint-pill');
    if (pill && !pill.querySelector('.planet-hint-twins')) {
      const s = document.createElement('span'); s.className = 'planet-hint-twins';
      const set = () => { s.textContent = '✦ ' + TXT[lang()].hintShort; };
      set(); pill.appendChild(s); document.addEventListener('languageChanged', set);
    }
    P.__twinsHooked = true;
    return true;
  }

  let tries = 0;
  const wait = setInterval(() => { if (hook() || ++tries > 100) clearInterval(wait); }, 150);
  window.PlanetTwins = { showTwins, parseLatLon };
})();
