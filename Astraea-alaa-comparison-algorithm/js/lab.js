/**
 * TerraTwin — Analog Lab
 * Pick an Earth analog, choose the world it plays, and check real space hardware
 * against the measured ground of that site.
 *
 * Data: data/cells.json (Earth sites) and data/targets.json (Moon / Mars sites).
 * Scores: TASI from js/profile.js (follows the mission profile in the header) and,
 * when terrain patches exist, the deep model from js/deep-model.js.
 *
 * Edit the hardware: the HW list below (name, fact, slope limit, source link).
 */
(function () {
  'use strict';

  /* needs = which criteria the machine depends on. maxSlope = published incline / tilt limit in degrees. */
  const HW = [
    { id: 'viper', icon: 'rover', type: 'rovers', maxSlope: 15, needs: ['slope', 'roughness'],
      src: 'https://science.nasa.gov/mission/viper/rover-and-instruments',
      en: ['VIPER rover', 'NASA Ames · Lunar rover', '447 kg roving mass. Built to cross inclines of up to 15° on loose polar soil.'],
      ar: ['مركبة VIPER', 'ناسا أميس · مركبة قمرية', 'كتلتها 447 كغ. صُممت لعبور منحدرات حتى 15° على تربة قطبية مفككة.'] },
    { id: 'percy', icon: 'rover', type: 'rovers', maxSlope: 24, needs: ['slope', 'roughness'],
      src: 'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/',
      en: ['Perseverance-class rover + RIMFAX', 'NASA JPL · Mars rover and ground radar', '1,025 kg rover exploring Jezero. Its drive tilt limit was raised to 24°; RIMFAX images rock layers below the surface.'],
      ar: ['مركبة من فئة Perseverance مع RIMFAX', 'ناسا JPL · مركبة مريخية ورادار أرضي', 'مركبة كتلتها 1,025 كغ تستكشف جيزيرو. رُفع حد الميلان أثناء القيادة إلى 24°، ورادار RIMFAX يصوّر طبقات الصخر تحت السطح.'] },
    { id: 'trident', icon: 'drill', type: 'drills', needs: ['roughness'],
      src: 'https://www.nasa.gov/general/into-the-belly-of-the-rover-vipers-final-science-instrument-installed',
      noteEn: 'Drill mechanics only. Buried ice is not part of the TASI score.',
      noteAr: 'ميكانيكا الحفر فقط. الجليد المدفون ليس ضمن درجة TASI.',
      en: ['TRIDENT drill', 'Honeybee Robotics · Rotary-percussive drill', 'Excavates to a depth of 1 metre in 10 cm increments.'],
      ar: ['حفّار TRIDENT', 'Honeybee Robotics · حفّار دوّار طرقي', 'يحفر حتى عمق متر واحد على مراحل من 10 سم.'] },
    { id: 'arads', icon: 'rover', type: 'rovers', needs: ['slope', 'roughness', 'thermal'],
      src: 'https://astrobiology.com/2024/04/10/the-atacama-rover-astrobiology-drilling-studies-arads-project/',
      en: ['KREX2 rover + ARADS drill', 'NASA Ames · Rover, drill, robot arm', 'Astrobiology drilling system field-tested in Chile’s Atacama Desert in 2019.'],
      ar: ['مركبة KREX2 مع حفّار ARADS', 'ناسا أميس · مركبة وحفّار وذراع آلية', 'نظام حفر لعلم الأحياء الفلكي جُرّب ميدانياً في صحراء أتاكاما في تشيلي عام 2019.'] },
    { id: 'nirvss', icon: 'inst', type: 'instruments', needs: ['albedo'],
      src: 'https://science.nasa.gov/mission/viper/rover-and-instruments',
      en: ['NIRVSS spectrometer', 'NASA Ames · Near-infrared volatiles spectrometer', 'Reads surface composition under the rover while it drives and drills.'],
      ar: ['مطياف NIRVSS', 'ناسا أميس · مطياف المواد المتطايرة بالأشعة تحت الحمراء القريبة', 'يقرأ تركيب السطح تحت المركبة أثناء سيرها وحفرها.'] },
    { id: 'k10', icon: 'rover', type: 'rovers', needs: ['slope', 'roughness'],
      src: 'https://www.kbr.com/en-au/node/10091',
      en: ['K10 rover', 'NASA Ames · Scout rover', 'Tested at Haughton Crater on Devon Island in 2009 and 2010.'],
      ar: ['مركبة K10', 'ناسا أميس · مركبة استطلاع', 'جُرّبت في فوهة هوتون بجزيرة ديفون عامي 2009 و2010.'] },
    { id: 'nss', icon: 'radar', type: 'instruments', needs: [],
      src: 'https://science.nasa.gov/mission/viper/rover-and-instruments',
      noteEn: 'Operations rehearsal only: TASI does not score buried ice or hydrogen.',
      noteAr: 'تدريب تشغيلي فقط: TASI لا يقيّم الجليد المدفون أو الهيدروجين.',
      en: ['NSS neutron spectrometer', 'NASA Ames · Prospecting instrument', 'Searches for hydrogen below the surface as the rover moves.'],
      ar: ['مطياف النيوترونات NSS', 'ناسا أميس · أداة تنقيب', 'يبحث عن الهيدروجين تحت السطح أثناء حركة المركبة.'] },
    { id: 'isru', icon: 'dig', type: 'isru', needs: ['roughness'], volcanic: true,
      src: 'https://www.astronomy.com/?p=42597',
      en: ['Regolith excavation rig', 'NASA · PISCES trials, Hawaii', 'Lunar extraction systems demonstrated on Hawaii’s volcanic soil.'],
      ar: ['منصة حفر الريغوليث', 'ناسا · تجارب PISCES في هاواي', 'أنظمة استخراج قمرية عُرضت على التربة البركانية في هاواي.'] }
  ];

  const HERITAGE = [
    { id: 'earth-1', en: ['K10 rover, 2009–2010', 'Mars-like dry, unvegetated, rocky terrain in the Canadian High Arctic.'], ar: ['مركبة K10، 2009–2010', 'تضاريس جافة صخرية بلا غطاء نباتي تشبه المريخ في القطب الشمالي الكندي.'] },
    { id: 'earth-2', en: ['KREX2 + ARADS, 2019', 'Rover, drill, robot arm and life-detection instruments in hyper-arid ground.'], ar: ['KREX2 مع ARADS، 2019', 'مركبة وحفّار وذراع آلية وأجهزة كشف الحياة في أرض شديدة الجفاف.'] },
    { id: 'earth-4', en: ['Lunar excavation trials, Hawaii', 'Volcanic soil used to demonstrate how lunar materials might be extracted.'], ar: ['تجارب الحفر القمري، هاواي', 'تربة بركانية استُخدمت لعرض طريقة استخراج المواد القمرية.'] }
  ];

  const G = { earth: 9.81, mars: 3.71, moon: 1.62 };

  const TXT = {
    en: {
      kicker: 'Analog Lab', title: 'Rehearse the mission <em>on Earth.</em>',
      lead: 'Pick an Earth analog, choose the world it plays, and build a field kit from real space hardware. The lab checks every machine against the measured ground, and says plainly what this site cannot reproduce.',
      site: 'Earth site', body: 'Playing as', target: 'Target it plays', mars: 'Mars', moon: 'Moon',
      hardware: 'Space hardware', types: { all: 'All', rovers: 'Rovers', drills: 'Drills', instruments: 'Instruments', isru: 'ISRU' },
      stage: 'Site stage', plays: n => `Plays ${n} at`, tasi: 'TASI similarity',
      crit: { slope: 'Slope', roughness: 'Roughness', albedo: 'Albedo', thermal: 'Thermal swing' },
      cannot: 'Cannot be reproduced here',
      gravity: (g, b) => `Gravity: ${G.earth} m/s² against ${g} m/s² on ${b}`,
      air: { mars: 'Thin CO₂ atmosphere and surface radiation', moon: 'Hard vacuum and surface radiation' },
      dust: { mars: 'Martian dust chemistry', moon: 'Electrostatic lunar dust' },
      depends: 'Depends on', notScored: 'Not scored', source: 'View source ↗', add: 'Add to kit +', inKit: 'In kit ✓',
      kit: n => `Field kit · ${n} machine${n === 1 ? '' : 's'}`, empty: 'Add hardware from the catalog.',
      plan: 'Test plan', planRows: ['Traverse and landing', 'Traction and navigation', 'Optical calibration', 'Thermal cycling'],
      lowG: 'Low-gravity dynamics', notOnEarth: 'Not reproducible on Earth',
      pdf: 'Export test plan (PDF)', compare: 'Compare this site', remove: 'Remove',
      vExceeds: (s, m) => `Slope ${s}° exceeds its ${m}° limit.`,
      vVolcOk: e => `Same terrain class as the Hawaii trials: ${e}.`,
      vVolcNo: e => `Not volcanic ground (${e}), unlike the Hawaii trials.`,
      vPartial: (c, t, p) => `Partial rehearsal: ${c} matches ${t} at only ${p}.`,
      vSlopeOk: (s, m, p) => `Slope ${s}° is inside its ${m}° limit, and the ground matches at ${p} or better.`,
      vOk: (c, p) => `Valid rehearsal: ${c} match at ${p} or better.`,
      heritageKicker: 'Field heritage', heritageTitle: 'Where this hardware has already met the ground.',
      rank: (r, n, s) => `TerraTwin rank ${r} of ${n} · ${s}%`, inSet: 'In the benchmark set',
      known: '● ', cand: '★ '
    },
    ar: {
      kicker: 'مختبر التناظر', title: 'تدرّب على المهمة <em>على الأرض.</em>',
      lead: 'اختر موقعاً أرضياً شبيهاً، وحدّد العالم الذي يمثّله، وكوّن عدّة ميدانية من معدات فضائية حقيقية. المختبر يفحص كل آلة مقابل قياسات أرض الموقع، ويذكر بوضوح ما لا يستطيع هذا الموقع محاكاته.',
      site: 'الموقع الأرضي', body: 'يمثّل', target: 'الهدف الذي يمثّله', mars: 'المريخ', moon: 'القمر',
      hardware: 'المعدات الفضائية', types: { all: 'الكل', rovers: 'مركبات', drills: 'حفّارات', instruments: 'أجهزة', isru: 'استخراج الموارد' },
      stage: 'بطاقة الموقع', plays: n => `يمثّل ${n} بنسبة`, tasi: 'تشابه TASI',
      crit: { slope: 'الانحدار', roughness: 'الخشونة', albedo: 'السطوع', thermal: 'الفرق الحراري' },
      cannot: 'لا يمكن محاكاته هنا',
      gravity: (g, b) => `الجاذبية: ${G.earth} م/ث² مقابل ${g} م/ث² على ${b}`,
      air: { mars: 'غلاف جوي رقيق من ثاني أكسيد الكربون وإشعاع سطحي', moon: 'فراغ تام وإشعاع سطحي' },
      dust: { mars: 'كيمياء غبار المريخ', moon: 'غبار قمري مشحون كهربائياً' },
      depends: 'يعتمد على', notScored: 'غير مقيَّم', source: 'عرض المصدر ↗', add: 'أضف إلى العدّة +', inKit: 'في العدّة ✓',
      kit: n => `العدّة الميدانية · ${n} ${n === 1 ? 'آلة' : 'آلات'}`, empty: 'أضف معدات من القائمة.',
      plan: 'خطة الاختبار', planRows: ['العبور والهبوط', 'الجرّ والملاحة', 'المعايرة البصرية', 'الدورات الحرارية'],
      lowG: 'ديناميكا الجاذبية المنخفضة', notOnEarth: 'لا يمكن محاكاتها على الأرض',
      pdf: 'تصدير خطة الاختبار (PDF)', compare: 'قارن هذا الموقع', remove: 'إزالة',
      vExceeds: (s, m) => `الانحدار ${s}° يتجاوز حدّها البالغ ${m}°.`,
      vVolcOk: e => `نفس صنف تضاريس تجارب هاواي: ${e}.`,
      vVolcNo: e => `أرض غير بركانية (${e})، بخلاف تجارب هاواي.`,
      vPartial: (c, t, p) => `تدريب جزئي: ${c} يطابق ${t} بنسبة ${p} فقط.`,
      vSlopeOk: (s, m, p) => `الانحدار ${s}° ضمن حدّها البالغ ${m}°، والأرض تطابق بنسبة ${p} أو أكثر.`,
      vOk: (c, p) => `تدريب صالح: ${c} بتطابق ${p} أو أكثر.`,
      heritageKicker: 'السجل الميداني', heritageTitle: 'أين التقت هذه المعدات بالأرض من قبل.',
      rank: (r, n, s) => `ترتيب TerraTwin ${r} من ${n} · ${s}%`, inSet: 'ضمن مجموعة المقارنة',
      known: '● ', cand: '★ '
    }
  };

  const ICON = (d) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    rover: ICON('<rect x="10" y="20" width="26" height="9" rx="2"/><path d="M30 20V11h7M14 20v-5h8v5M12 31v-2M23 31v-2M34 31v-2"/><circle cx="12" cy="35" r="4"/><circle cx="23" cy="35" r="4"/><circle cx="34" cy="35" r="4"/>'),
    drill: ICON('<path d="M24 6v26M18 6h12M20 12h8M24 32l-3 5h6zM14 42h20M21 18l6 3M21 24l6 3"/>'),
    inst: ICON('<rect x="9" y="16" width="30" height="18" rx="3"/><circle cx="19" cy="25" r="5"/><path d="M29 22h6M29 28h6M24 16V9M20 9h8"/>'),
    radar: ICON('<path d="M8 38h32M12 30a12 12 0 0 1 24 0M17 30a7 7 0 0 1 14 0M24 30v8M24 22V10"/>'),
    dig: ICON('<path d="M8 36h22M12 36v-8h14v8M26 30l10-12 4 4-6 8M36 18l-2-6"/><circle cx="13" cy="40" r="2"/><circle cx="27" cy="40" r="2"/>')
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pc = v => `${Number(v).toFixed(1)}%`;
  const lang = () => (window.I18n && window.I18n.currentLang === 'ar') ? 'ar' : 'en';

  const Lab = {
    cells: [], targets: [], rankInfo: {},
    state: { site: 'earth-16', target: '', type: 'all' },
    kit: new Set(),

    t() { return TXT[lang()]; },
    nameOf(x) { return lang() === 'ar' ? (x.name_ar || x.name) : x.name; },
    cell(id) { return this.cells.find(c => c.id === id); },
    target(id) { return this.targets.find(t => t.id === id); },
    tasi(cell, target) { return window.MissionProfileManager.calculateTASI(cell.f, target.f, target.body); },
    bestTarget(cell, body) {
      let best = null;
      this.targets.filter(t => t.body === body).forEach(t => {
        const s = this.tasi(cell, t).score;
        if (!best || s > best.s) best = { t, s };
      });
      return best ? best.t : null;
    },
    raw(cell) {
      const m = cell.physical_metrics || {};
      const swing = (typeof m.temp_max_C === 'number' && typeof m.temp_min_C === 'number') ? (m.temp_max_C - m.temp_min_C) : null;
      return {
        slope: m.slope_deg, slopeTxt: m.slope_deg != null ? `${m.slope_deg}°` : '—',
        roughness: m.roughness_m != null ? `${m.roughness_m} m` : '—',
        albedo: m.albedo != null ? `${m.albedo}` : '—',
        thermal: swing != null ? `Δ${swing.toFixed(1)} °C` : '—',
        elevation: m.elevation_m
      };
    },
    envOf(cell) {
      const w = cell.analog_workbook || {};
      return w.analog_environment_type || cell.terrain_type || '';
    },

    async init() {
      if (window.App) await window.App.init('lab');
      if (window.UserSystem && typeof window.UserSystem.recordPageVisit === 'function') window.UserSystem.recordPageVisit('lab');
      const [c, t, v] = await Promise.all([window.App.fetchData('cells'), window.App.fetchData('targets'), window.App.fetchData('validation')]);
      this.cells = ((c && c.cells) || []).filter(x => x.passed_ndvi_gate !== false && x.f);
      this.targets = ((t && t.targets) || []).filter(x => x.f);
      const ranking = (v && (v.validation_rankings || v.ranking)) || [];
      if (Array.isArray(ranking)) ranking.forEach(r => { if (r && (r.site_id || r.id)) this.rankInfo[r.site_id || r.id] = r; });
      try { this.kit = new Set(JSON.parse(localStorage.getItem('terratwin_lab_kit') || '["viper","percy","arads","nirvss"]')); } catch (e) { this.kit = new Set(['viper', 'percy', 'arads', 'nirvss']); }

      const q = new URLSearchParams(location.search);
      if (q.get('site') && this.cell(q.get('site'))) this.state.site = q.get('site');
      if (!this.cell(this.state.site) && this.cells[0]) this.state.site = this.cells[0].id;
      if (q.get('target') && this.target(q.get('target'))) this.state.target = q.get('target');
      if (!this.state.target) { const bt = this.bestTarget(this.cell(this.state.site), 'mars'); this.state.target = bt ? bt.id : (this.targets[0] || {}).id; }

      this.bind();
      this.render();
      document.addEventListener('languageChanged', () => this.render());
      document.addEventListener('profileChanged', () => this.render());
    },

    bind() {
      $('labSite').addEventListener('change', e => {
        this.state.site = e.target.value;
        const body = (this.target(this.state.target) || {}).body || 'mars';
        const bt = this.bestTarget(this.cell(this.state.site), body);
        if (bt) this.state.target = bt.id;
        this.render();
      });
      $('labTarget').addEventListener('change', e => { this.state.target = e.target.value; this.render(); });
      $('labBody').addEventListener('click', e => {
        const b = e.target.closest('[data-body]'); if (!b) return;
        const bt = this.bestTarget(this.cell(this.state.site), b.getAttribute('data-body'));
        if (bt) { this.state.target = bt.id; this.render(); }
      });
      $('labTypes').addEventListener('click', e => {
        const b = e.target.closest('[data-type]'); if (!b) return;
        this.state.type = b.getAttribute('data-type'); this.render();
      });
      document.querySelector('.lab-page').addEventListener('click', e => {
        const k = e.target.closest('[data-kit]');
        if (k) {
          const id = k.getAttribute('data-kit');
          this.kit.has(id) ? this.kit.delete(id) : this.kit.add(id);
          try { localStorage.setItem('terratwin_lab_kit', JSON.stringify([...this.kit])); } catch (err) { /* keep in memory */ }
          this.render();
        }
        if (e.target.closest('#labPdfBtn')) window.print();
      });
    },

    verdict(h, cell, target, per) {
      const t = this.t(), raw = this.raw(cell);
      const needs = h.needs.filter(k => per[k] != null);
      if (h.maxSlope && raw.slope != null && raw.slope > h.maxSlope) return ['bad', '×', t.vExceeds(raw.slope, h.maxSlope)];
      if (h.noteEn) return ['warn', '!', lang() === 'ar' ? h.noteAr : h.noteEn];
      const env = String(this.envOf(cell)).toLowerCase();
      if (h.volcanic) return cell.terrain_type === 'volcanic' ? ['ok', '✓', t.vVolcOk(esc(env))] : ['warn', '!', t.vVolcNo(esc(env))];
      const low = needs.map(k => [per[k], k]).sort((a, b) => a[0] - b[0])[0];
      if (!low) return ['warn', '!', t.notScored];
      if (low[0] < 85) return ['warn', '!', t.vPartial(t.crit[low[1]], esc(this.nameOf(target)), pc(low[0]))];
      if (h.maxSlope) return ['ok', '✓', t.vSlopeOk(raw.slope, h.maxSlope, pc(low[0]))];
      return ['ok', '✓', t.vOk(needs.map(k => t.crit[k]).join(lang() === 'ar' ? '، ' : ', '), pc(low[0]))];
    },

    render() {
      const t = this.t(), L = lang();
      const cell = this.cell(this.state.site), target = this.target(this.state.target);
      if (!cell || !target) return;
      const r = this.tasi(cell, target), per = r.perCriterion, raw = this.raw(cell);
      const bodyName = target.body === 'mars' ? t.mars : t.moon;

      // static texts
      $('labKicker').textContent = t.kicker; $('labTitle').innerHTML = t.title; $('labLead').textContent = t.lead;
      $('labSiteLabel').textContent = t.site; $('labBodyLabel').textContent = t.body; $('labTargetLabel').textContent = t.target;
      $('labHardwareTitle').textContent = t.hardware;
      $('labHeritageKicker').textContent = t.heritageKicker; $('labHeritageTitle').textContent = t.heritageTitle;

      // controls
      const sorted = this.cells.slice().sort((a, b) => this.nameOf(a).localeCompare(this.nameOf(b), L));
      $('labSite').innerHTML = sorted.map(c => `<option value="${c.id}" ${c.id === cell.id ? 'selected' : ''}>${c.is_candidate ? t.cand : t.known}${esc(this.nameOf(c))}</option>`).join('');
      $('labBody').querySelectorAll('button').forEach(b => {
        const on = b.getAttribute('data-body') === target.body;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = b.getAttribute('data-body') === 'mars' ? t.mars : t.moon;
      });
      $('labTarget').innerHTML = this.targets.filter(x => x.body === target.body)
        .map(x => ({ x, s: this.tasi(cell, x).score })).sort((a, b) => b.s - a.s)
        .map(({ x, s }) => `<option value="${x.id}" ${x.id === target.id ? 'selected' : ''}>${esc(this.nameOf(x))} · ${pc(s)}</option>`).join('');
      $('labTypes').innerHTML = Object.keys(t.types).map(k => `<button type="button" class="lab-chip ${this.state.type === k ? 'on' : ''}" data-type="${k}">${t.types[k]}</button>`).join('');

      // site stage
      const coord = `${Math.abs(cell.lat).toFixed(2)}° ${cell.lat >= 0 ? 'N' : 'S'}, ${Math.abs(cell.lon).toFixed(2)}° ${cell.lon >= 0 ? 'E' : 'W'}`;
      const rawTxt = { slope: raw.slopeTxt, roughness: raw.roughness, albedo: raw.albedo, thermal: raw.thermal };
      $('labStage').innerHTML = `
        <span class="lab-label">${t.stage}</span>
        <h3 class="lab-stage-name">${esc(this.nameOf(cell))}</h3>
        <p class="lab-mono">${coord}${raw.elevation != null ? ` · ${raw.elevation} m` : ''}<br>${esc(this.envOf(cell))}</p>
        <div class="lab-score-box">
          <div><span class="lab-label mars">${t.plays(esc(this.nameOf(target)))}</span><p class="lab-dim">${t.tasi}</p></div>
          <span class="lab-score">${pc(r.score)}</span>
        </div>
        <div class="lab-deep" id="labDeepLine"></div>
        ${r.keys.map(k => `
          <div class="lab-bar-row">
            <div class="lab-bar-head"><span>${t.crit[k]}</span><span class="lab-mono">${rawTxt[k]} · ${pc(per[k])}</span></div>
            <div class="lab-bar"><i style="width:${Math.max(0, Math.min(100, per[k]))}%"></i></div>
          </div>`).join('')}
        <hr class="lab-hr">
        <span class="lab-label bad">${t.cannot}</span>
        <ul class="lab-list">
          <li><b class="bad">×</b><span>${t.gravity(G[target.body], bodyName)}</span></li>
          <li><b class="bad">×</b><span>${t.air[target.body]}</span></li>
          <li><b class="bad">×</b><span>${t.dust[target.body]}</span></li>
        </ul>`;
      if (window.DeepModel && typeof window.DeepModel.inline === 'function') window.DeepModel.inline($('labDeepLine'), target.id, cell.id);

      // hardware catalog
      const verdicts = {}; HW.forEach(h => { verdicts[h.id] = this.verdict(h, cell, target, per); });
      $('labMachines').innerHTML = HW.filter(h => this.state.type === 'all' || h.type === this.state.type).map(h => {
        const v = verdicts[h.id], inKit = this.kit.has(h.id), tx = h[L];
        return `
          <article class="lab-card lab-machine ${inKit ? 'in' : ''}">
            <div class="lab-machine-top"><div class="lab-ic">${ICONS[h.icon]}</div><div><b>${esc(tx[0])}</b><div class="lab-mono">${esc(tx[1])}</div></div></div>
            <p class="lab-dim">${esc(tx[2])}</p>
            <div class="lab-needs"><span class="lab-label">${t.depends}</span>${h.needs.length ? h.needs.map(k => `<span class="lab-tag">${t.crit[k]}</span>`).join('') : `<span class="lab-tag">${t.notScored}</span>`}</div>
            <div class="lab-verdict ${v[0]}"><b>${v[1]}</b><span>${v[2]}</span></div>
            <div class="lab-machine-foot">
              <a class="lab-src" href="${h.src}" target="_blank" rel="noopener">${t.source}</a>
              <button type="button" class="lab-btn sm ${inKit ? 'gold' : 'ghost'}" data-kit="${h.id}">${inKit ? t.inKit : t.add}</button>
            </div>
          </article>`;
      }).join('');

      // field kit
      const kit = HW.filter(h => this.kit.has(h.id));
      const shortName = this.nameOf(cell).split(/[,/(،]/)[0].trim();
      $('labKit').innerHTML = `
        <span class="lab-label gold">${t.kit(kit.length)}</span>
        <h3 class="lab-stage-name">${esc(shortName)} × ${esc(this.nameOf(target))}</h3>
        <ul class="lab-kit-list">${kit.map(h => `<li><b class="${verdicts[h.id][0]}">${verdicts[h.id][1]}</b><span>${esc(h[L][0])}</span><button type="button" data-kit="${h.id}" aria-label="${t.remove}">×</button></li>`).join('') || `<li class="lab-dim">${t.empty}</li>`}</ul>
        <hr class="lab-hr">
        <span class="lab-label">${t.plan}</span>
        <ul class="lab-list">
          ${['slope', 'roughness', 'albedo', 'thermal'].filter(k => per[k] != null).map((k, i) => `<li><b class="${per[k] >= 85 ? 'ok' : 'warn'}">${per[k] >= 85 ? '✓' : '!'}</b><span>${t.planRows[['slope', 'roughness', 'albedo', 'thermal'].indexOf(k)]}<br><span class="lab-mono">${t.crit[k]} ${pc(per[k])}</span></span></li>`).join('')}
          <li><b class="bad">×</b><span class="lab-dim">${t.lowG}<br><span class="lab-mono">${t.notOnEarth}</span></span></li>
        </ul>
        <div class="lab-kit-actions">
          <button type="button" class="lab-btn wide" id="labPdfBtn">${t.pdf}</button>
          <a class="lab-btn ghost wide" href="compare.html?target=${encodeURIComponent(target.id)}&siteA=${encodeURIComponent(cell.id)}">${t.compare}</a>
        </div>`;

      // heritage
      const total = this.cells.length;
      $('labHeritage').innerHTML = HERITAGE.filter(h => this.cell(h.id)).map(h => {
        const c = this.cell(h.id), tx = h[L], ri = this.rankInfo[h.id];
        const line = ri && ri.rank ? t.rank(ri.rank, total, ri.score != null ? ri.score : '') : t.inSet;
        return `<a class="lab-card lab-heritage-card" href="lab.html?site=${h.id}"><span class="lab-label gold">${esc(tx[0])}</span><h3 class="lab-stage-name">${esc(this.nameOf(c))}</h3><p class="lab-dim">${esc(tx[1])}</p><hr class="lab-hr"><span class="lab-mono">${esc(line)}</span></a>`;
      }).join('');
    }
  };

  // page tour steps (same guide as the other pages)
  if (window.GuidedTour && window.GuidedTour.tourDefinitions && !window.GuidedTour.tourDefinitions.lab) {
    window.GuidedTour.tourDefinitions.lab = [
      { target: '#labControlsSpotlight', title_en: '1. Site, world and target', title_ar: '1. الموقع والعالم والهدف', body_en: 'Choose the Earth analog, whether it plays Mars or the Moon, and the exact target.', body_ar: 'اختر الموقع الأرضي، وهل يمثّل المريخ أم القمر، والهدف المحدد.' },
      { target: '#labStage', title_en: '2. Site stage', title_ar: '2. بطاقة الموقع', body_en: 'How closely this ground matches the target, criterion by criterion, and what Earth cannot reproduce.', body_ar: 'مدى تطابق هذه الأرض مع الهدف معياراً بمعيار، وما لا تستطيع الأرض محاكاته.' },
      { target: '#labCatalogSpotlight', title_en: '3. Space hardware', title_ar: '3. المعدات الفضائية', body_en: 'Each machine is checked against the measured slope and ground of the site. Add the ones you want to the kit.', body_ar: 'تُفحص كل آلة مقابل انحدار الموقع وأرضه المقاسة. أضف ما تريد إلى العدّة.' },
      { target: '#labKit', title_en: '4. Field kit and test plan', title_ar: '4. العدّة وخطة الاختبار', body_en: 'Your selected hardware and the tests this site supports. Export the plan as PDF.', body_ar: 'المعدات التي اخترتها والاختبارات التي يدعمها الموقع. صدّر الخطة بصيغة PDF.' }
    ];
  }

  window.AnalogLab = Lab;
  document.addEventListener('DOMContentLoaded', () => Lab.init());
})();
