/* ==========================================================================
   Compare page — layout helpers (no data / scoring changes)
   1. Terrain-morphology chips -> one compact dropdown (chips stay in the DOM,
      hidden, so compare.js keeps working exactly as before).
   2. Site pickers: the big site name is the control; a searchable list opens.
   3. 3D controls float as one bar over the bottom of the terrain view.
   ========================================================================== */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. morphology dropdown ---------- */
  function initMorphSelect() {
    const grid = document.getElementById('morphOptionsGrid');
    const toolbar = document.querySelector('.terrain-controls-toolbar');
    if (!grid || !toolbar || document.getElementById('morphSelect')) return;
    const chips = () => Array.from(grid.querySelectorAll('.morph-chip-btn'));

    const wrap = document.createElement('label');
    wrap.className = 'morph-select-wrap';
    const sel = document.createElement('select');
    sel.id = 'morphSelect';
    sel.className = 'morph-select';
    wrap.append(sel);
    toolbar.insertBefore(wrap, toolbar.firstChild);

    const label = () => {
      const l = document.querySelector('.morph-strip-label');
      const t = l ? l.textContent.replace(/[:：]\s*$/, '').trim() : 'Terrain morphology';
      sel.setAttribute('aria-label', t);
      wrap.title = t;
    };
    const build = () => {
      const cur = sel.value;
      sel.innerHTML = '';
      chips().forEach(btn => {
        const o = document.createElement('option');
        o.value = btn.getAttribute('data-morph');
        const ic = btn.querySelector('.morph-icon');
        const tx = btn.querySelector('.morph-text');
        o.textContent = (ic ? ic.textContent.trim() + '  ' : '') + (tx ? tx.textContent.trim() : o.value);
        sel.appendChild(o);
      });
      sync(cur);
      label();
    };
    const sync = (fallback) => {
      const active = chips().find(b => b.classList.contains('active'));
      sel.value = active ? active.getAttribute('data-morph') : (fallback || 'auto');
    };

    sel.addEventListener('change', () => {
      const btn = chips().find(b => b.getAttribute('data-morph') === sel.value);
      if (btn) btn.click();
    });
    new MutationObserver(() => sync()).observe(grid, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('languageChanged', () => setTimeout(build, 60));

    build();
    // I18n loads async — rebuild a few times so labels end up translated.
    let n = 0; const t = setInterval(() => { build(); if (++n > 12) clearInterval(t); }, 250);
  }


  /* ---------- 2. site pickers: big name + searchable list (native <select>
     stays in the DOM, hidden, and receives the 'change' event as before) ---- */
  const TEX = {
    mars: 'assets/textures/mars_2k_hd.jpg',
    moon: 'assets/textures/moon_2k.jpg',
    earth: 'assets/textures/earth_day_2k.jpg'
  };
  const isAr = () => (window.I18n && window.I18n.currentLang === 'ar') || document.documentElement.lang === 'ar';
  const T = {
    search: ['Search sites…', 'ابحث عن موقع…'],
    known: ['Known analog sites', 'مواقع تناظرية معروفة'],
    cand: ['New candidates', 'مواقع مرشحة جديدة'],
    none: ['No matching sites', 'لا توجد نتائج'],
    change: ['Change site', 'تغيير الموقع']
  };
  const tr = (k) => T[k][isAr() ? 1 : 0];
  const clean = (txt) => txt.replace(/^[\s●★]+/, '').trim();
  const splitName = (txt) => {
    const m = clean(txt).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    return m ? { name: m[1], sub: m[2] } : { name: clean(txt), sub: '' };
  };

  function makePicker(select, kind) {
    if (!select || select.dataset.picker) return;
    select.dataset.picker = '1';
    select.classList.add('site-native-select');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const wrap = document.createElement('div');
    wrap.className = 'site-pick';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'site-pick-trigger';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="site-pick-globe" aria-hidden="true"></span>' +
      '<span class="site-pick-name"></span><span class="site-pick-chev" aria-hidden="true"></span>';
    const pop = document.createElement('div');
    pop.className = 'site-pick-pop';
    pop.hidden = true;
    pop.innerHTML = '<input type="search" class="site-pick-search" autocomplete="off">' +
      '<div class="site-pick-list" role="listbox"></div>';
    wrap.append(btn, pop);
    select.parentElement.insertBefore(wrap, select);

    const globe = btn.querySelector('.site-pick-globe');
    const nameEl = btn.querySelector('.site-pick-name');
    const search = pop.querySelector('.site-pick-search');
    const list = pop.querySelector('.site-pick-list');

    const bodyOf = (opt) => {
      if (kind === 'earth') return 'earth';
      const g = opt && opt.parentElement;
      const first = select.querySelector('optgroup');
      return g && first && g !== first ? 'moon' : 'mars';
    };

    const groups = () => {
      if (kind === 'target') {
        return Array.from(select.querySelectorAll('optgroup')).map(g => ({ label: g.label, opts: Array.from(g.children) }));
      }
      const all = Array.from(select.options);
      return [
        { label: tr('known'), opts: all.filter(o => o.textContent.trim().startsWith('●')) },
        { label: tr('cand'), opts: all.filter(o => o.textContent.trim().startsWith('★')) }
      ].filter(g => g.opts.length);
    };

    const refreshTrigger = () => {
      const opt = select.options[select.selectedIndex];
      if (!opt) return;
      nameEl.textContent = splitName(opt.textContent).name;
      globe.style.backgroundImage = `url("${TEX[bodyOf(opt)]}")`;
      btn.title = tr('change');
      btn.setAttribute('aria-label', tr('change') + ': ' + nameEl.textContent);
    };

    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let n = 0;
      groups().forEach(g => {
        const items = g.opts.filter(o => !q || o.textContent.toLowerCase().includes(q));
        if (!items.length) return;
        const h = document.createElement('div');
        h.className = 'site-pick-group';
        h.textContent = g.label;
        list.appendChild(h);
        items.forEach(o => {
          const it = document.createElement('button');
          it.type = 'button';
          it.className = 'site-pick-item';
          it.setAttribute('role', 'option');
          it.dataset.value = o.value;
          const sn = splitName(o.textContent);
          it.innerHTML = '<span class="spi-name"></span><span class="spi-sub"></span>';
          it.querySelector('.spi-name').textContent = sn.name;
          it.querySelector('.spi-sub').textContent = sn.sub;
          if (o.value === select.value) { it.classList.add('is-selected'); it.setAttribute('aria-selected', 'true'); }
          list.appendChild(it);
          n++;
        });
      });
      if (!n) {
        const e = document.createElement('div');
        e.className = 'site-pick-empty';
        e.textContent = tr('none');
        list.appendChild(e);
      }
    };

    const items = () => Array.from(list.querySelectorAll('.site-pick-item'));
    const open = () => {
      document.querySelectorAll('.site-pick.is-open').forEach(w => w !== wrap && w._close && w._close());
      search.value = '';
      search.placeholder = tr('search');
      renderList();
      pop.hidden = false;
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      search.focus();
      const sel = list.querySelector('.is-selected');
      if (sel) sel.scrollIntoView({ block: 'center' });
    };
    const close = (focusBtn) => {
      pop.hidden = true;
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    };
    wrap._close = close;
    const choose = (value) => {
      if (value && value !== select.value) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      refreshTrigger();
      close(true);
    };

    btn.addEventListener('click', () => (pop.hidden ? open() : close()));
    search.addEventListener('input', renderList);
    list.addEventListener('click', (e) => {
      const it = e.target.closest('.site-pick-item');
      if (it) choose(it.dataset.value);
    });
    pop.addEventListener('keydown', (e) => {
      const all = items();
      const i = all.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (all[i + 1] || all[0])?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) search.focus(); else all[i - 1].focus(); }
      else if (e.key === 'Enter' && document.activeElement === search && all[0]) { e.preventDefault(); choose(all[0].dataset.value); }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target) && !pop.hidden) close(); });

    select.addEventListener('change', refreshTrigger);
    new MutationObserver(() => { refreshTrigger(); if (!pop.hidden) renderList(); })
      .observe(select, { childList: true, subtree: true });
    refreshTrigger();
  }

  function initPickers() {
    makePicker(document.getElementById('selectTarget'), 'target');
    makePicker(document.getElementById('selectSiteA'), 'earth');
  }

  /* ---------- 3. 3D controls float over the terrain (one bar, bottom) ---- */
  function initFloatingToolbar() {
    const bar = document.querySelector('.terrain-controls-toolbar');
    const card = document.querySelector('.terrain-3d-viewport-card');
    if (!bar || !card || bar.classList.contains('is-floating')) return;
    bar.classList.add('is-floating');
    card.appendChild(bar);
  }


  /* ---------- 4. hover readout follows the cursor; compact colour key ---- */
  function initHoverCard() {
    const card = document.querySelector('.terrain-3d-viewport-card');
    const canvas = document.getElementById('terrain3dCanvasContainer');
    const hud = document.getElementById('terrainHudTelemetry');
    if (!card || !canvas || !hud) return;
    hud.classList.add('is-cursor-card');
    let down = false, raf = 0, ev = null;
    const hide = () => hud.classList.remove('is-visible');
    const place = () => {
      raf = 0;
      if (!ev || down) return hide();
      const v = window.Terrain3DViewer;
      const onTerrain = v && v.reticleMesh ? v.reticleMesh.visible : true;
      if (!onTerrain) return hide();
      const r = card.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const w = hud.offsetWidth, h = hud.offsetHeight;
      let left = x + 18, top = y + 18;
      if (left + w > r.width - 8) left = x - w - 18;
      if (top + h > canvas.offsetHeight - 8) top = y - h - 18;
      hud.style.setProperty('left', Math.max(8, left) + 'px', 'important');
      hud.style.setProperty('top', Math.max(8, top) + 'px', 'important');
      hud.classList.add('is-visible');
    };
    canvas.addEventListener('mousemove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(place); });
    canvas.addEventListener('mouseleave', () => { ev = null; hide(); });
    canvas.addEventListener('mousedown', () => { down = true; hide(); });
    window.addEventListener('mouseup', () => { down = false; });
  }

  function initLegend() {
    const card = document.querySelector('.terrain-3d-viewport-card');
    const legend = document.querySelector('.terrain-legend-bar');
    const spectral = document.getElementById('btn3dLayerSpectral');
    if (!card || !legend) return;
    legend.classList.add('is-compact');
    const track = legend.querySelector('.legend-gradient-track');
    if (track && !legend.querySelector('.legend-ends')) {
      const ends = document.createElement('div');
      ends.className = 'legend-ends';
      ends.innerHTML = '<span>100%</span><span>&lt;50%</span>';
      track.after(ends);
    }
    const sync = () => card.classList.toggle('legend-off', !!spectral && !spectral.classList.contains('active'));
    if (spectral) new MutationObserver(sync).observe(spectral, { attributes: true, attributeFilter: ['class'] });
    sync();
  }


  /* ---------- 5. section dots (same as the home page) ---------- */
  function initSectionDots() {
    if (document.getElementById('sectionDotNav')) return;
    const L = (en, ar) => () => (isAr() ? ar : en);
    const secs = [
      { id: 'compareHeadSpotlight', label: L('Sites', 'المواقع') },
      { id: 'compare3dSpotlight', label: L('3D terrain', 'التضاريس') },
      { id: 'compareRadarSpotlight', label: L('Feature match', 'المطابقة') },
      { id: 'comparePanelsSpotlight', label: L('Readiness', 'الجاهزية') }
    ].filter(x => document.getElementById(x.id));
    if (secs.length < 2) return;

    const nav = document.createElement('nav');
    nav.className = 'section-dot-nav';
    nav.id = 'sectionDotNav';
    secs.forEach((x, i) => {
      const a = document.createElement('a');
      a.href = '#' + x.id;
      a.className = 'section-dot' + (i === 0 ? ' active' : '');
      a.dataset.target = x.id;
      a.innerHTML = '<span class="dot-indicator"></span><span class="dot-label"></span>';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const el = document.getElementById(x.id);
        const top = el.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      nav.appendChild(a);
    });
    document.body.appendChild(nav);

    const relabel = () => {
      nav.setAttribute('aria-label', isAr() ? 'أقسام الصفحة' : 'Page sections');
      nav.querySelectorAll('.section-dot').forEach((a, i) => {
        const t = secs[i].label();
        a.querySelector('.dot-label').textContent = t;
        a.title = t;
        a.setAttribute('aria-label', t);
      });
    };
    relabel();
    document.addEventListener('languageChanged', () => setTimeout(relabel, 60));
    let n = 0; const t = setInterval(() => { relabel(); if (++n > 12) clearInterval(t); }, 250);

    // active dot = the section crossing the upper-middle of the screen
    const setActive = () => {
      const line = Math.min(window.innerHeight * 0.4, 180);
      let cur = secs[0].id;
      secs.forEach(x => {
        const r = document.getElementById(x.id).getBoundingClientRect();
        if (r.top <= line) cur = x.id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1].id;
      nav.querySelectorAll('.section-dot').forEach(a => {
        const on = a.dataset.target === cur;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    let tick = false;
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { setActive(); tick = false; }); } }, { passive: true });
    window.addEventListener('resize', setActive);
    setActive();
  }

  const start = () => { initMorphSelect(); initPickers(); initFloatingToolbar(); initHoverCard(); initLegend(); initSectionDots(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
