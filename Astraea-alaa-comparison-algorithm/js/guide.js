/**
 * TerraTwin / Astraea - Mission Purpose, Ethics & Guide Controller
 * Includes AstraBot Interactive Companion Mascot
 * Astraea Science Team
 */

const ASTRABOT_TIPS = {
  ar: [
    {
      section: 'general',
      text: 'أهلاً بك يا باحث! أنا أسترا بوت، رفيقك الآلي الذكي في هذا الدليل. اضغط عليّ في أي وقت للحصول على نصائح بحثية!'
    },
    {
      section: 'secPurpose',
      text: 'هدفنا هو مساعدة وكالات الفضاء ورواد المستقبل على اختيار بيئات أرضية مطابقة لتضاريس القمر والمريخ لتفادي فشل المعدات.'
    },
    {
      section: 'secEthics',
      text: 'تنبيه النزاهة العلمية: حاجز NDVI يضمن استبعاد أي منطقة بها نباتات (> 0.20) لأن أسطح القمر والمريخ غير حيوية كلياً.'
    },
    {
      section: 'secPlatformGuide',
      text: 'نصيحة استكشافية: يمكنك البدء بالكرة ثلاثية الأبعاد، ثم الانتقال إلى Site Finder لتصفية المواقع عبر خريطة الأقمار الصناعية.'
    },
    {
      section: 'secMetrics',
      text: 'معاييرنا الفيزيائية الأربعة هي: زاوية الانحدار، الخشونة السطحية، البياض (الألبيدو)، والمدى الحراري اليومي.'
    },
    {
      section: 'secTeam',
      text: 'فريق Astraea صمم هذا النموذج بمعايير عالمية معتمدة على بيانات NASA PDS و ESA Copernicus المفتوحة والنزيهة.'
    }
  ],
  en: [
    {
      section: 'general',
      text: 'Welcome, researcher! I am AstraBot, your smart guide companion. Click me anytime for specialized mission tips!'
    },
    {
      section: 'secPurpose',
      text: 'Our goal is to empower space agencies to simulate rovers and habitats on Earth cells that physically mirror Lunar & Martian conditions.'
    },
    {
      section: 'secEthics',
      text: 'Abiotic Gate: We enforce strict MODIS NDVI filtering (<= 0.20) because the Moon and Mars are strictly barren abiotic environments.'
    },
    {
      section: 'secPlatformGuide',
      text: 'Pro Tip: Use the 3D Planetary Station to pick analog landing pins, then transfer them to the Benchmark Matrix in one click.'
    },
    {
      section: 'secMetrics',
      text: 'The 4 core physical metrics are Topographic Slope, Surface Roughness, Albedo, and Diurnal Thermal Swing.'
    },
    {
      section: 'secTeam',
      text: 'Astraea platform strictly complies with open science directives from NASA PDS, ESA Copernicus, and USGS.'
    }
  ]
};

let currentTipIndex = 0;

function getCurrentLang() {
  return (window.I18n ? window.I18n.currentLang : (document.documentElement.getAttribute('lang') || 'ar')) === 'ar' ? 'ar' : 'en';
}

function updateAstraBotSpeech(tipText) {
  if (window.AstraBotGuide && typeof window.AstraBotGuide.setSpeech === 'function') {
    window.AstraBotGuide.setSpeech(tipText);
    return;
  }
  const bubble = document.getElementById('astrabotSpeechBubble');
  const speechText = document.getElementById('astrabotSpeechText');
  if (!speechText) return;

  if (bubble) {
    bubble.style.opacity = '0';
    bubble.style.transform = 'scale(0.95)';
  }

  setTimeout(() => {
    speechText.textContent = tipText;
    if (bubble) {
      bubble.style.opacity = '1';
      bubble.style.transform = 'scale(1)';
    }
  }, 150);
}

function cycleAstraBotTip() {
  const lang = getCurrentLang();
  const tips = ASTRABOT_TIPS[lang] || ASTRABOT_TIPS.en;
  currentTipIndex = (currentTipIndex + 1) % tips.length;
  updateAstraBotSpeech(tips[currentTipIndex].text);

  // Cheerful bounce animation
  const figure = document.querySelector('.astrabot-figure');
  if (figure) {
    figure.style.animation = 'none';
    void figure.offsetWidth;
    figure.style.animation = 'bot-float 1.2s ease-in-out';
    setTimeout(() => {
      figure.style.animation = 'bot-float 3.5s ease-in-out infinite';
    }, 1200);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Global App Shell (I18n, Theme, User Profile, Kebab 3-Dots Menu, Chatbot, Tour)
  if (window.App) {
    await window.App.init('guide');
  }

  // Record exploration progress
  if (window.UserSystem && typeof window.UserSystem.recordPageVisit === 'function') {
    window.UserSystem.recordPageVisit('guide');
  }

  // Smooth scroll and active state for guide anchor navigation buttons
  const navBtns = document.querySelectorAll('.guide-nav-btn');
  const sections = document.querySelectorAll('.guide-content-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
          navBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      }
    });
  });

  // Highlight active nav item on scroll & inform AstraBot
  let lastSectionId = '';
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 220;
    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navBtns.forEach(b => {
          b.classList.toggle('active', b.getAttribute('href') === `#${id}`);
        });

        // Update AstraBot tip when entering new section
        if (id !== lastSectionId) {
          lastSectionId = id;
          const lang = getCurrentLang();
          const tips = ASTRABOT_TIPS[lang] || ASTRABOT_TIPS.en;
          const found = tips.find(t => t.section === id);
          if (found) {
            updateAstraBotSpeech(found.text);
          }
        }
      }
    });
  }, { passive: true });

  // AstraBot scroll-synced section tips are delegated to AstraBotGuide
  // Wait for language change updates to re-evaluate section context
  document.addEventListener('languageChanged', () => {
    const lang = getCurrentLang();
    const tips = ASTRABOT_TIPS[lang] || ASTRABOT_TIPS.en;
    if (lastSectionId) {
      const found = tips.find(t => t.section === lastSectionId);
      if (found) updateAstraBotSpeech(found.text);
    }
  });
});
