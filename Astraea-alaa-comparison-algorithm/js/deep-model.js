/**
 * TerraTwin — Deep model similarity (runs in the visitor's browser, no server).
 *
 * Method 2 next to TASI:
 *   1. Each site has a terrain patch image (shaded relief drawn from elevation data)
 *      in data/patches/<site id>.png, listed in data/patches/index.json.
 *   2. A pretrained Vision Transformer (DINOv2-small) turns every patch into a
 *      384-number description vector — computed HERE, in the browser.
 *   3. raw   = cosine similarity between the Earth patch and the Moon/Mars patch
 *      score = (raw - lowest raw of any Earth site for that target) / (1 - lowest raw) * 100
 *      final = 0 if the Earth site failed the NDVI gate, else score
 *
 * To update the data: replace the files in data/patches/ (made by the Colab notebook).
 * Nothing in this file needs to change.
 */
(function () {
  'use strict';

  const CFG = {
    lib: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2',
    model: 'Xenova/dinov2-small',
    dtype: 'q8',
    dim: 384,
    patchDir: 'data/patches/',
    cachePrefix: 'tt_deep_v1_'
  };

  const TXT = {
    en: {
      title: 'Two independent methods',
      tasi: 'TASI (formula)',
      tasiSub: 'slope · roughness · albedo · temperature',
      deep: 'Deep model (DINOv2)',
      deepSub: 'terrain shape from elevation patches',
      loadingModel: 'Loading the model…',
      running: (i, n) => `Running the model on terrain patches ${i}/${n}…`,
      rank: (r, n) => `rank ${r} of ${n}`,
      raw: v => `raw ${v}%`,
      gate: 'rejected by the NDVI gate',
      noTarget: 'No terrain patch for this target yet',
      noSite: 'No terrain patch for this site yet',
      noIndex: 'Terrain patches not found (data/patches)',
      error: 'The model could not run in this browser',
      siteA: 'Site A', siteB: 'Site B'
    },
    ar: {
      title: 'طريقتان مستقلتان',
      tasi: 'TASI (معادلة)',
      tasiSub: 'الانحدار · الخشونة · السطوع · الحرارة',
      deep: 'النموذج العميق (DINOv2)',
      deepSub: 'شكل التضاريس من مربعات الارتفاع',
      loadingModel: 'جارٍ تحميل النموذج…',
      running: (i, n) => `النموذج يعمل على مربعات التضاريس ${i}/${n}…`,
      rank: (r, n) => `الترتيب ${r} من ${n}`,
      raw: v => `الخام ${v}%`,
      gate: 'مرفوض بفحص NDVI',
      noTarget: 'لا يوجد مربع تضاريس لهذا الهدف بعد',
      noSite: 'لا يوجد مربع تضاريس لهذا الموقع بعد',
      noIndex: 'مربعات التضاريس غير موجودة (data/patches)',
      error: 'تعذر تشغيل النموذج في هذا المتصفح',
      siteA: 'الموقع أ', siteB: 'الموقع ب'
    }
  };

  /* ---------------- pure maths (also used by the tests) ---------------- */
  function normalise(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    s = Math.sqrt(s) || 1;
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
    return out;
  }
  function cosine(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }
  /**
   * earth: [{id, vec, gate}]  targetVec: number[]
   * -> { floor, rows: [{id, raw, score, final, gate}] sorted by final desc }
   */
  function scoreAll(earth, targetVec) {
    const rows = earth.map(e => ({ id: e.id, gate: e.gate !== false, raw: cosine(e.vec, targetVec) }));
    const floor = rows.reduce((m, r) => Math.min(m, r.raw), Infinity);
    const span = (1 - floor) || 1;
    rows.forEach(r => {
      r.score = Math.max(0, (r.raw - floor) / span * 100);
      r.final = r.gate ? r.score : 0;
    });
    rows.sort((a, b) => b.final - a.final);
    return { floor, rows };
  }

  /* ---------------- model + cache ---------------- */
  const DeepModel = {
    CFG, normalise, cosine, scoreAll,
    index: null,
    vecs: {},            // id -> normalised vector
    extractor: null,
    failed: {},
    earthIds: [],
    _ranks: {},
    _queue: Promise.resolve(),
    _token: 0,

    lang() { return (window.I18n && window.I18n.currentLang === 'ar') ? 'ar' : 'en'; },
    t() { return TXT[this.lang()]; },

    async loadIndex() {
      if (this.index) return this.index;
      const res = await fetch(CFG.patchDir + 'index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('no-index');
      const index = await res.json();
      // NDVI gate: the same pass/fail flags every page uses (data/cells.json)
      let cells = null;
      try {
        const r = await fetch('data/cells.json');
        if (r.ok) cells = (await r.json()).cells;
      } catch (e) { /* fall through */ }
      if (!cells && window.__TERRATWIN_DATA__ && window.__TERRATWIN_DATA__.cells) cells = window.__TERRATWIN_DATA__.cells.cells;
      this.failed = {};
      (cells || []).forEach(c => { if (c.passed_ndvi_gate === false) this.failed[c.id] = true; });
      this.index = index;
      this.earthIds = Object.keys(index.patches).filter(id => id.indexOf('earth-') === 0);
      this._loadCache();
      return this.index;
    },

    _cacheKey() { return CFG.cachePrefix + (this.index && this.index.version || '0'); },
    _loadCache() {
      try {
        const raw = localStorage.getItem(this._cacheKey());
        if (raw) this.vecs = JSON.parse(raw) || {};
        // drop caches of older data versions
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.indexOf(CFG.cachePrefix) === 0 && k !== this._cacheKey()) localStorage.removeItem(k);
        }
      } catch (e) { this.vecs = {}; }
    },
    _saveCache() {
      try {
        const slim = {};
        Object.keys(this.vecs).forEach(k => { slim[k] = this.vecs[k].map(x => Math.round(x * 1e5) / 1e5); });
        localStorage.setItem(this._cacheKey(), JSON.stringify(slim));
      } catch (e) { /* storage full or blocked: keep in memory only */ }
    },

    async getExtractor() {
      if (this.extractor) return this.extractor;
      if (window.__TT_EXTRACTOR__) { this.extractor = window.__TT_EXTRACTOR__; return this.extractor; }
      const lib = await import(/* webpackIgnore: true */ CFG.lib);
      const pipe = await lib.pipeline('image-feature-extraction', CFG.model, { dtype: CFG.dtype });
      this.extractor = async (url) => {
        const out = await pipe(url);                 // last_hidden_state: [1, tokens, 384]
        const data = out.data;
        const cls = new Array(CFG.dim);
        for (let i = 0; i < CFG.dim; i++) cls[i] = data[i];   // first token = whole-image description
        if (out.dispose) out.dispose();
        return cls;
      };
      return this.extractor;
    },

    async embed(ids, onProgress) {
      const todo = ids.filter(id => !this.vecs[id] && this.index.patches[id]);
      if (!todo.length) return;
      if (onProgress) onProgress(-1, todo.length);
      const ex = await this.getExtractor();
      for (let i = 0; i < todo.length; i++) {
        if (onProgress) onProgress(i + 1, todo.length);
        const v = await ex(CFG.patchDir + this.index.patches[todo[i]]);
          this.vecs[todo[i]] = normalise(Array.from(v));
      }
      this._saveCache();
    },

    /** Full ranking of every Earth patch against one target (same result on every page). */
    async rank(targetId, onProgress) {
      await this.loadIndex();
      if (!this.index.patches[targetId]) return { missingTarget: true };
      if (this._ranks[targetId]) return this._ranks[targetId];
      // one model run at a time
      this._queue = this._queue.then(() => this.embed([targetId].concat(this.earthIds), onProgress), () => {});
      await this._queue;
      if (!this.vecs[targetId]) throw new Error('embed-failed');
      const earth = this.earthIds.filter(id => this.vecs[id]).map(id => ({ id, vec: this.vecs[id], gate: !this.failed[id] }));
      const res = scoreAll(earth, this.vecs[targetId]);
      res.passed = res.rows.filter(r => r.gate).length;
      this._ranks[targetId] = res;
      return res;
    },

    /** One Earth site vs one target -> { value, note } texts for display. */
    async pair(targetId, earthId, onProgress) {
      const t = this.t();
      const res = await this.rank(targetId, onProgress);
      if (res.missingTarget) return { value: '—', note: t.noTarget };
      const idx = res.rows.findIndex(r => r.id === earthId);
      if (idx < 0) return { value: '—', note: t.noSite };
      const r = res.rows[idx];
      const rawTxt = t.raw((r.raw * 100).toFixed(1));
      if (!r.gate) return { value: '0.0%', note: `${t.gate} · ${rawTxt}`, row: r };
      return { value: `${r.final.toFixed(1)}%`, note: `${t.rank(idx + 1, res.passed)} · ${rawTxt}`, row: r };
    },

    /** Small one-line readout used on Finder and Home. */
    async inline(el, targetId, earthId) {
      if (!el) return;
      const t = this.t();
      const token = (el.__ttToken = (el.__ttToken || 0) + 1);
      const set = (value, note) => {
        if (el.__ttToken !== token) return;
        el.innerHTML = `<span style="color:var(--accent-gold);font-weight:700;">${t.deep}:</span> ` +
          `<span style="font-family:var(--font-mono);font-weight:700;">${value}</span>` +
          (note ? ` <span style="color:var(--text-muted);">· ${note}</span>` : '');
      };
      set('…', t.loadingModel);
      try {
        const p = await this.pair(targetId, earthId, (i, n) => set('…', i < 0 ? t.loadingModel : t.running(i, n)));
        set(p.value, p.note);
      } catch (err) {
        console.error('[DeepModel]', err);
        set('—', err && err.message === 'no-index' ? t.noIndex : t.error);
      }
    },

    /* ---------------- Compare page panel ---------------- */
    ensurePanel() {
      let el = document.getElementById('deepModelPanel');
      if (el) return el;
      const anchor = document.getElementById('compareHeadSpotlight');
      if (!anchor) return null;
      el = document.createElement('section');
      el.id = 'deepModelPanel';
      el.style.cssText = 'margin:1rem 0;padding:1rem 0;border:0;border-top:1px solid var(--border-color);' +
        'border-radius:0;background:transparent;';
      anchor.insertAdjacentElement('afterend', el);
      return el;
    },

    _methodBox(label, sub, valueHtml, note, accent) {
      return `<div style="flex:1 1 220px;min-width:200px;padding:.75rem 1rem;border:0;border-inline-start:1px solid var(--border-color);border-radius:0;">
        <div style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:${accent};font-weight:700;">${label}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">${sub}</div>
        <div style="font-family:var(--font-mono);font-size:1.45rem;font-weight:800;margin-top:.4rem;">${valueHtml}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem;min-height:1em;">${note || ''}</div>
      </div>`;
    },

    _siteRow(title, name, tasi, deepHtml, deepNote) {
      const t = this.t();
      return `<div style="margin-top:.75rem;">
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.4rem;">${title}: <strong style="color:inherit;">${name}</strong></div>
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;">
          ${this._methodBox(t.tasi, t.tasiSub, tasi, '', 'var(--accent-cyan)')}
          ${this._methodBox(t.deep, t.deepSub, deepHtml, deepNote, 'var(--accent-gold)')}
        </div>
      </div>`;
    },

    async updateCompare() {
      const SC = window.SiteComparator;
      if (!SC || !SC.selectedTarget || !SC.siteA || !Array.isArray(SC.cells)) return;
      const panel = this.ensurePanel();
      if (!panel) return;
      const token = ++this._token;
      const t = this.t();
      const isAr = this.lang() === 'ar';
      const nameOf = s => (isAr ? (s.name_ar || s.name) : s.name);
      const hasB = !!document.getElementById('selectSiteB') && SC.siteB && SC.siteB.id !== SC.siteA.id;
      const sites = hasB ? [[t.siteA, SC.siteA], [t.siteB, SC.siteB]] : [['', SC.siteA]];
      const tasiOf = s => `${Number(SC.scoreFor(s)).toFixed(1)}%`;

      const draw = (deepFor) => {
        if (token !== this._token) return;
        panel.innerHTML = `<div style="font-weight:700;">${t.title}</div>` +
          sites.map(([title, s]) => {
            const d = deepFor(s);
            return this._siteRow(title || t.siteA, nameOf(s), tasiOf(s), d[0], d[1]);
          }).join('');
      };

      draw(() => ['…', t.loadingModel]);
      try {
        const targetId = SC.selectedTarget.id;
        const out = {};
        for (const [, s] of sites) {
          out[s.id] = await this.pair(targetId, s.id, (i, n) => draw(() => ['…', i < 0 ? t.loadingModel : t.running(i, n)]));
        }
        draw(s => [out[s.id].value, out[s.id].note]);
      } catch (err) {
        console.error('[DeepModel]', err);
        draw(() => ['—', err && err.message === 'no-index' ? t.noIndex : t.error]);
      }
    },

    initCompare() {
      const hook = () => {
        const SC = window.SiteComparator;
        if (!SC || SC.__deepHooked) return !!SC;
        const orig = SC.renderComparison;
        SC.renderComparison = function () {
          const r = orig.apply(this, arguments);
          try { DeepModel.updateCompare(); } catch (e) { console.error(e); }
          return r;
        };
        SC.__deepHooked = true;
        return true;
      };
      let tries = 0;
      const wait = setInterval(() => {
        const SC = window.SiteComparator;
        if (hook() && SC.selectedTarget && SC.siteA) { clearInterval(wait); this.updateCompare(); }
        if (++tries > 100) clearInterval(wait);
      }, 200);
    }
  };

  /* ---------------- Finder: line under the TASI score of the open site card ---------------- */
  DeepModel.initFinder = function () {
    const SF = window.SiteFinder;
    if (!SF || SF.__deepHooked || typeof SF.renderSiteDetail !== 'function') return;
    const orig = SF.renderSiteDetail;
    SF.renderSiteDetail = function (site) {
      const r = orig.apply(this, arguments);
      try {
        const anchor = document.getElementById('detailUncertaintyVal');
        if (anchor && site) {
          let el = document.getElementById('deepModelFinderLine');
          if (!el) {
            el = document.createElement('div');
            el.id = 'deepModelFinderLine';
            el.style.cssText = 'font-size:.78rem;margin-top:.35rem;';
            anchor.insertAdjacentElement('afterend', el);
          }
          const result = this.scoreSite(site);          // same target the TASI score above is against
          if (result && result.target) DeepModel.inline(el, result.target.id, site.id);
        }
      } catch (e) { console.error('[DeepModel]', e); }
      return r;
    };
    SF.__deepHooked = true;
    if (SF.selectedSite) SF.renderSiteDetail(SF.selectedSite);
  };

  /* ---------------- Home: line under the twin-pair ring ---------------- */
  DeepModel.initHome = function () {
    const HS = window.HomeShowcase;
    if (!HS || HS.__deepHooked || typeof HS.renderSitePair !== 'function') return;
    const orig = HS.renderSitePair;
    HS.renderSitePair = function (siteA, siteB) {
      const r = orig.apply(this, arguments);
      try {
        const anchor = document.getElementById('heroRingUncertainty');
        const ids = [siteA && siteA.id, siteB && siteB.id].filter(Boolean).map(String);
        const earthId = ids.find(id => id.indexOf('earth-') === 0);
        const targetId = ids.find(id => id.indexOf('earth-') !== 0);
        if (anchor && earthId && targetId) {
          let el = document.getElementById('deepModelHomeLine');
          if (!el) {
            el = document.createElement('div');
            el.id = 'deepModelHomeLine';
            el.style.cssText = 'font-size:.72rem;margin-top:.35rem;text-align:center;';
            anchor.insertAdjacentElement('afterend', el);
          }
          DeepModel.inline(el, targetId, earthId);
        }
      } catch (e) { console.error('[DeepModel]', e); }
      return r;
    };
    HS.__deepHooked = true;
    if (typeof HS.renderCurrentPair === 'function') { try { HS.renderCurrentPair(); } catch (e) { /* not ready yet */ } }
  };

  window.DeepModel = DeepModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = DeepModel;
  if (typeof document !== 'undefined') {
    const start = () => {
      if (document.getElementById('compareHeadSpotlight')) DeepModel.initCompare();
      let tries = 0;
      const wait = setInterval(() => {
        if (window.SiteFinder) DeepModel.initFinder();
        if (window.HomeShowcase) DeepModel.initHome();
        const done = (window.SiteFinder && window.SiteFinder.__deepHooked) || (window.HomeShowcase && window.HomeShowcase.__deepHooked);
        if (done || ++tries > 50) clearInterval(wait);
      }, 200);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})();
