/**
 * Astraea - Professional Space-Agency Researcher Portraits (SVG)
 * Replaces generic emojis with bespoke, realistic space-agency vector portraits.
 * Backward-compatible with legacy emoji values stored in user records.
 */

(function() {
  const LEGACY_MAP = {
    '👨‍🚀': 'astronaut_m',
    '👩‍🚀': 'astronaut_f',
    '👨‍🔬': 'scientist_m',
    '👩‍🔬': 'scientist_f',
    '🧑‍🚀': 'commander',
    '🧑‍🔬': 'geologist',
    '👽': 'scientist_m',
    '🛸': 'geologist'
  };

  const AVATARS = [
    {
      id: 'astronaut_m',
      gender: 'male',
      labelEn: 'EVA Astronaut (M)',
      labelAr: 'رائد فضاء (EVA)',
      accent: '#d9b77e'
    },
    {
      id: 'astronaut_f',
      gender: 'female',
      labelEn: 'EVA Astronaut (F)',
      labelAr: 'رائدة فضاء (EVA)',
      accent: '#e2c492'
    },
    {
      id: 'scientist_m',
      gender: 'male',
      labelEn: 'Astrophysics Lead',
      labelAr: 'باحث فيزياء فلكية',
      accent: '#a0b2cc'
    },
    {
      id: 'scientist_f',
      gender: 'female',
      labelEn: 'Astrobiology Lead',
      labelAr: 'باحثة أحياء فلكية',
      accent: '#10b981'
    },
    {
      id: 'commander',
      gender: 'neutral',
      labelEn: 'Mission Commander',
      labelAr: 'قائد البعثة',
      accent: '#dea062'
    },
    {
      id: 'geologist',
      gender: 'neutral',
      labelEn: 'Planetary Geologist',
      labelAr: 'جيولوجي كوكبي',
      accent: '#a78bfa'
    }
  ];

  let uidCounter = 0;

  function resolveId(val, gender) {
    if (!val) return gender === 'female' ? 'astronaut_f' : 'astronaut_m';
    if (AVATARS.some(a => a.id === val)) return val;
    if (LEGACY_MAP[val]) return LEGACY_MAP[val];
    return gender === 'female' ? 'astronaut_f' : 'astronaut_m';
  }

  function buildPortraitSvg(id, uid) {
    switch (id) {
      case 'astronaut_f':
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0b1b34"/>
              <stop offset="100%" stop-color="#071120"/>
            </linearGradient>
            <linearGradient id="visor_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#e2c492" stop-opacity="0.92"/>
              <stop offset="55%" stop-color="#0369a1" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#0c4a6e"/>
            </linearGradient>
            <linearGradient id="suit_${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e2e8f0"/>
              <stop offset="100%" stop-color="#94a3b8"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#e2c492" stroke-width="1.6"/>
          <path d="M12 60c2-11 10-16 20-16s18 5 20 16" fill="url(#suit_${uid})"/>
          <path d="M21 47h22l-3 7H24z" fill="#0f172a" stroke="#e2c492" stroke-width="0.9"/>
          <circle cx="32" cy="27" r="15.5" fill="#e2e8f0" stroke="#64748b" stroke-width="1.1"/>
          <path d="M20 27c0-7.5 5.3-12 12-12s12 4.5 12 12c0 5.5-4.5 9.5-12 9.5S20 32.5 20 27z" fill="url(#visor_${uid})"/>
          <path d="M23.5 22.5c2.2-2.6 5.5-3.6 9.5-3.2" stroke="#e0f2fe" stroke-width="1.7" stroke-linecap="round" fill="none" opacity="0.85"/>
          <circle cx="28" cy="28" r="1.1" fill="#e0f2fe" opacity="0.55"/>
          <circle cx="36" cy="28" r="1.1" fill="#e0f2fe" opacity="0.55"/>
          <rect x="26.5" y="51" width="11" height="2.4" rx="1.2" fill="#e2c492"/>
          <circle cx="46" cy="27" r="2.2" fill="#0f172a" stroke="#e2c492" stroke-width="1"/>
        `;

      case 'scientist_m':
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0d1b2e"/>
              <stop offset="100%" stop-color="#050b14"/>
            </linearGradient>
            <linearGradient id="skin_${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e7bfa0"/>
              <stop offset="100%" stop-color="#c99573"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#a0b2cc" stroke-width="1.6"/>
          <path d="M11 60c2-11 10-16 21-16s19 5 21 16" fill="#1e293b"/>
          <path d="M22 45l10 14 10-14" fill="#f8fafc" opacity="0.92"/>
          <path d="M29 45l3 11 3-11z" fill="#a0b2cc"/>
          <rect x="28" y="36" width="8" height="9" rx="3" fill="url(#skin_${uid})"/>
          <ellipse cx="32" cy="27" rx="9.5" ry="11.2" fill="url(#skin_${uid})"/>
          <path d="M22.3 25c0-6.5 4.3-10.6 9.7-10.6 5.6 0 9.7 4 9.7 10.2-1.8-2.8-5.1-4.1-9.7-4.1-4.2 0-7.5 1.4-9.7 4.5z" fill="#1e293b"/>
          <rect x="24" y="25.2" width="6.5" height="4.2" rx="1.4" fill="rgba(160, 178, 204,0.18)" stroke="#e2c492" stroke-width="1.1"/>
          <rect x="33.5" y="25.2" width="6.5" height="4.2" rx="1.4" fill="rgba(160, 178, 204,0.18)" stroke="#e2c492" stroke-width="1.1"/>
          <line x1="30.5" y1="27" x2="33.5" y2="27" stroke="#e2c492" stroke-width="1.1"/>
          <path d="M29 33.5c1.8 1 4.2 1 6 0" stroke="#8d5c42" stroke-width="1.3" stroke-linecap="round" fill="none"/>
        `;

      case 'scientist_f':
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#081f24"/>
              <stop offset="100%" stop-color="#050d15"/>
            </linearGradient>
            <linearGradient id="skin_${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#edd0b8"/>
              <stop offset="100%" stop-color="#cfa384"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#10b981" stroke-width="1.6"/>
          <path d="M20 26c0-8.5 5-13.5 12-13.5s12 5 12 13.5c0 8-1.5 15-3.2 18H23.2c-1.7-3-3.2-10-3.2-18z" fill="#1e293b"/>
          <path d="M11 60c2-11 10-16 21-16s19 5 21 16" fill="#0f172a"/>
          <path d="M21 46l11 14 11-14" fill="#e2e8f0"/>
          <rect x="28.5" y="36" width="7" height="9" rx="3" fill="url(#skin_${uid})"/>
          <ellipse cx="32" cy="27.2" rx="8.8" ry="10.5" fill="url(#skin_${uid})"/>
          <path d="M23 24c2-4.5 6-6.2 11.2-5.5 2.7.4 5 2.1 6.6 5.5-2.6-2-5.3-2.9-8.8-2.9-3.6 0-6.5 1-9 2.9z" fill="#1e293b"/>
          <circle cx="28.5" cy="27.5" r="1.15" fill="#1e293b"/>
          <circle cx="35.5" cy="27.5" r="1.15" fill="#1e293b"/>
          <path d="M29.2 33.2c1.7 1 3.9 1 5.6 0" stroke="#9d634a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
          <circle cx="43.5" cy="29" r="2.2" fill="#10b981"/>
          <path d="M43.5 31.2c0 3-2.4 4.2-6 4.4" stroke="#10b981" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        `;

      case 'commander':
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1e1b2e"/>
              <stop offset="100%" stop-color="#090c18"/>
            </linearGradient>
            <linearGradient id="skin_${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#dfb594"/>
              <stop offset="100%" stop-color="#be8b67"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#dea062" stroke-width="1.6"/>
          <path d="M11 60c2-11 10-16 21-16s19 5 21 16" fill="#111827"/>
          <path d="M23 45h18l-2 15H25z" fill="#1e293b"/>
          <rect x="17" y="49" width="6" height="2" rx="1" fill="#dea062"/>
          <rect x="41" y="49" width="6" height="2" rx="1" fill="#dea062"/>
          <polygon points="32,48 34,52 38,52 35,54.5 36,58 32,56 28,58 29,54.5 26,52 30,52" fill="#dea062" opacity="0.9"/>
          <rect x="28" y="36" width="8" height="9" rx="3" fill="url(#skin_${uid})"/>
          <ellipse cx="32" cy="26.5" rx="9.4" ry="10.8" fill="url(#skin_${uid})"/>
          <path d="M22.5 24c.4-6.4 4.5-10 9.5-10 5.3 0 9.2 3.6 9.5 10-2.5-2.6-5.7-3.8-9.5-3.8-3.8 0-7 1.2-9.5 3.8z" fill="#334155"/>
          <path d="M24.5 25.5h15" stroke="#dea062" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>
          <circle cx="28.3" cy="27.8" r="1.15" fill="#0f172a"/>
          <circle cx="35.7" cy="27.8" r="1.15" fill="#0f172a"/>
          <path d="M29 33.4c1.9.8 4.1.8 6 0" stroke="#7c4d34" stroke-width="1.3" stroke-linecap="round" fill="none"/>
        `;

      case 'geologist':
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#191632"/>
              <stop offset="100%" stop-color="#070a15"/>
            </linearGradient>
            <linearGradient id="visor_${uid}" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#a78bfa"/>
              <stop offset="100%" stop-color="#e2c492"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#a78bfa" stroke-width="1.6"/>
          <path d="M11 60c2-11 10-16 21-16s19 5 21 16" fill="#312e81"/>
          <path d="M23 45l9 10 9-10" fill="#1e1b4b" stroke="#a78bfa" stroke-width="1"/>
          <rect x="28" y="36" width="8" height="9" rx="3" fill="#d8ae8e"/>
          <ellipse cx="32" cy="27" rx="9.4" ry="10.8" fill="#dfb799"/>
          <path d="M21 23c1-6.5 5-10 11-10s10 3.5 11 10z" fill="#334155" stroke="#a78bfa" stroke-width="1.1"/>
          <rect x="22.8" y="24" width="18.4" height="5.5" rx="2.7" fill="url(#visor_${uid})" opacity="0.92"/>
          <line x1="25.5" y1="26.5" x2="31.5" y2="26.5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>
          <path d="M29 33.6c1.8.8 4.2.8 6 0" stroke="#80513a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
        `;

      case 'astronaut_m':
      default:
        return `
          <defs>
            <linearGradient id="bg_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#091e32"/>
              <stop offset="100%" stop-color="#050b14"/>
            </linearGradient>
            <linearGradient id="visor_${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.95"/>
              <stop offset="55%" stop-color="#d97706" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#78350f"/>
            </linearGradient>
            <linearGradient id="suit_${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f1f5f9"/>
              <stop offset="100%" stop-color="#94a3b8"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#bg_${uid})" stroke="#d9b77e" stroke-width="1.6"/>
          <path d="M12 60c2-11 10-16 20-16s18 5 20 16" fill="url(#suit_${uid})"/>
          <path d="M21 47h22l-3 7H24z" fill="#0f172a" stroke="#d9b77e" stroke-width="0.9"/>
          <circle cx="32" cy="27" r="15.5" fill="#f1f5f9" stroke="#64748b" stroke-width="1.1"/>
          <path d="M20 27c0-7.5 5.3-12 12-12s12 4.5 12 12c0 5.5-4.5 9.5-12 9.5S20 32.5 20 27z" fill="url(#visor_${uid})"/>
          <path d="M23.5 22.5c2.2-2.6 5.5-3.6 9.5-3.2" stroke="#fef3c7" stroke-width="1.7" stroke-linecap="round" fill="none" opacity="0.88"/>
          <rect x="26.5" y="51" width="11" height="2.4" rx="1.2" fill="#d9b77e"/>
          <circle cx="18" cy="27" r="2.2" fill="#0f172a" stroke="#d9b77e" stroke-width="1"/>
        `;
    }
  }

  function buildPortraitMarkup(id, size, uid) {
    const meta = AVATARS.find(a => a.id === id) || AVATARS[0];
    const safeSize = Math.max(20, Number(size) || 40);
    const fallbackSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 64 64">${buildPortraitSvg(id, uid)}</svg>`
    );
    return `
      <span class="astraea-avatar-frame" data-avatar-role="${id}" style="width:${safeSize}px;height:${safeSize}px;--avatar-accent:${meta.accent};">
        <img
          class="astraea-avatar-img"
          src="assets/avatars/${id}.jpg"
          alt="${meta.labelEn}"
          width="${safeSize}"
          height="${safeSize}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='data:image/svg+xml;charset=utf-8,${fallbackSvg}';"
        />
      </span>
    `.trim();
  }

  function renderSvg(val, size = 40, gender = 'male') {
    const id = resolveId(val, gender);
    uidCounter += 1;
    const uid = 'av' + uidCounter;
    return buildPortraitMarkup(id, size, uid);
  }

  function hydrateDom(root = document) {
    root.querySelectorAll('[data-avatar-id]').forEach(el => {
      const id = el.getAttribute('data-avatar-id');
      const size = Number(el.getAttribute('data-avatar-size')) || 44;
      el.innerHTML = renderSvg(id, size);
    });
  }

  window.AstraeaAvatars = {
    AVATARS,
    resolveId,
    renderSvg,
    renderPortrait: renderSvg,
    hydrateDom
  };
})();
