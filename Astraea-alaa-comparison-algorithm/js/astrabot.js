/**
 * Astraea - Cute Space Robot Guide Companion (AstraBot)
 * Renders across ALL platform pages alongside the Guide & interactive GuidedTour.
 */

(function() {
  const PAGE_TIPS = {
    home: {
      ar: [
        'أهلاً بك في المرصد الفضائي! أنا أسترا بوت، رفيقك الذكي. اسحب الكوكب ثلاثي الأبعاد لاستكشاف التضاريس، أو ابدأ جولة الدليل!',
        'اضغط على أي نقطة نبضية فوق الكوكب لمعاينة نسبة تطابقها الفيزيائي مع القمر أو المريخ فوراً.',
        'يمكنك تبديل ملف المهمة من الشريط العلوي (Rover أو Landing Site) لمشاهدة تغيّر الحسابات الحقيقي!'
      ],
      en: [
        'Welcome to the Orbital Station! I am AstraBot, your mission guide companion. Rotate the 3D globe or launch the page tour anytime!',
        'Click any pulsing marker on the planet to inspect its physical similarity score against Lunar or Martian targets.',
        'Switch the Mission Profile in the header (Rover, Landing, Thermal) to dynamically recompute match rankings!'
      ]
    },
    finder: {
      ar: [
        'مرحباً في مكتشف المواقع! الدوائر تمثل مواقع معروفة، والنجوم الذهبية تشير لاكتشافات تناظرية جديدة.',
        'جرّب تغيير الهدف الكوكبي أو فلتر التضاريس، وسيرتفع رصيدك البحثي (XP) تلقائياً مع كل بحث!',
        'اضغط على أي موقع على الخريطة لعرض بطاقته الفيزيائية الكاملة والانتقال للمقارنة المباشرة.'
      ],
      en: [
        'Welcome to Site Finder! Circles indicate established analogs while Golden Stars highlight newly discovered candidates.',
        'Try filtering by target body or terrain — every search and analog inspection earns XP for your researcher rank!',
        'Tap any site marker on the map to inspect its terrain card and launch a head-to-head benchmark.'
      ]
    },
    compare: {
      ar: [
        'في ساحة المقارنة هذه نضع الموقع التاريخي وجهاً لوجه مع المرشح الجديد على مخطط الرادار السداسي!',
        'أمانة علمية: نوضح هنا ما تستطيع الأرض محاكاته مقابل القيود الثابتة مثل الجاذبية (0.16G / 0.38G).',
        'اضغط «Export Brief» لتصدير تقرير علمي جاهز للعرض والتحكيم العلمي.'
      ],
      en: [
        'Welcome to the Benchmark Arena! Compare classic NASA analogs side-by-side against newly validated candidates on the radar chart.',
        'Scientific transparency: review what Earth field tests validate versus physical limits like gravity and radiation.',
        'Each comparison updates your scientific profile level and can be exported as a 1-page Executive Brief.'
      ]
    },
    evidence: {
      ar: [
        'هنا توثيق الأدلة العلمية: ترتيب المواقع المعروفة، حالات الفشل المستبعدة بحاجز NDVI، ومصفوفة الحساسية.',
        'كل قياس في أستريا مستخرج من بيانات NASA PDS و ESA Copernicus المفتوحة دون أي أرقام عشوائية.'
      ],
      en: [
        'Welcome to Evidence & Method! Explore how known analogs rank, the failure cases, and the sensitivity matrix.',
        'All measurements in Astraea trace directly to NASA PDS, USGS, and ESA Copernicus open datasets.'
      ]
    },
    guide: {
      ar: [
        'أهلاً بك يا باحث في الدليل الشامل! أنا أسترا بوت، رفيقك الذكي في أهداف المشروع وأخلاقيات العلم المفتوح.',
        'حاجز NDVI (<= 0.20) يضمن استبعاد أي بيئة نباتية لأن أسطح القمر والمريخ غير حيوية كلياً.',
        'اضغط عليّ في أي وقت للحصول على نصيحة جديدة أو لبدء الجولة الإرشادية داخل هذه الصفحة!'
      ],
      en: [
        'Welcome to the Mission Guide! I am AstraBot, your companion for project goals, scientific ethics, and platform walkthroughs.',
        'Our strict Abiotic Gate (NDVI <= 0.20) excludes vegetated terrain because Lunar and Martian surfaces are abiotic.',
        'Click me anytime for a fresh research tip or launch the guided step-by-step tour!'
      ]
    },
    profile: {
      ar: [
        'هنا ملفك البحثي الكامل! يمكنك تحديث اسمك وتخصصك وصورتك الاحترافية وسيتم حفظها فوراً في قاعدة البيانات.',
        'كل بحث أو مقارنة أو اكتشاف لموقع جديد يرفع خبرتك (XP) ويرقّيك عبر مستويات الباحثين الخمسة!'
      ],
      en: [
        'Welcome to your full Researcher Profile! Edits to your portrait, role, and details save permanently to the database.',
        'Searches, comparisons, and newly discovered analog sites advance your rank across Levels 1–5!'
      ]
    }
  };

  function buildRobotSvg(width = 86, height = 100, className = 'astrabot-svg') {
    return `
      <svg class="${className}" width="${width}" height="${height}" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AstraBot Space Robot Guide">
        <line x1="50" y1="22" x2="50" y2="8" stroke="#a0b2cc" stroke-width="3" stroke-linecap="round"/>
        <circle cx="50" cy="7" r="5" fill="#d9b77e" class="antenna-bulb"/>
        <rect x="18" y="32" width="6" height="14" rx="3" fill="#a0b2cc"/>
        <rect x="76" y="32" width="6" height="14" rx="3" fill="#a0b2cc"/>
        <rect x="22" y="20" width="56" height="38" rx="16" fill="#132238" stroke="#a0b2cc" stroke-width="2.5"/>
        <rect x="28" y="26" width="44" height="24" rx="10" fill="#060c18" stroke="#d9b77e" stroke-width="1.5"/>
        <ellipse cx="40" cy="38" rx="4.5" ry="5.5" fill="#d9b77e" class="bot-eye bot-eye-left"/>
        <ellipse cx="60" cy="38" rx="4.5" ry="5.5" fill="#d9b77e" class="bot-eye bot-eye-right"/>
        <circle cx="33" cy="43" r="2.5" fill="rgba(255, 110, 150, 0.55)"/>
        <circle cx="67" cy="43" r="2.5" fill="rgba(255, 110, 150, 0.55)"/>
        <rect x="44" y="58" width="12" height="6" rx="2" fill="#a0b2cc"/>
        <rect x="26" y="64" width="48" height="40" rx="14" fill="#162742" stroke="#a0b2cc" stroke-width="2.5"/>
        <circle cx="50" cy="82" r="11" fill="#0a1728" stroke="#d9b77e" stroke-width="1.5"/>
        <ellipse cx="50" cy="82" rx="10" ry="3.5" stroke="#e2c492" stroke-width="1.2" transform="rotate(-25 50 82)"/>
        <circle cx="50" cy="82" r="4.5" fill="#ffaa00"/>
        <circle cx="36" cy="72" r="1.8" fill="#86c4a0"/>
        <circle cx="41" cy="72" r="1.8" fill="#e2c492"/>
        <circle cx="46" cy="72" r="1.8" fill="#ff5e3a"/>
        <path d="M26 73 C16 78 14 90 20 95 C22 96 26 92 25 88" stroke="#a0b2cc" stroke-width="4" stroke-linecap="round" fill="none" class="bot-arm-left"/>
        <path d="M74 73 C84 75 88 62 82 55" stroke="#a0b2cc" stroke-width="4" stroke-linecap="round" fill="none" class="bot-arm-right"/>
        <path d="M42 104 L58 104 L50 115 Z" fill="#d9b77e" class="bot-thruster-flame"/>
      </svg>
    `.trim();
  }

  const AstraBotGuide = {
    currentPage: 'home',
    tipIndex: 0,
    isCollapsed: false,

    getLang() {
      const lang = window.I18n ? window.I18n.currentLang : (localStorage.getItem('terratwin_lang') || document.documentElement.getAttribute('lang') || 'en');
      return lang === 'ar' ? 'ar' : 'en';
    },

    init(pageName) {
      this.currentPage = pageName || 'home';
      // Collapsed preference persisted across navigation (start expanded on guide page)
      const savedCollapsed = localStorage.getItem('astraea_astrabot_collapsed');
      if (savedCollapsed === null) {
        // Default: only the small robot shows; its tip opens when the visitor clicks it,
        // so the bubble never covers page content uninvited.
        this.isCollapsed = true;
      } else {
        this.isCollapsed = savedCollapsed === 'true';
      }

      this.render();
      this.bindEvents();
      this.watchFooter();
    },

    // Step aside while the page footer is on screen, so the robot never covers its text.
    watchFooter() {
      const foot = document.querySelector('#ftr, footer.site-footer, footer');
      if (!foot || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(([e]) => {
        const el = document.getElementById('astrabotCompanion');
        if (el) el.classList.toggle('astrabot-away', e.isIntersecting);
      }, { threshold: 0.05 }).observe(foot);
    },

    render() {
      let el = document.getElementById('astrabotCompanion');
      const isAr = this.getLang() === 'ar';
      const tips = (PAGE_TIPS[this.currentPage] || PAGE_TIPS.home)[isAr ? 'ar' : 'en'];
      const currentTip = tips[this.tipIndex % tips.length];

      if (!el) {
        el = document.createElement('aside');
        el.id = 'astrabotCompanion';
        el.className = 'astrabot-companion';
        el.setAttribute('aria-label', 'AstraBot Space Guide Companion');
        document.body.appendChild(el);
      }

      el.classList.toggle('collapsed', this.isCollapsed);

      const tourBtnLabel = isAr ? 'جولة الدليل' : 'Page Tour';
      const guideBtnLabel = isAr ? 'الدليل الكامل' : 'Full Guide';
      const nextBtnTitle = isAr ? 'نصيحة تالية' : 'Next tip';
      const minBtnTitle = isAr ? 'تصغير / إخفاء الفقاعة' : 'Minimize bubble';

      el.innerHTML = `
        <div class="astrabot-bubble" id="astrabotSpeechBubble">
          <div class="bubble-header">
            <span class="bot-status-dot"></span>
            <span class="bot-name-tag" id="astrabotNameTag">${isAr ? 'AstraBot // روبوت الدليل الذكي' : 'AstraBot // Mission Guide'}</span>
            <div class="bot-header-controls">
              <button type="button" class="bot-ctrl-btn" id="botTipNextBtn" title="${nextBtnTitle}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button type="button" class="bot-ctrl-btn" id="botMinimizeBtn" title="${minBtnTitle}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>
          <div class="bubble-text" id="astrabotSpeechText">${currentTip}</div>
          <div class="astrabot-quick-bar">
            <button type="button" class="astrabot-action-pill" id="botStartTourBtn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
              <span>${tourBtnLabel}</span>
            </button>
            ${this.currentPage !== 'guide' ? `
              <a href="guide.html" class="astrabot-action-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                <span>${guideBtnLabel}</span>
              </a>
            ` : ''}
          </div>
        </div>
        <div class="astrabot-avatar-wrap" id="astrabotAvatarWrap" title="${isAr ? 'اضغط للتحدث مع أسترا بوت' : 'Click to toggle or talk with AstraBot'}">
          <div class="astrabot-hover-platform"></div>
          <div class="astrabot-figure">${buildRobotSvg(84, 98)}</div>
          <div class="astrabot-badge-tag">AstraBot</div>
        </div>
      `;

      this.bindWidgetListeners();
    },

    setSpeech(text) {
      const bubble = document.getElementById('astrabotSpeechBubble');
      const speechEl = document.getElementById('astrabotSpeechText');
      if (!speechEl) return;
      if (this.isCollapsed) {
        this.isCollapsed = false;
        const wrap = document.getElementById('astrabotCompanion');
        if (wrap) wrap.classList.remove('collapsed');
      }
      if (bubble) {
        bubble.style.opacity = '0.3';
        bubble.style.transform = 'scale(0.97)';
      }
      setTimeout(() => {
        speechEl.textContent = text;
        if (bubble) {
          bubble.style.opacity = '1';
          bubble.style.transform = 'scale(1)';
        }
      }, 120);
    },

    nextTip() {
      const lang = this.getLang();
      const tips = (PAGE_TIPS[this.currentPage] || PAGE_TIPS.home)[lang];
      this.tipIndex = (this.tipIndex + 1) % tips.length;
      this.setSpeech(tips[this.tipIndex]);
    },

    bindWidgetListeners() {
      document.getElementById('astrabotAvatarWrap')?.addEventListener('click', () => {
        if (this.isCollapsed) {
          this.isCollapsed = false;
          localStorage.setItem('astraea_astrabot_collapsed', 'false');
          document.getElementById('astrabotCompanion')?.classList.remove('collapsed');
        } else {
          this.nextTip();
        }
      });

      document.getElementById('botTipNextBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextTip();
      });

      document.getElementById('botMinimizeBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isCollapsed = true;
        localStorage.setItem('astraea_astrabot_collapsed', 'true');
        document.getElementById('astrabotCompanion')?.classList.add('collapsed');
      });

      document.getElementById('botStartTourBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.GuidedTour && typeof window.GuidedTour.startTour === 'function') {
          window.GuidedTour.startTour();
        }
      });
    },

    eventsBound: false,
    bindEvents() {
      if (this.eventsBound) return;
      this.eventsBound = true;

      document.addEventListener('languageChanged', () => {
        this.render();
      });

      document.addEventListener('tourStepChange', (e) => {
        const companion = document.getElementById('astrabotCompanion');
        if (companion) companion.classList.add('tour-active');
        const isAr = this.getLang() === 'ar';
        const stepNum = (e.detail && typeof e.detail.index === 'number') ? e.detail.index + 1 : 1;
        this.setSpeech(
          isAr
            ? `أنت الآن في الخطوة ${stepNum} من الدليل التفاعلي! تابع معي لاكتشاف أدوات هذه الصفحة.`
            : `Step ${stepNum} of the interactive guide! Follow along as we highlight key controls.`
        );
      });

      document.addEventListener('tourEnded', () => {
        const companion = document.getElementById('astrabotCompanion');
        if (companion) companion.classList.remove('tour-active');
      });
    },

    getMiniRobotSvg(width = 46, height = 52) {
      return buildRobotSvg(width, height, 'tour-astrabot-mini');
    }
  };

  window.AstraBotGuide = AstraBotGuide;
})();
