/**
 * Astraea - Start Experience Controller
 * Handles cosmic background canvas, persistent authentication session check,
 * user resume display, and bilingual / theme controls.
 */

const START_TRANSLATIONS = {
  ar: {
    'start.tagline': 'ذكاء النظائر الكوكبية',
    'start.mission_status': 'التصريح الميداني: نشط ومتحقق',
    'start.badge': 'المعيار الفيزيائي المعتمد لدى NASA JPL / ESA / JAXA',
    'start.title': 'منصة Astraea للنظائر الكوكبية',
    'start.subtitle': 'بوابتك العلمية المتقدمة لمطابقة تضاريس كوكب الأرض مع أهداف القمر والمريخ بدقة فيزيائية عالية، عبر فحص 421,800 خلية جغرافية وحساب مؤشرات التباين التضاريسي والحراري والجيولوجي.',
    'start.orb_earth': 'الأرض • Terra',
    'start.orb_mars': 'المريخ • Mars',
    'start.orb_moon': 'القمر • Luna',
    'start.welcome_back': 'مرحباً بعودتك إلى غرفة القيادة الفلكية:',
    'start.analogs_discovered': 'نظائر مكتشفة',
    'start.saved_findings': 'تقارير علمية',
    'start.matrices_run': 'مقارنات منجزة',
    'start.platform_exp': 'استكشاف المنصة',
    'start.btn_resume': 'استئناف المهمة والاستكشاف الميداني 🚀',
    'start.btn_switch': 'تبديل الحساب / تسجيل الخروج 🚪',
    'start.card_signin_title': 'تسجيل الدخول للمنصة',
    'start.card_signin_desc': 'لديك حساب باحث مسبق؟ سجّل دخولك للوصول فورياً إلى رتبتك العلمية وتقاريرك وتفضيلاتك المحفوظة.',
    'start.btn_signin': 'تسجيل الدخول 🚀',
    'start.ribbon_recommended': 'موصى به للباحثين ⭐',
    'start.card_reg_title': 'إنشاء حساب باحث جديد',
    'start.card_reg_desc': 'أنشئ ملفك الفلكي لحفظ استكشافاتك تلقائياً، وتوثيق مواقع النظائر التي تعثر عليها، ورفع مستواك العلمي من باحث مستجد إلى كبير علماء.',
    'start.btn_register': 'إنشاء حساب باحث فلكي ✨',
    'start.card_guest_title': 'متابعة كباحث زائر',
    'start.card_guest_desc': 'تخطّ التسجيل واستكشف محطة الكواكب ثلاثية الأبعاد، وخريطة المواقع، ونماذج المقارنة الفيزيائية بحرية.',
    'start.btn_guest': 'تخطي والدخول للمنصة 🔭',
    'start.quick_sectors': 'أقسام المنصة العلمية:',
    'nav.home': 'الرئيسية (3D Explorer)',
    'nav.finder': 'باحث المواقع (Site Finder)',
    'nav.compare': 'المقارنة المعيارية (Compare)',
    'nav.evidence': 'الأدلة والكتالوج (Evidence)',
    'nav.guide': 'الدليل والميثاق (Guide)',
    'start.metric_cells': 'خلايا أرضية مفحوصة',
    'start.metric_recall': 'دقة استدعاء النظائر المعروفة',
    'start.metric_candidates': 'مرشح جديد عالي التطابق',
    'start.metric_abiotic': 'حاجز العزل غير الحيوي الصارم'
  },
  en: {
    'start.tagline': 'Planetary Analog Intelligence',
    'start.mission_status': 'MISSION CLEARANCE: ACTIVE & VERIFIED',
    'start.badge': 'NASA JPL / ESA / JAXA PHYSICAL BENCHMARK SPEC',
    'start.title': 'Astraea Planetary Analog Platform',
    'start.subtitle': 'Your space-agency standard platform comparing Earth terrain cells to Lunar and Martian targets with high physical fidelity across 421,800 scanned candidate cells.',
    'start.orb_earth': 'Earth • Terra',
    'start.orb_mars': 'Mars • Red Planet',
    'start.orb_moon': 'The Moon • Luna',
    'start.welcome_back': 'Welcome back to the Mission Observatory:',
    'start.analogs_discovered': 'Discovered Analogs',
    'start.saved_findings': 'Research Briefs',
    'start.matrices_run': 'Matrices Evaluated',
    'start.platform_exp': 'Platform Exploration',
    'start.btn_resume': 'Resume Active Mission & Exploration 🚀',
    'start.btn_switch': 'Switch Account / Sign Out 🚪',
    'start.card_signin_title': 'Mission Clearance Sign In',
    'start.card_signin_desc': 'Already hold credentials? Authenticate to access your research clearance level, discoveries, and saved matrices.',
    'start.btn_signin': 'Sign In 🚀',
    'start.ribbon_recommended': 'Recommended for Researchers ⭐',
    'start.card_reg_title': 'Create Researcher Account',
    'start.card_reg_desc': 'Establish your clearance profile to persist research discoveries, track XP rank progression from Cadet to Chief Astrobiologist, and save findings.',
    'start.btn_register': 'Create Clearance Profile ✨',
    'start.card_guest_title': 'Continue as Guest Explorer',
    'start.card_guest_desc': 'Bypass authentication and directly explore the 3D planetary observatory, site finder, and physical comparison matrices.',
    'start.btn_guest': 'Skip & Enter Platform 🔭',
    'start.quick_sectors': 'Scientific Observatories:',
    'nav.home': 'Home (3D Station)',
    'nav.finder': 'Site Finder',
    'nav.compare': 'Benchmark Compare',
    'nav.evidence': 'Catalog & Evidence',
    'nav.guide': 'Mission Guide',
    'start.metric_cells': 'Terrestrial Cells Scanned',
    'start.metric_recall': 'Known Analog Recall Rate',
    'start.metric_candidates': 'New High-Fidelity Candidates',
    'start.metric_abiotic': 'Abiotic Gate Filter (NDVI ≤ 0.20)'
  }
};

window.toggleStartTheme = function() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('terratwin_theme', next);
  const btn = document.getElementById('startThemeBtn');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
};

window.toggleStartLanguage = function() {
  const cur = document.documentElement.getAttribute('lang') || 'ar';
  const next = cur === 'ar' ? 'en' : 'ar';
  setStartLanguage(next);
};

function setStartLanguage(lang) {
  const isAr = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  localStorage.setItem('terratwin_lang', lang);

  const btn = document.getElementById('startLangBtn');
  if (btn) btn.textContent = isAr ? 'English' : 'عربي';

  const dict = START_TRANSLATIONS[lang] || START_TRANSLATIONS.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Re-render user card texts if present
  if (window.__CURRENT_USER__) {
    renderUserCard(window.__CURRENT_USER__);
  }
}

// Check User Session from Backend or Local Storage
async function checkUserSession() {
  const token = localStorage.getItem('astraea_session_token');
  const localAuth = localStorage.getItem('terratwin_auth_active') === 'true';
  const rawLocal = localStorage.getItem('terratwin_user_profile');
  const forcePreview = new URLSearchParams(window.location.search).get('preview') === '1';

  let activeUser = null;

  // 1. First try real backend API
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          activeUser = { ...json.user, isLoggedIn: true };
          localStorage.setItem('terratwin_user_profile', JSON.stringify(activeUser));
          localStorage.setItem('terratwin_auth_active', 'true');
        }
      } else if (res.status === 401) {
        localStorage.removeItem('astraea_session_token');
        localStorage.removeItem('terratwin_auth_active');
      }
    } catch (e) {
      console.warn('Backend session fetch error, falling back to local store:', e);
    }
  }

  // 2. Fallback to local profile if authenticated offline (no backend)
  if (!activeUser && !token && localAuth && rawLocal) {
    try {
      const parsed = JSON.parse(rawLocal);
      if (parsed && parsed.isLoggedIn !== false) {
        activeUser = parsed;
      }
    } catch (e) {}
  }

  window.__CURRENT_USER__ = activeUser;

  const userCard = document.getElementById('startUserCard');
  const guestCards = document.getElementById('startGuestCards');

  if (activeUser && activeUser.isLoggedIn !== false) {
    if (!forcePreview) {
      window.location.replace('index.html');
      return;
    }
    if (userCard) userCard.style.display = 'block';
    if (guestCards) guestCards.style.display = 'none';
    renderUserCard(activeUser);
  } else {
    if (userCard) userCard.style.display = 'none';
    if (guestCards) guestCards.style.display = 'grid';
  }
}

function renderUserCard(user) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
  
  const avatarEl = document.getElementById('startUserAvatar');
  if (avatarEl) {
    if (window.AstraeaAvatars) {
      avatarEl.innerHTML = window.AstraeaAvatars.renderSvg(user.avatar, 54, user.gender);
    } else {
      avatarEl.textContent = user.avatar || 'astronaut_m';
    }
  }

  const nameEl = document.getElementById('startUserName');
  if (nameEl) nameEl.textContent = (isAr && user.nameAr) ? user.nameAr : (user.name || 'Commander');

  const roleEl = document.getElementById('startUserRole');
  const lvlObj = user.level || { level: 3, titleEn: 'Analog Specialist', titleAr: 'اختصاصي مواقع شبيهة' };
  const lvlTitle = isAr ? (lvlObj.titleAr || user.roleAr || user.role) : (lvlObj.titleEn || user.role);
  if (roleEl) roleEl.textContent = `${lvlTitle} • LVL ${lvlObj.level || 1}`;

  const lvlNum = document.getElementById('startUserLevelNum');
  if (lvlNum) lvlNum.textContent = `LVL ${lvlObj.level || 1}`;

  const xpEl = document.getElementById('startUserXp');
  if (xpEl) xpEl.textContent = `${user.xp || 200} XP`;

  const sitesCount = (user.discoveredSites || []).length;
  const sitesEl = document.getElementById('startUserSitesCount');
  if (sitesEl) sitesEl.textContent = sitesCount;

  const findingsCount = (user.researchFindings || []).length;
  const findingsEl = document.getElementById('startUserFindingsCount');
  if (findingsEl) findingsEl.textContent = findingsCount;

  const compCount = user.comparisonsCount || 0;
  const compEl = document.getElementById('startUserCompCount');
  if (compEl) compEl.textContent = compCount;

  // Calculate exploration progress
  const visited = (user.visitedPages || []).length;
  const pct = Math.min(100, Math.round((visited / 5) * 30 + (Math.min(16, sitesCount) / 16) * 40 + (Math.min(5, user.searchesCount || 0) / 5) * 15 + (Math.min(5, compCount) / 5) * 15));
  const pctEl = document.getElementById('startUserProgressPct');
  if (pctEl) pctEl.textContent = `${Math.max(15, pct)}%`;

  // Sign out button binding
  const signOutBtn = document.getElementById('startSignOutBtn');
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      const token = localStorage.getItem('astraea_session_token');
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
      }
      localStorage.removeItem('astraea_session_token');
      localStorage.removeItem('terratwin_auth_active');
      if (user) {
        user.isLoggedIn = false;
        localStorage.setItem('terratwin_user_profile', JSON.stringify(user));
      }
      window.__CURRENT_USER__ = null;
      checkUserSession();
    };
  }
}

// Particle Canvas Animation
function initCosmicCanvas() {
  const canvas = document.getElementById('startCosmicCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const stars = [];
  const count = Math.min(150, Math.floor((width * height) / 8000));

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: (Math.random() - 0.5) * 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.speedX;
      s.y += s.speedY;
      s.twinklePhase += s.twinkleSpeed;

      if (s.x < 0) s.x = width;
      if (s.x > width) s.x = 0;
      if (s.y < 0) s.y = height;
      if (s.y > height) s.y = 0;

      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinklePhase));

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      // Subtle cyan/blue glow for larger stars
      if (s.size > 1.6) {
        ctx.fillStyle = `rgba(217, 183, 126, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    requestAnimationFrame(render);
  }

  render();
}

// Initial bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('startThemeBtn');
  if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  const savedLang = 'en';
  setStartLanguage(savedLang);

  initCosmicCanvas();
  checkUserSession();
});
