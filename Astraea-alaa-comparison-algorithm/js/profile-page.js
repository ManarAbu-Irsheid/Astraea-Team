/**
 * Astraea - Full Researcher Profile Page Controller
 * Guards profile access to logged-in users, renders full statistics,
 * professional SVG portraits, rank roadmap, findings log, and backend profile editing.
 */

(function() {
  async function initProfilePage() {
    if (window.App && typeof window.App.init === 'function') {
      await window.App.init('profile');
    }

    // Ensure fresh sync from backend before deciding auth state
    if (window.UserSystem && typeof window.UserSystem.syncFromBackend === 'function') {
      await window.UserSystem.syncFromBackend();
    }

    renderFullProfile();

    document.addEventListener('languageChanged', () => {
      renderFullProfile();
    });

    document.addEventListener('astraea:signedOut', () => {
      renderFullProfile();
    });
  }

  function getLang() {
    return (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
  }

  function renderFullProfile() {
    const isAr = getLang();
    const user = window.UserSystem ? window.UserSystem.currentUser : null;
    const isLoggedIn = !!(user && user.isLoggedIn);

    const gateEl = document.getElementById('profileAuthGate');
    const dashEl = document.getElementById('profileDashboard');

    if (!isLoggedIn) {
      if (gateEl) gateEl.style.display = 'flex';
      if (dashEl) dashEl.style.display = 'none';
      updateGateTexts(isAr);
      return;
    }

    if (gateEl) gateEl.style.display = 'none';
    if (dashEl) dashEl.style.display = 'flex';

    const lvl = window.UserSystem.getCurrentLevel();
    const nextLvl = window.UserSystem.getNextLevel();
    const expPct = window.UserSystem.calculateExplorationProgress();
    const xp = user.xp || 0;
    const lvlPct = lvl.level >= 5
      ? 100
      : Math.min(100, Math.max(0, Math.round(((xp - lvl.minXp) / ((lvl.maxXp - lvl.minXp) || 1)) * 100)));

    // Hero section
    const heroAvatar = document.getElementById('profHeroAvatar');
    if (heroAvatar && window.AstraeaAvatars) {
      heroAvatar.innerHTML = window.AstraeaAvatars.renderSvg(user.avatar, 96, user.gender);
    }

    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText('profHeroName', isAr && user.nameAr ? user.nameAr : (user.name || 'Researcher'));
    setText('profHeroLevelPill', `LVL ${lvl.level} • ${xp} XP`);
    setText('profHeroRole', `${isAr ? lvl.titleAr : lvl.titleEn} — ${user.role || 'Astraea Science Team'}`);
    setText('profHeroEmail', user.email || '');
    setText('profHeroPhone', user.phone ? `• ${user.phone}` : '');

    // Progress bars
    setText('profXpTitle', isAr ? 'مستوى التقدم العلمي (XP)' : 'Scientific Rank Progress (XP)');
    setText('profXpVal', `${xp} XP`);
    const xpBar = document.getElementById('profXpBar');
    if (xpBar) xpBar.style.width = `${lvlPct}%`;
    setText('profXpNextSub', lvl.level >= 5
      ? (isAr ? 'وصلت إلى أعلى رتبة علمية!' : 'Maximum scientific rank achieved!')
      : (isAr ? `الترقية القادمة (${nextLvl.titleAr}): ${nextLvl.minXp} XP` : `Next Rank (${nextLvl.titleEn}): ${nextLvl.minXp} XP`));

    setText('profExpTitle', isAr ? 'نسبة استكشاف المنصة' : 'Platform Exploration Progress');
    setText('profExpVal', `${expPct}%`);
    const expBar = document.getElementById('profExpBar');
    if (expBar) expBar.style.width = `${expPct}%`;
    setText('profExpSub', isAr
      ? `${(user.visitedPages || []).length}/5 أقسام • ${(user.discoveredSites || []).length} نظائر • ${user.searchesCount || 0} بحث`
      : `${(user.visitedPages || []).length}/5 pages • ${(user.discoveredSites || []).length} analogs • ${user.searchesCount || 0} searches`);

    // Stats cards
    setText('statSitesVal', String((user.discoveredSites || []).length));
    setText('statSearchesVal', String(user.searchesCount || 0));
    setText('statComparisonsVal', String(user.comparisonsCount || 0));
    setText('statFindingsVal', String((user.researchFindings || []).length));

    setText('statSitesLbl', isAr ? 'مواقع نظيرة مكتشفة' : 'Discovered Analog Sites');
    setText('statSearchesLbl', isAr ? 'عمليات البحث والاستعلام' : 'Searches & Queries');
    setText('statComparisonsLbl', isAr ? 'مقارنات علمية منجزة' : 'Benchmark Comparisons');
    setText('statFindingsLbl', isAr ? 'تقارير ونتائج محفوظة' : 'Saved Findings');

    // Bilingual section headers & form labels
    const goFinderSpan = document.querySelector('#profGoFinderBtn span');
    if (goFinderSpan) goFinderSpan.textContent = isAr ? 'استكشاف المواقع' : 'Explore Sites';
    setText('profileSignOutText', isAr ? 'تسجيل الخروج' : 'Sign Out');
    setText('profileFormSignOutText', isAr ? 'تسجيل الخروج من الحساب' : 'Sign Out of Account');
    setText('editSectionTitle', isAr ? 'تعديل معلومات الحساب والشخصية' : 'Account Details & Researcher Identity');
    setText('lblAvatarPick', isAr ? 'اختر الشخصية العلمية الاحترافية:' : 'Select Professional Researcher Portrait:');
    setText('lblFullName', isAr ? 'الاسم الكامل للباحث:' : 'Full Name:');
    setText('lblEmail', isAr ? 'البريد الإلكتروني المعتمد:' : 'Official Email:');
    setText('lblPhone', isAr ? 'رقم الهاتف أو المعرّف:' : 'Phone Number:');
    setText('lblRole', isAr ? 'التخصص العلمي:' : 'Specialization:');
    setText('lblBio', isAr ? 'النبذة العلمية والاهتمامات البحثية:' : 'Scientific Bio:');
    setText('profSaveBtn', isAr ? 'حفظ التعديلات في قاعدة البيانات' : 'Save Changes to Account');
    setText('levelsSectionTitle', isAr ? 'مسار الرتب والمستويات (Levels 1–5)' : 'Rank Progression Roadmap (Levels 1–5)');
    setText('findingsSectionTitle', isAr ? 'سجل الاكتشافات والتقارير المحفوظة' : 'Saved Discoveries & Research Findings');

    // Populate Form Inputs
    const nameInput = document.getElementById('profName');
    const emailInput = document.getElementById('profEmail');
    const phoneInput = document.getElementById('profPhone');
    const roleSelect = document.getElementById('profRole');
    const bioInput = document.getElementById('profBio');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (bioInput) bioInput.value = user.bio || '';
    if (roleSelect) {
      const hasOpt = Array.from(roleSelect.options).some(o => o.value === user.role);
      if (!hasOpt && user.role) {
        const opt = document.createElement('option');
        opt.value = user.role;
        opt.textContent = user.role;
        roleSelect.appendChild(opt);
      }
      roleSelect.value = user.role || roleSelect.options[0].value;
    }

    renderAvatarPicker(user, isAr);
    renderLevelsRoadmap(lvl.level, isAr);
    renderFindings(user, isAr);
    bindFormActions(isAr);
  }

  function updateGateTexts(isAr) {
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setText('gateTitle', isAr ? 'الملف الشخصي متاح فقط لأصحاب الحسابات' : 'Profile Requires an Active Account');
    setText('gateDesc', isAr
      ? 'سجّل الدخول أو أنشئ حساب باحث جديد للوصول إلى ملفك الشخصي الكامل، وتتبع مستوياتك واكتشافاتك العلمية المحفوظة.'
      : 'Sign in or create a researcher account to access your full profile, saved edits, level progression, and analog discoveries.');
    setText('gateSignInBtn', isAr ? 'تسجيل الدخول' : 'Sign In');
    setText('gateRegisterBtn', isAr ? 'إنشاء حساب جديد' : 'Create Account');
    setText('gateHomeBtn', isAr ? 'العودة للمنصة' : 'Back to Home');
  }

  function renderAvatarPicker(user, isAr) {
    const grid = document.getElementById('profAvatarGrid');
    if (!grid || !window.AstraeaAvatars) return;

    const currentId = window.AstraeaAvatars.resolveId(user.avatar, user.gender);
    grid.innerHTML = window.AstraeaAvatars.AVATARS.map(av => `
      <label class="profile-avatar-option">
        <input type="radio" name="profAvatarRadio" value="${av.id}" data-gender="${av.gender}" ${av.id === currentId ? 'checked' : ''}>
        <div class="profile-avatar-tile">
          ${window.AstraeaAvatars.renderSvg(av.id, 54, av.gender)}
          <span>${isAr ? av.labelAr : av.labelEn}</span>
        </div>
      </label>
    `).join('');
  }

  function renderLevelsRoadmap(currentLevel, isAr) {
    const container = document.getElementById('levelsRoadmap');
    if (!container || !window.UserSystem) return;

    container.innerHTML = window.UserSystem.LEVELS.map(l => {
      const isCurrent = l.level === currentLevel;
      const isUnlocked = l.level < currentLevel;
      const stateCls = isCurrent ? 'current' : (isUnlocked ? 'unlocked' : '');
      const rangeText = l.maxXp >= 9999 ? `${l.minXp}+ XP` : `${l.minXp}–${l.maxXp} XP`;
      return `
        <div class="level-step-item ${stateCls}">
          <div class="level-step-left">
            <span class="level-step-num">${l.level}</span>
            <span class="level-step-name">${isAr ? l.titleAr : l.titleEn}</span>
          </div>
          <span class="level-step-xp">${rangeText}</span>
        </div>
      `;
    }).join('');
  }

  function renderFindings(user, isAr) {
    const container = document.getElementById('profFindingsList');
    if (!container) return;

    const findings = Array.isArray(user.researchFindings) ? user.researchFindings : [];
    const sites = Array.isArray(user.discoveredSites) ? user.discoveredSites : [];

    if (!findings.length && !sites.length) {
      container.innerHTML = `<div class="finding-card"><span class="finding-target">${isAr ? 'لم يتم تسجيل اكتشافات بعد. استكشف باحث المواقع لرفع مستواك.' : 'No discoveries logged yet. Explore Site Finder to gain XP.'}</span></div>`;
      return;
    }

    const findingCards = findings.map(f => `
      <div class="finding-card">
        <div class="finding-top">
          <span class="finding-name">${isAr && f.siteNameAr ? f.siteNameAr : f.siteName}</span>
          <span class="finding-score">${Number(f.similarity || 88.5).toFixed(1)}%</span>
        </div>
        <div class="finding-target">${isAr && f.targetAr ? f.targetAr : (f.target || 'Planetary Analog Match')}</div>
      </div>
    `).join('');

    const coveredIds = new Set(findings.map(f => f.siteId));
    const extraSites = sites
      .filter(id => !coveredIds.has(id))
      .map(id => `
        <div class="finding-card">
          <div class="finding-top">
            <span class="finding-name">${id}</span>
            <span class="finding-score">+35 XP</span>
          </div>
          <div class="finding-target">${isAr ? 'موقع تناظري مكتشف' : 'Discovered Analog Site'}</div>
        </div>
      `).join('');

    container.innerHTML = findingCards + extraSites;
  }

  let formBound = false;
  function bindFormActions() {
    if (formBound) return;
    formBound = true;

    const handleSignOutClick = async (btn) => {
      if (!window.UserSystem) return;
      if (btn) btn.disabled = true;
      await window.UserSystem.signOut();
      if (btn) btn.disabled = false;
    };

    const signOutBtn = document.getElementById('profileSignOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => handleSignOutClick(signOutBtn));
    }

    const formSignOutBtn = document.getElementById('profileFormSignOutBtn');
    if (formSignOutBtn) {
      formSignOutBtn.addEventListener('click', () => handleSignOutClick(formSignOutBtn));
    }

    const form = document.getElementById('fullProfileForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isAr = getLang();
        const alertBox = document.getElementById('profSaveAlert');
        const showAlert = (type, msg) => {
          if (!alertBox) return;
          alertBox.className = `profile-save-alert ${type}`;
          alertBox.textContent = msg;
        };

        const selectedAvatar = form.querySelector('input[name="profAvatarRadio"]:checked');
        const payload = {
          name: document.getElementById('profName').value.trim(),
          nameAr: document.getElementById('profName').value.trim(),
          email: document.getElementById('profEmail').value.trim(),
          phone: document.getElementById('profPhone').value.trim(),
          role: document.getElementById('profRole').value,
          bio: document.getElementById('profBio').value.trim(),
          avatar: selectedAvatar ? selectedAvatar.value : window.UserSystem.currentUser.avatar,
          gender: selectedAvatar ? (selectedAvatar.getAttribute('data-gender') || 'male') : window.UserSystem.currentUser.gender
        };

        const token = localStorage.getItem('astraea_session_token');
        if (token) {
          try {
            const res = await fetch('/api/user/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              showAlert('error', isAr
                ? (data.message && data.message.includes('already') ? 'هذا البريد الإلكتروني مستخدم في حساب آخر.' : (data.message || 'تعذر حفظ التعديلات.'))
                : (data.message || 'Failed to update profile.'));
              return;
            }
            if (data.success && data.user) {
              window.UserSystem.currentUser = { ...window.UserSystem.currentUser, ...data.user, isLoggedIn: true };
              window.UserSystem.saveUser(false);
              renderFullProfile();
              showAlert('success', isAr ? 'تم حفظ جميع تعديلاتك في قاعدة البيانات بنجاح.' : 'All profile changes saved to database.');
              return;
            }
          } catch (err) {
            console.warn('Profile save offline fallback:', err);
          }
        }

        // Offline local fallback
        const prevEmail = window.UserSystem.currentUser.email;
        window.UserSystem.currentUser = { ...window.UserSystem.currentUser, ...payload, isLoggedIn: true };
        try {
          const raw = localStorage.getItem('terratwin_registered_users');
          if (raw) {
            const users = JSON.parse(raw);
            const idx = users.findIndex(u => u.email && prevEmail && u.email.toLowerCase() === prevEmail.toLowerCase());
            if (idx !== -1) {
              users[idx] = { ...users[idx], ...window.UserSystem.currentUser };
              localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
            }
          }
        } catch (err) {}
        window.UserSystem.saveUser(false);
        renderFullProfile();
        showAlert('success', isAr ? 'تم حفظ تعديلاتك بنجاح.' : 'Profile changes saved.');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initProfilePage);
})();
