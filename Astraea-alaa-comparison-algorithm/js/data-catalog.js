/* ==========================================================================
   Evidence page — Data catalog (#dataCatalogSection).
   Lists the datasets in data/validation.json → data_catalog as an open,
   searchable and sortable table. Read-only; does not change any data.
   ========================================================================== */
(function () {
  'use strict';
  const host = document.getElementById('dataCatalogTable');
  if (!host) return;
  const isAr = () => (window.I18n && window.I18n.currentLang === 'ar') || document.documentElement.lang === 'ar';
  const T = {
    search: ['Search datasets, agencies, bodies…', 'ابحث في البيانات أو الوكالات أو الأجرام…'],
    name: ['Dataset', 'مجموعة البيانات'], agency: ['Agency', 'الجهة'], body: ['Body', 'الجرم'],
    resolution: ['Resolution', 'الدقة'], license: ['License', 'الترخيص'], application: ['Used for', 'تُستخدم في'],
    none: ['No dataset matches your search.', 'لا توجد بيانات مطابقة للبحث.'],
    bodies: { earth: ['Earth', 'الأرض'], mars: ['Mars', 'المريخ'], moon: ['Moon', 'القمر'] }
  };
  const tr = (k) => T[k][isAr() ? 1 : 0];
  const COLS = ['name', 'agency', 'body', 'resolution', 'license', 'application'];
  let rows = [], sortKey = 'body', sortDir = 1, query = '';

  function cell(r, k) {
    if (k === 'body') return (T.bodies[r.body] || [r.body, r.body])[isAr() ? 1 : 0];
    if (k === 'application') return isAr() ? (r.application_ar || r.application) : r.application;
    return r[k] || '';
  }
  function render() {
    const q = query.trim().toLowerCase();
    const list = rows
      .filter(r => !q || COLS.some(k => String(cell(r, k)).toLowerCase().includes(q)))
      .sort((a, b) => String(cell(a, sortKey)).localeCompare(String(cell(b, sortKey))) * sortDir);
    const head = COLS.map(k => {
      const on = k === sortKey;
      return `<th scope="col" aria-sort="${on ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}">
        <button type="button" class="dc-sort${on ? ' on' : ''}" data-k="${k}">${tr(k)}<span aria-hidden="true">${on ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}</span></button></th>`;
    }).join('');
    const body = list.length
      ? list.map(r => `<tr>${COLS.map(k => `<td data-label="${tr(k)}" class="dc-${k}${k === 'body' ? ' dc-body-' + r.body : ''}">${cell(r, k)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${COLS.length}" class="dc-empty">${tr('none')}</td></tr>`;
    host.innerHTML = `
      <input type="search" class="dc-search" placeholder="${tr('search')}" aria-label="${tr('search')}" value="${query.replace(/"/g, '&quot;')}">
      <div class="dc-scroll"><table class="dc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    const input = host.querySelector('.dc-search');
    input.addEventListener('input', (e) => { query = e.target.value; const pos = e.target.selectionStart; render(); const n = host.querySelector('.dc-search'); n.focus(); n.setSelectionRange(pos, pos); });
    host.querySelectorAll('.dc-sort').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = 1; } render();
      host.querySelector(`.dc-sort[data-k="${k}"]`)?.focus();
    }));
  }
  function load() {
    const store = window.__TERRATWIN_DATA__ && window.__TERRATWIN_DATA__.validation;
    if (store && store.data_catalog) { rows = store.data_catalog.slice(); render(); return; }
    fetch('data/validation.json').then(r => r.json()).then(v => { rows = (v.data_catalog || []).slice(); render(); }).catch(() => {});
  }
  document.addEventListener('languageChanged', () => setTimeout(render, 60));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
