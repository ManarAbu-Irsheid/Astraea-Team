/**
 * TerraTwin - Site Finder layout helpers (presentation only, no data changes).
 * - Right panel: Chart / Why it matches / Facts become tabs (one visible at a time).
 * - NDVI info button gets a translated tooltip label.
 */
(function () {
  const t = (key, fallback) => {
    const v = window.I18n && typeof window.I18n.t === 'function' ? window.I18n.t('finder.' + key) : '';
    return v || fallback;
  };

  function initDetailTabs() {
    const content = document.getElementById('finderDetailContent');
    if (!content || content.querySelector('.detail-tabs')) return;

    const chart = content.querySelector('.radar-chart-container');
    const why = [...content.querySelectorAll('.detail-bullet-section')];
    const factsList = document.getElementById('siteFactsList');
    const facts = factsList ? factsList.closest('.detail-info-section') : null;
    if (!chart || !why.length || !facts) return;

    const groups = {
      chart: [chart],
      why: why,
      facts: [facts]
    };
    const labels = { chart: ['tab_chart', 'Chart'], why: ['tab_why', 'Why it matches'], facts: ['tab_facts', 'Facts'] };

    const bar = document.createElement('div');
    bar.className = 'detail-tabs';
    bar.setAttribute('role', 'tablist');
    Object.keys(groups).forEach((key, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'detail-tab' + (i === 0 ? ' active' : '');
      btn.dataset.tab = key;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.textContent = t(...labels[key]);
      bar.appendChild(btn);
    });
    chart.parentNode.insertBefore(bar, chart);

    const panels = document.createElement('div');
    panels.className = 'detail-tab-panels';
    bar.after(panels);
    Object.entries(groups).forEach(([key, els]) => {
      const panel = document.createElement('div');
      panel.className = 'detail-tab-panel';
      panel.dataset.tab = key;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = key !== 'chart';
      els.forEach(el => panel.appendChild(el));
      panels.appendChild(panel);
    });

    const select = (key) => {
      bar.querySelectorAll('.detail-tab').forEach(b => {
        const on = b.dataset.tab === key;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.querySelectorAll('.detail-tab-panel').forEach(p => { p.hidden = p.dataset.tab !== key; });
    };
    bar.addEventListener('click', e => {
      const b = e.target.closest('.detail-tab');
      if (b) select(b.dataset.tab);
    });
    bar.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = [...bar.querySelectorAll('.detail-tab')];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const rtl = document.documentElement.dir === 'rtl';
      const step = (e.key === 'ArrowRight') !== rtl ? 1 : -1;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus(); select(next.dataset.tab);
    });

    const relabel = () => bar.querySelectorAll('.detail-tab').forEach(b => { b.textContent = t(...labels[b.dataset.tab]); });
    document.addEventListener('languageChanged', relabel);
    // translations load asynchronously: relabel once they are ready
    let tries = 0;
    const waitForI18n = () => {
      if (window.I18n && window.I18n.t && window.I18n.t('finder.tab_chart')) { relabel(); return; }
      if (tries++ < 40) setTimeout(waitForI18n, 150);
    };
    waitForI18n();
  }

  function initNdviInfo() {
    const btn = document.querySelector('.ndvi-info-btn');
    if (!btn) return;
    const set = () => { const l = t('ndvi_info_label', 'Hidden sites'); btn.title = l; btn.setAttribute('aria-label', l); };
    set();
    document.addEventListener('languageChanged', set);
    setTimeout(set, 1500);
  }

  const start = () => { initDetailTabs(); initNdviInfo(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
