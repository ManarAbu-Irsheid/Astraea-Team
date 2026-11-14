/* TerraTwin — cinematic home: Arabic / English switch + AstraBot + chatbot.
   The home page text is written in English in index.html; this file swaps it
   to Arabic (and back) when the "عربي" button is pressed, using the same
   language setting as the other pages (localStorage "terratwin_lang"). */
(function () {
  'use strict';
  const AR = {
    'Calibrating orbit · loading planet textures': 'معايرة المدار · تحميل صور الكواكب',
    'Begin mission': 'ابدأ المهمة',
    'Take the 30-second tour': 'جولة سريعة (30 ثانية)',
    'Planetary Analog Intelligence': 'ذكاء التناظر الكوكبي',
    'Home': 'الرئيسية', 'Site Finder': 'مستكشف المواقع', 'Compare Sites': 'مقارنة المواقع',
    'Analog Lab': 'مختبر التناظر', 'NEW': 'جديد', 'Evidence & Method': 'الأدلة والمنهجية', 'Guide': 'الدليل',
    'TASI Baseline': 'TASI الأساسي', 'Sign In': 'تسجيل الدخول', 'Sign Up': 'إنشاء حساب',
    'Explore': 'استكشف', 'Twin pair': 'التوأم', 'Results': 'النتائج',
    'Multi-Attribute Planetary Surface Matching': 'مطابقة أسطح الكواكب بعدة معايير',
    'Matching Earth Analogs': 'نطابق مواقع على الأرض', 'to the': 'مع', '&': 'و', 'Moon': 'القمر', 'Mars': 'المريخ', 'Earth': 'الأرض',
    'We use satellite data to find places on Earth that match exploration sites on the Moon and Mars — comparing slope, albedo and thermal swing, and keeping only barren sites (NDVI gate).':
      'نستخدم بيانات الأقمار الصناعية لنجد أماكن على الأرض تشبه مواقع الاستكشاف على القمر والمريخ — نقارن الانحدار والسطوع وفرق الحرارة، ونُبقي فقط المواقع الجرداء (فحص NDVI).',
    'Explore the worlds': 'استكشف العوالم', 'Open Site Finder': 'افتح مستكشف المواقع', 'Scroll': 'مرّر',
    '— Explore': '— استكشف', 'Terrestrial Analog Host': 'مضيف التناظر الأرضي', 'Earth (Terra)': 'الأرض',
    'Drag to rotate 360°': 'اسحب للتدوير 360°', 'Click pins to inspect analog telemetry': 'اضغط على النقاط لعرض بيانات الموقع',
    '— Planetary Twin Analysis': '— تحليل التوأم الكوكبي', '// Interactive Telemetry Sync': '// مزامنة تفاعلية',
    'Rotate the 3D celestial bodies above and click any pin to inspect real multi-criteria physical similarity below.':
      'دوّر الكواكب ثلاثية الأبعاد في الأعلى واضغط على أي نقطة لترى التشابه الفيزيائي الحقيقي بعدة معايير في الأسفل.',
    'Martian Target': 'الهدف على المريخ', 'Lunar Target': 'الهدف على القمر', 'Overall Similarity': 'التشابه الكلي',
    'Cleared Abiotic Gate': 'اجتاز فحص الخلو من النبات', 'Matched Analog Twin': 'التوأم المطابق على الأرض',
    '— Results': '— النتائج', 'Scanned Earth Cells': 'مناطق الأرض المفحوصة',
    'Barren and ice regions picked from NASA MODIS land cover, about 17 km each': 'مناطق جرداء وجليدية من خريطة غطاء الأرض MODIS (ناسا)، كل منطقة نحو 17 كم',
    'Known Analog Recall Rate': 'نسبة إيجاد المواقع المعروفة', 'Rejected by the NDVI gate': 'رُفضت بفحص NDVI',
    'Regions with vegetation removed before matching': 'مناطق فيها نباتات استُبعدت قبل المقارنة',
    'New Validated Candidates': 'مرشحون جدد', 'Novel high-fidelity analog sites discovered by algorithm': 'مواقع تناظر جديدة وجدتها الخوارزمية',
    'Continue the mission': 'تابع المهمة',
    'TerraTwin finds places on Earth that match landing and exploration sites on the Moon and Mars, using open satellite data, so missions can test on Earth before they fly.':
      'تيراتوين يجد أماكن على الأرض تشبه مواقع الهبوط والاستكشاف على القمر والمريخ باستخدام بيانات أقمار صناعية مفتوحة، لتُختبر المهمات على الأرض قبل أن تطير.',
    'Built by': 'من إعداد', 'Contact': 'تواصل', 'Methodology': 'المنهجية', 'Data sources': 'مصادر البيانات',
    'View all data sources': 'كل مصادر البيانات', 'Skip': 'تخطي', 'Next': 'التالي',
    'Researcher Profile': 'الملف الشخصي للباحث', 'Mission, Ethics & Guide': 'الهدف والأخلاقيات والدليل',
    'Contact Science Team': 'تواصل مع الفريق العلمي', 'AI Science Assistant': 'المساعد العلمي الذكي', 'Account & Sign In': 'الحساب وتسجيل الدخول', 'Sign Out': 'تسجيل الخروج',
    'Contact the team': 'تواصل مع الفريق'
  };
  const EN = {};
  Object.keys(AR).forEach((k) => { EN[AR[k]] = k; });

  function swap(lang) {
    const map = lang === 'ar' ? AR : EN;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('script,style,.astrabot-companion,.chatbot-dialog,#chatbotContainer')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (t && map[t]) {
        n.textContent = n.textContent.replace(t, map[t]);
        n.parentElement.setAttribute('dir', 'auto');
      }
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';          // keep the cinematic layout; text flows by itself
    document.body.classList.toggle('is-ar', lang === 'ar');
  }

  // Arabic must be applied BEFORE the home animation splits the headline into letters,
  // so translate right away (this script runs before js/home-cinema.js, a module).
  const saved = (function () { try { return localStorage.getItem('terratwin_lang'); } catch (e) { return null; } })();
  // English only: Arabic switch removed
  // On the home page the AstraBot speech bubble starts folded (robot only) unless the visitor opened it before.
  try { if (localStorage.getItem('astraea_astrabot_collapsed') === null) localStorage.setItem('astraea_astrabot_collapsed', 'true'); } catch (e) {}

  async function start() {
    try { if (window.I18n) await window.I18n.init(); } catch (e) { console.warn(e); }
    const lang = (window.I18n && window.I18n.currentLang) || localStorage.getItem('terratwin_lang') || 'en';
    document.documentElement.dir = 'ltr';   // I18n sets rtl; the cinematic layout is built for ltr
    // switching language later: reload so the animated headline is rebuilt in the new language
    try { window.MissionProfileManager && window.MissionProfileManager.init(); } catch (e) { /* optional */ }
    try { window.UserSystem && window.UserSystem.init(); } catch (e) { /* optional */ }
    try { window.AstraBotGuide && window.AstraBotGuide.init('home'); } catch (e) { console.warn(e); }
    try { window.ScientificChatbot && window.ScientificChatbot.init('home'); } catch (e) { console.warn(e); }
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
