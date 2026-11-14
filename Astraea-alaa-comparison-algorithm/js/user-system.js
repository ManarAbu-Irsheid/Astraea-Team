/**
 * TerraTwin - User Profile, Authentication, & Gamification Engine
 * Handles:
 * - User Profile (Name, Phone, Email, Gender/Avatar: 👨‍🚀 Male vs 👩‍🚀 Female Astronaut)
 * - Exploration Level & XP System (Gains XP as user explores sites, tests missions, compares analogs)
 * - Auth Modals (Sign In / Sign Up)
 * - Edit Profile Modal
 * - Contact Us Modal
 * - Floating XP Toasts & Level Up Celebrations
 */

const UserSystem = {
  // Level threshold definitions
  LEVELS: [
    { level: 1, minXp: 0, maxXp: 150, titleEn: 'Cadet Explorer', titleAr: 'باحث مستجد' },
    { level: 2, minXp: 151, maxXp: 350, titleEn: 'Planetary Surveyor', titleAr: 'مسّاح كوكبي' },
    { level: 3, minXp: 351, maxXp: 650, titleEn: 'Analog Specialist', titleAr: 'اختصاصي مواقع شبيهة' },
    { level: 4, minXp: 651, maxXp: 1050, titleEn: 'Mission Commander', titleAr: 'قائد استكشاف فضائي' },
    { level: 5, minXp: 1051, maxXp: 9999, titleEn: 'Chief Astrobiologist', titleAr: 'كبير علماء الكواكب' }
  ],

  defaultUser: {
    isLoggedIn: false,
    name: 'Dr. Researcher',
    nameAr: 'د. باحث',
    phone: '+962 7 9000 0000',
    email: 'researcher@astraea.space',
    gender: 'female', // 'male' or 'female'
    avatar: 'astronaut_f',
    xp: 150,
    visitedPages: ['home'],
    discoveredSites: ['atacama_yungay', 'antarctica_dryvalleys'],
    searchesCount: 0,
    comparisonsCount: 0,
    role: 'Astraea Science Team',
    clearance: 'CADET ACCESS'
  },

  currentUser: null,

  init() {
    this.loadUser();
    this.injectModals();
    this.renderUserUI();
    this.bindEvents();
    this.bindEthicsModalEvents();
    this.syncFromBackend();
  },

  async syncFromBackend() {
    const token = localStorage.getItem('astraea_session_token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          this.currentUser = { ...this.currentUser, ...data.user, isLoggedIn: true };
          localStorage.setItem('terratwin_user_profile', JSON.stringify(this.currentUser));
          localStorage.setItem('terratwin_auth_active', 'true');
          this.renderUserUI();
        }
      } else if (res.status === 401) {
        localStorage.removeItem('astraea_session_token');
        localStorage.removeItem('terratwin_auth_active');
        if (this.currentUser) {
          this.currentUser.isLoggedIn = false;
          this.saveUser(false);
        }
      }
    } catch (e) {
      console.warn('Backend sync on load notice:', e);
    }
  },

  loadUser() {
    const isAuthActive = localStorage.getItem('terratwin_auth_active') === 'true';
    const saved = localStorage.getItem('terratwin_user_profile');
    if (saved) {
      try {
        this.currentUser = { ...this.defaultUser, ...JSON.parse(saved) };
      } catch (e) {
        this.currentUser = { ...this.defaultUser };
      }
    } else {
      this.currentUser = { ...this.defaultUser };
      this.saveUser();
    }

    // Gate: User is only authenticated if terratwin_auth_active is explicitly true
    this.currentUser.isLoggedIn = isAuthActive;

    // Load persistent registered data if logged in
    if (isAuthActive && this.currentUser.email) {
      try {
        const raw = localStorage.getItem('terratwin_registered_users');
        if (raw) {
          const users = JSON.parse(raw);
          const found = users.find(u => u.email && u.email.toLowerCase() === this.currentUser.email.toLowerCase());
          if (found) {
            this.currentUser = { ...this.currentUser, ...found, isLoggedIn: true };
          }
        }
      } catch (e) {
        console.warn('Sync registered user profile on load:', e);
      }
    }

    if (!Array.isArray(this.currentUser.visitedPages)) {
      this.currentUser.visitedPages = ['home'];
    }
    if (!Array.isArray(this.currentUser.discoveredSites)) {
      this.currentUser.discoveredSites = ['atacama_yungay', 'antarctica_dryvalleys'];
    }
    if (typeof this.currentUser.searchesCount !== 'number') {
      this.currentUser.searchesCount = 0;
    }
    if (typeof this.currentUser.comparisonsCount !== 'number') {
      this.currentUser.comparisonsCount = 0;
    }
  },

  saveUser(syncBackend = true) {
    localStorage.setItem('terratwin_user_profile', JSON.stringify(this.currentUser));
    if (this.currentUser && this.currentUser.isLoggedIn) {
      localStorage.setItem('terratwin_auth_active', 'true');
    }

    // Synchronize to persistent registered database if present
    try {
      const raw = localStorage.getItem('terratwin_registered_users');
      if (raw && this.currentUser && this.currentUser.email) {
        let users = JSON.parse(raw);
        if (Array.isArray(users)) {
          const idx = users.findIndex(u => u.email && u.email.toLowerCase() === this.currentUser.email.toLowerCase());
          if (idx !== -1) {
            users[idx] = { ...users[idx], ...this.currentUser };
            localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
          }
        }
      }
    } catch (e) {
      console.warn('Sync registered user profile warning:', e);
    }

    // Real backend synchronization
    if (syncBackend && this.currentUser && this.currentUser.isLoggedIn) {
      const token = localStorage.getItem('astraea_session_token');
      if (token) {
        fetch('/api/user/progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            xp: this.currentUser.xp,
            visitedPages: this.currentUser.visitedPages,
            discoveredSites: this.currentUser.discoveredSites,
            searchesCount: this.currentUser.searchesCount,
            comparisonsCount: this.currentUser.comparisonsCount
          })
        }).catch(err => console.warn('Sync progress to backend notice:', err));
      }
    }

    this.renderUserUI();
  },

  calculateExplorationProgress() {
    if (!this.currentUser) return 0;
    const visited = this.currentUser.visitedPages || [];
    const discovered = this.currentUser.discoveredSites || [];
    const searches = this.currentUser.searchesCount || 0;
    const comparisons = this.currentUser.comparisonsCount || 0;

    // 1. Pages exploration (5 total pages: home, finder, compare, evidence, guide) -> up to 30%
    const pageScore = (Math.min(5, visited.length) / 5) * 30;

    // 2. Analog Sites/Pins inspected (up to 16 key sites) -> up to 40%
    const siteScore = (Math.min(16, discovered.length) / 16) * 40;

    // 3. Analytic Searches (target 5 searches for full marks) -> up to 15%
    const searchScore = (Math.min(5, searches) / 5) * 15;

    // 4. Comparative Matrices & Bi-directional models (target 5 runs) -> up to 15%
    const compScore = (Math.min(5, comparisons) / 5) * 15;

    const total = Math.round(pageScore + siteScore + searchScore + compScore);
    return Math.min(100, Math.max(visited.length > 0 ? 8 : 0, total));
  },

  recordPageVisit(pageName) {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return;
    if (!Array.isArray(this.currentUser.visitedPages)) {
      this.currentUser.visitedPages = [];
    }
    if (!this.currentUser.visitedPages.includes(pageName)) {
      this.currentUser.visitedPages.push(pageName);
      this.addXP(25, `Explored sector: ${pageName.toUpperCase()}`, `استكشاف قسم علمي: ${pageName}`);
      this.saveUser();
    }
  },

  recordSearch() {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return;
    this.currentUser.searchesCount = (this.currentUser.searchesCount || 0) + 1;
    this.addXP(10, 'Executed planetary search & criteria filter', 'تنفيذ بحث واستعلام كوكبي جديد');
  },

  recordComparison() {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return;
    this.currentUser.comparisonsCount = (this.currentUser.comparisonsCount || 0) + 1;
    this.addXP(15, 'Executed analog comparative matrix', 'إجراء مقارنة ومصفوفة كوكبية جديدة');
  },

  getCurrentLevel() {
    const xp = this.currentUser.xp || 0;
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (xp >= this.LEVELS[i].minXp) {
        return this.LEVELS[i];
      }
    }
    return this.LEVELS[0];
  },

  getNextLevel() {
    const current = this.getCurrentLevel();
    const next = this.LEVELS.find(l => l.level === current.level + 1);
    return next || current;
  },

  addXP(amount, reasonEn, reasonAr) {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return; // Strict: Gamification XP only for registered logged-in users!
    if (!amount || amount <= 0) return;
    const prevLevel = this.getCurrentLevel().level;
    this.currentUser.xp = (this.currentUser.xp || 0) + amount;
    this.saveUser();

    const newLevel = this.getCurrentLevel().level;
    const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
    const reason = isAr ? (reasonAr || reasonEn) : reasonEn;

    this.showXpToast(amount, reason);

    if (newLevel > prevLevel) {
      this.showLevelUpCelebration(newLevel);
    }
  },

  async discoverSite(siteId, siteName) {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return;
    if (!this.currentUser.discoveredSites) {
      this.currentUser.discoveredSites = [];
    }
    if (!this.currentUser.discoveredSites.includes(siteId)) {
      const prevLevel = this.getCurrentLevel().level;
      this.currentUser.discoveredSites.push(siteId);
      this.currentUser.xp = (this.currentUser.xp || 0) + 35;

      const token = localStorage.getItem('astraea_session_token');
      this.saveUser(!token);

      const newLevel = this.getCurrentLevel().level;
      const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
      this.showXpToast(35, isAr ? `اكتشاف موقع تناظري جديد: ${siteName}` : `Explored new analog site: ${siteName}`);
      if (newLevel > prevLevel) {
        this.showLevelUpCelebration(newLevel);
      }

      if (token) {
        try {
          const res = await fetch('/api/user/discover-site', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              siteId,
              siteName,
              similarity: 88.5
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              this.currentUser = { ...this.currentUser, ...data.user, isLoggedIn: true };
              this.saveUser(false);
            }
          }
        } catch (e) {
          console.warn('Discover site backend sync error:', e);
        }
      }
    }
  },

  showXpToast(amount, reason) {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return; // Do not show toasts to guests
    let container = document.getElementById('xpToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'xpToastContainer';
      container.className = 'xp-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.innerHTML = `
      <div class="xp-toast-badge">+${amount} XP</div>
      <div class="xp-toast-content">
        <span class="xp-toast-icon" style="display:inline-flex;align-items:center;color:var(--accent-cyan);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </span>
        <span class="xp-toast-text">${reason}</span>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  },

  showLevelUpCelebration(levelNumber) {
    if (!this.currentUser || !this.currentUser.isLoggedIn) return; // Do not show celebration to guests
    const lvl = this.LEVELS.find(l => l.level === levelNumber) || this.LEVELS[0];
    const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
    const title = isAr ? lvl.titleAr : lvl.titleEn;

    const overlay = document.createElement('div');
    overlay.className = 'levelup-modal-overlay';
    overlay.innerHTML = `
      <div class="levelup-modal-card">
        <div class="levelup-sparkles" style="display:inline-flex;align-items:center;justify-content:center;color:var(--accent-cyan);">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
        </div>
        <div class="levelup-badge">LEVEL ${lvl.level} REACHED</div>
        <h2 class="levelup-title">${isAr ? 'ترقية علمية جديدة!' : 'Scientific Promotion!'}</h2>
        <div class="levelup-role-name">${title}</div>
        <p class="levelup-desc">
          ${isAr 
            ? 'تهانينا! لقد اكتسبت خبرة ميدانية كوكبية متقدمة تتيح لك فك شفرات معقدة في مطابقة تضاريس القمر والمريخ.'
            : 'Congratulations! You have gained advanced planetary field expertise, unlocking deeper analog telemetry.'}
        </p>
        <button class="levelup-claim-btn" id="claimPromotionBtn">${isAr ? 'متابعة الاستكشاف' : 'Continue Exploration'}</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('claimPromotionBtn').addEventListener('click', () => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 300);
    });
  },

  renderUserUI() {
    const user = this.currentUser;
    const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
    const lvl = this.getCurrentLevel();
    const nextLvl = this.getNextLevel();
    const isLoggedIn = !!(user && user.isLoggedIn);

    // Re-render contact modal in active language
    this.renderContactModal();

    // Manage Navbar Profile Container: Logged In Profile vs Guest Auth Buttons (Sign In + Create Account)
    const profileContainer = document.querySelector('.user-profile-container');
    const profileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('userProfileDropdown');

    let navAuthBtn = document.getElementById('navAuthLoginBtn');
    if (!navAuthBtn && profileContainer) {
      navAuthBtn = document.createElement('a');
      navAuthBtn.id = 'navAuthLoginBtn';
      navAuthBtn.className = 'nav-auth-login-btn';
      navAuthBtn.href = 'login.html';
      profileContainer.appendChild(navAuthBtn);
    }

    let navRegBtn = document.getElementById('navAuthRegisterBtn');
    if (!navRegBtn && profileContainer) {
      navRegBtn = document.createElement('a');
      navRegBtn.id = 'navAuthRegisterBtn';
      navRegBtn.className = 'nav-auth-register-btn';
      navRegBtn.href = 'register.html';
      if (navAuthBtn && navAuthBtn.nextSibling) {
        profileContainer.insertBefore(navRegBtn, navAuthBtn.nextSibling);
      } else {
        profileContainer.appendChild(navRegBtn);
      }
    }

    if (navAuthBtn) {
      const signInLabel = isAr ? 'تسجيل الدخول' : 'Sign In';
      navAuthBtn.innerHTML = `<span class="auth-btn-text">${signInLabel}</span>`;
    }
    if (navRegBtn) {
      const regLabel = isAr ? 'إنشاء حساب' : 'Sign Up';
      navRegBtn.innerHTML = `<span class="auth-btn-text">${regLabel}</span>`;
    }

    // Toggle visibility based on authentication status (Profile & Kebab Profile ONLY for logged-in users)
    const kebabProfileBtn = document.getElementById('kebabProfileBtn');
    const kebabAuthBtn = document.getElementById('kebabAuthBtn');

    if (!isLoggedIn) {
      if (profileBtn) profileBtn.style.setProperty('display', 'none', 'important');
      if (profileDropdown) {
        profileDropdown.style.setProperty('display', 'none', 'important');
        profileDropdown.classList.remove('open');
      }
      if (kebabProfileBtn) kebabProfileBtn.style.setProperty('display', 'none', 'important');
      if (kebabAuthBtn) kebabAuthBtn.style.removeProperty('display');
      if (navAuthBtn) navAuthBtn.style.setProperty('display', 'inline-flex', 'important');
      if (navRegBtn) navRegBtn.style.setProperty('display', 'inline-flex', 'important');
      return;
    } else {
      if (profileBtn) profileBtn.style.setProperty('display', 'flex', 'important');
      if (profileDropdown) profileDropdown.style.removeProperty('display');
      if (kebabProfileBtn) kebabProfileBtn.style.setProperty('display', 'flex', 'important');
      if (kebabAuthBtn) kebabAuthBtn.style.setProperty('display', 'none', 'important');
      if (navAuthBtn) navAuthBtn.style.setProperty('display', 'none', 'important');
      if (navRegBtn) navRegBtn.style.setProperty('display', 'none', 'important');
    }

    // 1. Update Navbar Profile Button for logged-in user
    const avatarBadge = document.querySelector('.user-avatar-badge');
    if (avatarBadge) {
      const avatarHtml = window.AstraeaAvatars
        ? window.AstraeaAvatars.renderSvg(user.avatar, 28, user.gender)
        : (user.avatar || 'astronaut_m');
      avatarBadge.innerHTML = `
        <span class="user-avatar-icon">${avatarHtml}</span>
        <span class="user-status-dot" title="Status: Online"></span>
      `;
    }

    const nameEl = document.querySelector('.user-display-name');
    if (nameEl) {
      nameEl.textContent = isAr && user.nameAr ? user.nameAr : user.name;
    }

    const expProgress = this.calculateExplorationProgress();
    let progressPill = document.querySelector('.user-exploration-pill');
    if (!progressPill) {
      const metaContainer = document.querySelector('.user-meta-text');
      if (metaContainer) {
        progressPill = document.createElement('span');
        progressPill.className = 'user-exploration-pill';
        metaContainer.appendChild(progressPill);
      }
    }
    if (progressPill) {
      progressPill.textContent = `${expProgress}%`;
      progressPill.title = isAr ? `نسبة استكشاف الموقع: ${expProgress}%` : `Exploration Progress: ${expProgress}%`;
    }

    const roleEl = document.querySelector('.user-role-tag');
    if (roleEl) {
      roleEl.textContent = `LVL ${lvl.level} • ${user.role || 'ASTRAEA'}`;
    }

    // 2. Update Profile Dropdown Card
    const dropdownAvatar = document.querySelector('.user-dropdown-avatar');
    if (dropdownAvatar) {
      if (window.AstraeaAvatars) {
        dropdownAvatar.innerHTML = window.AstraeaAvatars.renderSvg(user.avatar, 48, user.gender);
      } else {
        dropdownAvatar.textContent = user.avatar || 'astronaut_m';
      }
    }

    const dropdownName = document.querySelector('.user-dropdown-name');
    if (dropdownName) {
      dropdownName.textContent = isAr && user.nameAr ? user.nameAr : user.name;
    }

    const dropdownRole = document.querySelector('.user-dropdown-role');
    if (dropdownRole) {
      dropdownRole.textContent = isAr ? lvl.titleAr : lvl.titleEn;
    }

    const dropdownEmail = document.querySelector('.user-dropdown-email');
    if (dropdownEmail) {
      dropdownEmail.textContent = user.email;
    }

    // Level & XP Bar in Dropdown
    let xpBlock = document.getElementById('userProfileXpBlock');
    if (!xpBlock) {
      const parent = document.querySelector('.user-profile-dropdown');
      if (parent) {
        xpBlock = document.createElement('div');
        xpBlock.id = 'userProfileXpBlock';
        xpBlock.className = 'user-xp-progress-block';
        
        // Insert before dropdown divider
        const divider = parent.querySelector('.user-dropdown-divider');
        if (divider) {
          parent.insertBefore(xpBlock, divider);
        } else {
          parent.appendChild(xpBlock);
        }
      }
    }

    if (xpBlock) {
      const currentXp = user.xp || 0;
      const progressPercent = Math.min(100, Math.round(((currentXp - lvl.minXp) / ((nextLvl.maxXp - lvl.minXp) || 1)) * 100));
      const expProgress = this.calculateExplorationProgress();
      const visitedCount = (user.visitedPages || []).length;
      const sitesCount = (user.discoveredSites || []).length;
      const searchesCount = user.searchesCount || 0;
      const comparisonsCount = user.comparisonsCount || 0;

      xpBlock.innerHTML = `
        <!-- Platform Exploration & Research Progress Meter -->
        <div class="exploration-progress-panel">
          <div class="exploration-panel-header">
            <span class="exploration-panel-title">
              <span class="exp-icon" style="display:inline-flex;align-items:center;color:var(--accent-cyan);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
              </span>
              <span>${isAr ? 'نسبة استكشاف وبحث الموقع' : 'Exploration & Research Progress'}</span>
            </span>
            <span class="exploration-badge-pct">${expProgress}%</span>
          </div>
          <div class="exploration-bar-track">
            <div class="exploration-bar-fill" style="width: ${expProgress}%;"></div>
          </div>
          <div class="exploration-metrics-grid">
            <div class="exploration-metric-item" title="${isAr ? 'الأقسام والصفحات المستكشفة' : 'Pages Explored'}">
              <span class="exp-metric-icon" style="display:inline-flex;color:var(--accent-blue);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              </span>
              <span class="exp-metric-num">${visitedCount} / 5</span>
              <span class="exp-metric-lbl">${isAr ? 'أقسام' : 'Pages'}</span>
            </div>
            <div class="exploration-metric-item" title="${isAr ? 'المواقع والنظائر المفحوصة' : 'Analogs Inspected'}">
              <span class="exp-metric-icon" style="display:inline-flex;color:var(--accent-cyan);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </span>
              <span class="exp-metric-num">${Math.min(16, sitesCount)} / 16</span>
              <span class="exp-metric-lbl">${isAr ? 'نظائر' : 'Analogs'}</span>
            </div>
            <div class="exploration-metric-item" title="${isAr ? 'استعلامات وبحث فلكي' : 'Searches Executed'}">
              <span class="exp-metric-icon" style="display:inline-flex;color:#e2c492;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <span class="exp-metric-num">${searchesCount}</span>
              <span class="exp-metric-lbl">${isAr ? 'بحث' : 'Searches'}</span>
            </div>
            <div class="exploration-metric-item" title="${isAr ? 'نماذج المقارنة المنجزة' : 'Comparisons Run'}">
              <span class="exp-metric-icon" style="display:inline-flex;color:#10b981;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </span>
              <span class="exp-metric-num">${comparisonsCount}</span>
              <span class="exp-metric-lbl">${isAr ? 'مقارنات' : 'Matrices'}</span>
            </div>
          </div>
        </div>

        <div class="xp-progress-subblock">
          <div class="xp-progress-header">
            <span class="xp-level-tag">LEVEL ${lvl.level}: ${isAr ? lvl.titleAr : lvl.titleEn}</span>
            <span class="xp-score-tag">${currentXp} XP</span>
          </div>
          <div class="xp-bar-track">
            <div class="xp-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
          <div class="xp-stats-footer">
            <span>${isAr ? 'المستوى القادم:' : 'Next Level:'} <strong>${nextLvl.maxXp} XP</strong></span>
            <span>${isAr ? 'الحالة العلمية:' : 'Status:'} <strong style="color:var(--accent-green);">${isAr ? 'نشط' : 'Active'}</strong></span>
          </div>
        </div>
      `;
    }

    // Add Full Profile Button & Sign Out in Dropdown
    let editBtn = document.getElementById('userProfileEditTriggerBtn');
    const profileLabel = isAr ? 'صفحة الملف الشخصي الكاملة' : 'Open Full Profile Page';
    if (!editBtn) {
      const linksContainer = document.querySelector('.user-dropdown-links');
      if (linksContainer) {
        editBtn = document.createElement('button');
        editBtn.id = 'userProfileEditTriggerBtn';
        editBtn.className = 'user-dropdown-action-btn edit-profile';
        editBtn.innerHTML = `<span data-i18n="nav.edit_profile">${profileLabel}</span>`;
        editBtn.addEventListener('click', () => {
          document.querySelectorAll('.user-profile-dropdown').forEach(d => d.classList.remove('open'));
          window.location.href = 'profile.html';
        });
        linksContainer.prepend(editBtn);

        // Sign Out button
        const authBtn = document.createElement('button');
        authBtn.id = 'userProfileAuthTriggerBtn';
        authBtn.className = 'user-dropdown-action-btn auth-toggle';
        authBtn.innerHTML = `<span data-i18n="nav.sign_out">${isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>`;
        authBtn.addEventListener('click', () => {
          document.querySelectorAll('.user-profile-dropdown').forEach(d => d.classList.remove('open'));
          this.signOut();
        });
        linksContainer.appendChild(authBtn);
      }
    } else {
      editBtn.innerHTML = `<span data-i18n="nav.edit_profile">${profileLabel}</span>`;
      const authBtn = document.getElementById('userProfileAuthTriggerBtn');
      if (authBtn) {
        authBtn.innerHTML = `<span data-i18n="nav.sign_out">${isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>`;
      }
    }
  },

  renderContactModal() {
    const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
    const t = (k, fallbackEn, fallbackAr) => {
      if (window.I18n && typeof window.I18n.t === 'function') {
        const val = window.I18n.t(k);
        if (val && val !== k) return val;
      }
      return isAr ? fallbackAr : fallbackEn;
    };

    const titleEl = document.getElementById('contactModalHeaderTitle');
    if (titleEl) titleEl.textContent = t('contact_modal.title', 'Contact Astraea Team', 'تواصل مع فريق أستريا');

    const nameLabel = document.getElementById('contactLabelName');
    if (nameLabel) nameLabel.textContent = t('contact_modal.sender_name', 'Your Name', 'اسمك أو الجهة');
    const nameInput = document.getElementById('contactSenderName');
    if (nameInput) nameInput.placeholder = t('contact_modal.name_placeholder', 'Enter your name', 'أدخل اسمك هنا');

    const emailLabel = document.getElementById('contactLabelEmail');
    if (emailLabel) emailLabel.textContent = t('contact_modal.sender_email', 'Your Email', 'البريد الإلكتروني');
    const emailInput = document.getElementById('contactSenderEmail');
    if (emailInput) emailInput.placeholder = t('contact_modal.email_placeholder', 'name@example.com', 'name@example.com');

    const subjectLabel = document.getElementById('contactLabelSubject');
    if (subjectLabel) subjectLabel.textContent = t('contact_modal.subject_label', 'Subject', 'موضوع الرسالة');

    const subjSelect = document.getElementById('contactMissionSubject');
    if (subjSelect && subjSelect.options) {
      const opts = [
        { val: 'analog_matching', en: 'Planetary Analog Site Inquiries', ar: 'استفسار عن المواقع التناظرية' },
        { val: 'data_partnership', en: 'Data Partnership & Research', ar: 'شراكة بحثية وتبادل بيانات' },
        { val: 'rover_field_testing', en: 'Field Testing & Rover Validation', ar: 'تجارب ميدانية للمركبات' },
        { val: 'general_feedback', en: 'General Feedback & Suggestions', ar: 'ملاحظات واقتراحات عامة' }
      ];
      Array.from(subjSelect.options).forEach((opt, idx) => {
        if (opts[idx]) {
          opt.textContent = isAr ? opts[idx].ar : opts[idx].en;
        }
      });
    }

    const msgLabel = document.getElementById('contactLabelMsg');
    if (msgLabel) msgLabel.textContent = t('contact_modal.message_label', 'Message', 'نص الرسالة');
    const msgInput = document.getElementById('contactSenderMsg');
    if (msgInput) msgInput.placeholder = t('contact_modal.message_placeholder', 'Enter your message here...', 'اكتب رسالتك هنا...');

    const cancelBtn = document.getElementById('cancelContactBtn');
    if (cancelBtn) cancelBtn.textContent = t('contact_modal.btn_close', 'Close', 'إغلاق');

    const submitBtn = document.getElementById('submitContactBtn');
    if (submitBtn) submitBtn.textContent = t('contact_modal.btn_send', 'Send message', 'إرسال الرسالة');
  },

  injectModals() {
    if (document.getElementById('terratwinGlobalModals')) return;

    const modalContainer = document.createElement('div');
    modalContainer.id = 'terratwinGlobalModals';
    modalContainer.innerHTML = `
      <!-- ================================================================
           EDIT PROFILE MODAL (Name, Phone, Email, Gender/Avatar)
           ================================================================ -->
      <div class="custom-modal-overlay" id="editProfileModalOverlay">
        <div class="custom-modal-dialog">
          <div class="custom-modal-header">
            <div class="modal-header-title">
              <span class="modal-icon">👨‍🚀</span>
              <span id="editModalHeaderTitle">Edit Researcher Profile / تعديل الملف الشخصي</span>
            </div>
            <button class="custom-modal-close" id="closeEditProfileModalBtn">✕</button>
          </div>
          
          <form class="custom-modal-body" id="editProfileForm">
            <!-- Avatar & Gender Picker -->
            <div class="form-group-avatar-select">
              <label class="form-label">Researcher Avatar & Identity / الشخصية العلمية ورتبة الباحث:</label>
              <div class="avatar-options-grid">
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="👨‍🚀" data-gender="male">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">👨‍🚀</span>
                    <span class="avatar-desc">رائد فضاء (Male Astronaut)</span>
                  </span>
                </label>
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="👩‍🚀" data-gender="female">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">👩‍🚀</span>
                    <span class="avatar-desc">رائدة فضاء (Female Astronaut)</span>
                  </span>
                </label>
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="👨‍🔬" data-gender="male">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">👨‍🔬</span>
                    <span class="avatar-desc">باحث علمي (Male Scientist)</span>
                  </span>
                </label>
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="👩‍🔬" data-gender="female">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">👩‍🔬</span>
                    <span class="avatar-desc">باحثة علمية (Female Scientist)</span>
                  </span>
                </label>
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="🧑‍🚀" data-gender="neutral">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">🧑‍🚀</span>
                    <span class="avatar-desc">قائد بعثة (Commander)</span>
                  </span>
                </label>
                <label class="avatar-option-card">
                  <input type="radio" name="userAvatarRadio" value="🧑‍🔬" data-gender="neutral">
                  <span class="avatar-card-visual">
                    <span class="avatar-emoji">🧑‍🔬</span>
                    <span class="avatar-desc">جيولوجي كوكبي (Geologist)</span>
                  </span>
                </label>
              </div>
            </div>

            <!-- Name Input -->
            <div class="form-group-field">
              <label class="form-label">Full Name / الاسم الكامل:</label>
              <input type="text" class="custom-modal-input" id="editUserName" required>
            </div>

            <!-- Phone / Researcher ID -->
            <div class="form-group-field">
              <label class="form-label">Phone Number or ID / رقم الهاتف أو المعرّف:</label>
              <input type="tel" class="custom-modal-input" id="editUserPhone" placeholder="+962 7 9000 0000">
            </div>

            <!-- Email -->
            <div class="form-group-field">
              <label class="form-label">Official Email / البريد الإلكتروني:</label>
              <input type="email" class="custom-modal-input" id="editUserEmail" required>
            </div>

            <div class="custom-modal-footer">
              <button type="button" class="btn-modal-cancel" id="cancelEditProfileBtn">إلغاء / Cancel</button>
              <button type="submit" class="btn-modal-submit">حفظ التعديلات / Save Profile 💾</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ================================================================
           SIGN IN / CREATE ACCOUNT MODAL
           ================================================================ -->
      <div class="custom-modal-overlay" id="authModalOverlay">
        <div class="custom-modal-dialog">
          <div class="custom-modal-header">
            <div class="modal-header-title">
              <span>Astraea Planetary Clearance / بوابة تسجيل الدخول</span>
            </div>
            <button class="custom-modal-close" id="closeAuthModalBtn">✕</button>
          </div>

          <div class="auth-tabs-nav">
            <button class="auth-tab-btn active" id="authTabSignIn">تسجيل الدخول (Sign In)</button>
            <button class="auth-tab-btn" id="authTabSignUp">إنشاء حساب باحث (Register)</button>
          </div>

          <!-- Sign In Form -->
          <form class="custom-modal-body" id="signInForm">
            <div class="form-group-field">
              <label class="form-label">Email or Researcher ID / البريد أو المعرّف:</label>
              <input type="text" class="custom-modal-input" id="signInEmail" placeholder="researcher@astraea.space" required>
            </div>
            <div class="form-group-field">
              <label class="form-label">Password / كلمة المرور:</label>
              <input type="password" class="custom-modal-input" id="signInPass" placeholder="••••••••" required>
            </div>
            <div class="custom-modal-footer">
              <button type="button" class="btn-modal-cancel" id="cancelAuthBtn">إلغاء</button>
              <button type="submit" class="btn-modal-submit">دخول المنصة / Sign In 🚀</button>
            </div>
          </form>

          <!-- Sign Up Form -->
          <form class="custom-modal-body" id="signUpForm" style="display:none;">
            <div class="form-group-field">
              <label class="form-label">Full Name / الاسم الكامل:</label>
              <input type="text" class="custom-modal-input" id="signUpName" placeholder="Dr. Sarah Connor" required>
            </div>
            <div class="form-group-field">
              <label class="form-label">Gender & Avatar / رتبة الفضائي:</label>
              <div class="signup-avatar-toggle">
                <label class="signup-avatar-pill">
                  <input type="radio" name="signUpAvatarRadio" value="👩‍🚀" data-gender="female" checked>
                  <span>👩‍🚀 أنثى فضائية (Female)</span>
                </label>
                <label class="signup-avatar-pill">
                  <input type="radio" name="signUpAvatarRadio" value="👨‍🚀" data-gender="male">
                  <span>👨‍🚀 ذكر فضائي (Male)</span>
                </label>
              </div>
            </div>
            <div class="form-group-field">
              <label class="form-label">Phone / رقم الهاتف:</label>
              <input type="tel" class="custom-modal-input" id="signUpPhone" placeholder="+962 7 9999 8888">
            </div>
            <div class="form-group-field">
              <label class="form-label">Email / البريد الإلكتروني:</label>
              <input type="email" class="custom-modal-input" id="signUpEmail" placeholder="new.researcher@astraea.space" required>
            </div>
            <div class="form-group-field">
              <label class="form-label">Password / كلمة المرور:</label>
              <input type="password" class="custom-modal-input" id="signUpPass" placeholder="••••••••" required>
            </div>
            <div class="custom-modal-footer">
              <button type="button" class="btn-modal-cancel" id="cancelSignUpBtn">إلغاء</button>
              <button type="submit" class="btn-modal-submit">إنشاء الحساب وبدء الاستكشاف 🌟</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ================================================================
           CONTACT US MODAL
           ================================================================ -->
      <div class="custom-modal-overlay" id="contactModalOverlay">
        <div class="custom-modal-dialog">
          <div class="custom-modal-header">
            <div class="modal-header-title">
              <span class="modal-icon">📬</span>
              <span id="contactModalHeaderTitle" data-i18n="contact_modal.title">Contact Astraea Team</span>
            </div>
            <button class="custom-modal-close" id="closeContactModalBtn" aria-label="Close">✕</button>
          </div>

          <form class="custom-modal-body" id="contactTransmissionForm">
            <div class="form-group-field">
              <label class="form-label" id="contactLabelName" for="contactSenderName" data-i18n="contact_modal.sender_name">Your Name</label>
              <input type="text" class="custom-modal-input" id="contactSenderName" data-i18n-placeholder="contact_modal.name_placeholder" placeholder="Enter your name" required>
            </div>
            <div class="form-group-field">
              <label class="form-label" id="contactLabelEmail" for="contactSenderEmail" data-i18n="contact_modal.sender_email">Your Email</label>
              <input type="email" class="custom-modal-input" id="contactSenderEmail" data-i18n-placeholder="contact_modal.email_placeholder" placeholder="name@example.com" required>
            </div>
            <div class="form-group-field">
              <label class="form-label" id="contactLabelSubject" for="contactMissionSubject" data-i18n="contact_modal.subject_label">Subject</label>
              <select class="custom-modal-input" id="contactMissionSubject">
                <option value="analog_matching" data-i18n="contact_modal.subj_analog">Planetary Analog Site Inquiries</option>
                <option value="data_partnership" data-i18n="contact_modal.subj_data">Data Partnership & Research</option>
                <option value="rover_field_testing" data-i18n="contact_modal.subj_rover">Field Testing & Rover Validation</option>
                <option value="general_feedback" data-i18n="contact_modal.subj_general">General Feedback & Suggestions</option>
              </select>
            </div>
            <div class="form-group-field">
              <label class="form-label" id="contactLabelMsg" for="contactSenderMsg" data-i18n="contact_modal.message_label">Message</label>
              <textarea class="custom-modal-input" id="contactSenderMsg" rows="4" data-i18n-placeholder="contact_modal.message_placeholder" placeholder="Enter your message here..." required></textarea>
            </div>

            <div class="custom-modal-footer">
              <button type="button" class="btn-modal-cancel" id="cancelContactBtn" data-i18n="contact_modal.btn_close">Close</button>
              <button type="submit" class="btn-modal-submit" id="submitContactBtn" data-i18n="contact_modal.btn_send">Send message</button>
            </div>
          </form>
        </div>
      </div>
    
      <!-- ================================================================
           MISSION PURPOSE, SCIENTIFIC ETHICS & USER GUIDE MODAL
           ================================================================ -->
      <div class="custom-modal-overlay" id="ethicsGuideModalOverlay">
        <div class="custom-modal-dialog" style="max-width: 820px; max-height: 88vh; display: flex; flex-direction: column;">
          <div class="custom-modal-header" style="border-bottom: 1px solid rgba(160, 178, 204, 0.3); padding-bottom: 0.8rem;">
            <div class="custom-modal-title" style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.4rem;">📜</span>
              <div>
                <div style="font-family: 'Orbitron', 'Alexandria', sans-serif; font-size: 1.15rem; color: #fff;">
                  TerraTwin // Mission Purpose, Ethics & Guide
                </div>
                <div style="font-size: 0.78rem; color: var(--accent-blue); font-weight: 500;">
                  أهداف المشروع والأخلاقيات العلمية ودليل الاستخدام
                </div>
              </div>
            </div>
            <button class="custom-modal-close" id="closeEthicsGuideModalBtn">&times;</button>
          </div>

          <!-- Modal Navigation Tabs -->
          <div class="ethics-tabs-nav" style="display: flex; gap: 0.5rem; background: rgba(0, 20, 45, 0.6); padding: 0.4rem; border-radius: 8px; margin: 1rem 0 0.5rem 0; border: 1px solid rgba(255,255,255,0.08);">
            <button class="ethics-tab-btn active" data-tab="purpose" style="flex: 1; padding: 0.55rem 0.8rem; border-radius: 6px; background: var(--accent-blue); color: #fff; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
              🎯 لماذا أنشأنا المشروع وهدفه
            </button>
            <button class="ethics-tab-btn" data-tab="ethics" style="flex: 1; padding: 0.55rem 0.8rem; border-radius: 6px; background: transparent; color: var(--text-secondary); border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              ⚖️ الأخلاقيات ومعايير النزاهة
            </button>
            <button class="ethics-tab-btn" data-tab="guide" style="flex: 1; padding: 0.55rem 0.8rem; border-radius: 6px; background: transparent; color: var(--text-secondary); border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              🧭 دليل وتعليمات الاستخدام
            </button>
          </div>

          <!-- Modal Scrollable Content Container -->
          <div class="custom-modal-body" style="overflow-y: auto; padding-right: 0.4rem; flex: 1;">
            
            <!-- TAB 1: PURPOSE -->
            <div class="ethics-tab-content active" id="tabContent_purpose">
              <div class="ethics-section-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(160, 178, 204,0.2); border-radius: 8px; padding: 1.1rem; margin-bottom: 1rem;">
                <h4 style="color: #e2c492; font-size: 1.05rem; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
                  <span>🚀</span> التحدي الاستكشافي: لماذا نحتاج نظائر كوكبية على الأرض؟
                </h4>
                <p style="font-size: 0.88rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 0.8rem;">
                  مهمات استكشاف الفضاء الكبرى — مثل برنامج <strong>أرتميس (Artemis)</strong> التابع لوكالة ناسا لإنشاء قواعد دائمة عند القطب الجنوبي للقمر، ومهمات إرسال الروفرات ورواد الفضاء إلى المريخ — تكلف مليارات الدولارات وسنوات طويلة من العمل الدقيق. إن إرسال مركبات أو بدلات فضاء إلى بيئات قاسية مجهولة دون اختبار مسبق في بيئات أرضية تشبهها فيزيائياً يُعد خطراً هندسياً وعلمياً جسيماً.
                </p>
                <p style="font-size: 0.88rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 0;">
                  تاريخياً، كان اختيار "النظائر الأرضية" (Earth Analogs) يتم بشكل يدوي أو وصفي تقديري يفتقر للمطابقة الرقمية المتعددة المعايير، مما يؤدي إلى مفاجآت تضاريسية قد تُعطل عجلات الروفرات أو تعيق حركة رواد الفضاء.
                </p>
              </div>

              <div class="ethics-section-card" style="background: rgba(217, 183, 126,0.03); border: 1px solid rgba(217, 183, 126,0.25); border-radius: 8px; padding: 1.1rem;">
                <h4 style="color: #d9b77e; font-size: 1.05rem; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
                  <span>🎯</span> الهدف الجوهري لمنصة TerraTwin:
                </h4>
                <ul style="font-size: 0.88rem; line-height: 1.8; color: var(--text-secondary); padding-right: 1.2rem; margin-bottom: 0;">
                  <li><strong>المطابقة الفيزيائية الدقيقة:</strong> دمج قياسات أقمار رصد الأرض (NASA MODIS, NASADEM, SRTM, Sentinel-2) مع قياسات المسابر الكوكبية المدارية (LRO LOLA, Diviner, MGS MOLA) في نموذج رياضي موحد.</li>
                  <li><strong>محاكاة واختبار الروبوتات والأنظمة:</strong> تمكين مهندسي وكالات الفضاء من اختبار أنظمة الملاحة الذاتية، ومقاومة عجلات المركبات للتضاريس الصخرية، واختبار البدلات الفضائية في بيئات مطابقة 100%.</li>
                  <li><strong>تقليل التكاليف والمخاطر:</strong> تحديد المواقع الأرضية المثالية بأعلى نسب تشابه رياضي موثق لمنع فشل المعدات الفضائية باهظة الثمن قبل مغادرتها الغلاف الجوي.</li>
                </ul>
              </div>
            </div>

            <!-- TAB 2: ETHICS & DATA INTEGRITY -->
            <div class="ethics-tab-content" id="tabContent_ethics" style="display: none;">
              <div class="ethics-section-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(224,86,56,0.25); border-radius: 8px; padding: 1.1rem; margin-bottom: 1rem;">
                <h4 style="color: #ff7043; font-size: 1.05rem; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
                  <span>🛡️</span> حاجز العزل غير الحيوي (Physical Abiotic Gate via MODIS NDVI):
                </h4>
                <p style="font-size: 0.88rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 0.6rem;">
                  سطح القمر والمريخ خامل كلياً وخالٍ من الغطاء النباتي (NDVI = 0.000). لضمان النزاهة العلمية وتفادي أي نتائج مضللة، تطبق المنصة <strong>حاجز تصفية صارم</strong> (Strict Hard Gate) يستبعد فوراً وبشكل تلقائي أي موقع أرضي يتجاوز مؤشر غطائه الحيوي العتبة الفيزيائية:
                </p>
                <div style="background: rgba(0,0,0,0.4); padding: 0.6rem 0.9rem; border-radius: 6px; font-family: monospace; color: #ff7043; font-size: 0.85rem; border-left: 3px solid #ff7043; margin-bottom: 0.6rem;">
                  NDVI_Threshold ≤ 0.20 (Barren Abiotic Surface Filter)
                </div>
                <p style="font-size: 0.84rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 0;">
                  هذا الحاجز يضمن استبعاد الغابات الاستوائية والمدن الخرسانية والمناطق الزراعية كلياً وفقاً للفيزياء دون أي تحيز أو تلاعب بالبيانات.
                </p>
              </div>

              <div class="ethics-section-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(160, 178, 204,0.2); border-radius: 8px; padding: 1.1rem; margin-bottom: 1rem;">
                <h4 style="color: #e2c492; font-size: 1.05rem; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
                  <span>📊</span> النزاهة والبيانات المفتوحة (Open Science & Zero Fabrication):
                </h4>
                <ul style="font-size: 0.88rem; line-height: 1.8; color: var(--text-secondary); padding-right: 1.2rem; margin-bottom: 0;">
                  <li><strong>مصداقية المصادر:</strong> 100% من القياسات الفيزيائية (الانحدار، الخشونة، البياض، التباين الحراري) مستخرجة من مستودعات مفتوحة ومراجعة علمياً تابعة لـ NASA PDS و ESA Copernicus و USGS.</li>
                  <li><strong>لا توجد أرقام عشوائية أو تخيلية:</strong> كل نسبة مئوية محسوبة عبر خوارزميات إحصائية موحدة تعتمد على المئين الراداري (Percentile Ranking) لمنع انحياز مقاييس الدقة المكانية.</li>
                </ul>
              </div>

              <div class="ethics-section-card" style="background: rgba(134, 196, 160,0.03); border: 1px solid rgba(134, 196, 160,0.25); border-radius: 8px; padding: 1.1rem;">
                <h4 style="color: #86c4a0; font-size: 1.05rem; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
                  <span>🌿</span> المسؤولية البيئية وحماية نظائر الأرض (Environmental Stewardship):
                </h4>
                <p style="font-size: 0.88rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 0;">
                  ندعو كافة البعثات التناظرية والفرق البحثية الميدانية إلى احترام البيئات الصحراوية والبركانية والقطبية الفريدة على كوكب الأرض، والالتزام الصارم بمبادئ عدم ترك أثر (Leave No Trace) وحماية المجتمعات المحلية في مناطق الاستكشاف.
                </p>
              </div>
            </div>

            <!-- TAB 3: OPERATING GUIDE -->
            <div class="ethics-tab-content" id="tabContent_guide" style="display: none;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem;">
                
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                  <div style="font-weight: 700; color: #fff; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>1️⃣</span> الصفحة الرئيسية والكرة ثلاثية الأبعاد
                  </div>
                  <p style="font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 0;">
                    اسحبي الكرة بالماوس للتدوير 360°، استخدمي عجلة التكبير للتقريب، واضغطي على أي نقطة نبضية (Pin) لعرض بيانات الموقع التليمترية ونسبة مطابقته فورياً. بدّلي بين الأرض، المريخ، والقمر من الأزرار العلوية.
                  </p>
                </div>

                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                  <div style="font-weight: 700; color: #fff; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>2️⃣</span> خريطة الأماكن المشابهة (Site Finder)
                  </div>
                  <p style="font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 0;">
                    خريطة أقمار صناعية عالية الدقة من ناسا و ESRI. يمكنكِ تصفية المواقع حسب التضاريس (صحراوي، بركاني، قطبي)، وتتبع إشارات السونار النبضية مع نسب التشابه فوق كل موقع تضاريسي.
                  </p>
                </div>

                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                  <div style="font-weight: 700; color: #fff; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>3️⃣</span> المقارنة المعيارية (Compare Sites)
                  </div>
                  <p style="font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 0;">
                    اختاري أي هدف كوكبي وقارنيه مباشرة مع نظيره الأرضي عبر مخطط الرادار السداسي، مع إمكانية تعديل أوزان المعايير الفيزيائية (الانحدار، الخشونة، البياض، الحرارة) لمعاينة التغير الفوري.
                  </p>
                </div>

                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                  <div style="font-weight: 700; color: #fff; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>4️⃣</span> الأدلة والكتالوج وتصدير PDF (Evidence)
                  </div>
                  <p style="font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 0;">
                    تحتوي على كتالوج الـ 53 موقعاً كاملاً، مع إمكانية تشغيل الشرح العلمي، وتصدير التقارير العلمية الرسمية بصيغة PDF لتقديمها مباشرة لفرق ومهندسي المهمات.
                  </p>
                </div>

              </div>

              <!-- Bonus: Level & XP Tip -->
              <div style="background: rgba(160, 178, 204,0.06); border: 1px solid rgba(160, 178, 204,0.3); border-radius: 8px; padding: 0.8rem 1rem; display: flex; align-items: center; gap: 0.8rem;">
                <span style="font-size: 1.6rem;">⭐</span>
                <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                  <strong>نظام رتبة الباحث الاستكشافي:</strong> يرتفع مستواكِ في البروفايل تدريجياً (+35 XP) كلما تفاعلتِ مع الخريطة، أو استكشفتِ مواقع جديدة، أو قمتِ بتشغيل مقارنات معيارية!
                </div>
              </div>

            </div>

          </div>

          <div class="custom-modal-footer" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.8rem; margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">
              TERRATWIN-CORE-SPEC // VERIFIED NASA/ESA STANDARDS
            </div>
            <button type="button" class="btn-modal-cancel" id="finishEthicsGuideBtn" style="padding: 0.45rem 1.4rem;">فهمت ذلك / Close Guide</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalContainer);
  },

  bindEvents() {
    // Edit Profile Modal Bindings
    const editForm = document.getElementById('editProfileForm');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedRadio = editForm.querySelector('input[name="userAvatarRadio"]:checked');
        const nextAvatar = selectedRadio ? selectedRadio.value : this.currentUser.avatar;
        const nextGender = selectedRadio ? (selectedRadio.getAttribute('data-gender') || 'male') : this.currentUser.gender;
        const nextName = document.getElementById('editUserName').value.trim();
        const nextPhone = document.getElementById('editUserPhone').value.trim();
        const nextEmail = document.getElementById('editUserEmail').value.trim();
        const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';

        const token = localStorage.getItem('astraea_session_token');
        if (token) {
          try {
            const res = await fetch('/api/user/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: nextName,
                nameAr: nextName,
                phone: nextPhone,
                email: nextEmail,
                avatar: nextAvatar,
                gender: nextGender,
                role: this.currentUser.role
              })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              alert(isAr
                ? (data.message && data.message.includes('already') ? 'هذا البريد الإلكتروني مستخدم في حساب آخر.' : (data.message || 'تعذر حفظ التعديلات.'))
                : (data.message || 'Failed to save profile changes.'));
              return;
            }
            if (data.success && data.user) {
              this.currentUser = { ...this.currentUser, ...data.user, isLoggedIn: true };
              this.saveUser(false);
              this.closeModals();
              this.showXpToast(15, isAr ? 'تم حفظ تعديلات حسابك بنجاح!' : 'Profile changes saved to your account!');
              return;
            }
          } catch (err) {
            console.warn('Backend profile update fallback to local:', err);
          }
        }

        // Offline / local fallback (update old email entry in local registered list too)
        const prevEmail = this.currentUser.email;
        this.currentUser.avatar = nextAvatar;
        this.currentUser.gender = nextGender;
        this.currentUser.name = nextName;
        this.currentUser.nameAr = nextName;
        this.currentUser.phone = nextPhone;
        this.currentUser.email = nextEmail;

        try {
          const raw = localStorage.getItem('terratwin_registered_users');
          if (raw) {
            const users = JSON.parse(raw);
            const idx = users.findIndex(u => u.email && prevEmail && u.email.toLowerCase() === prevEmail.toLowerCase());
            if (idx !== -1) {
              users[idx] = { ...users[idx], ...this.currentUser };
              localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
            }
          }
        } catch (err) {}

        this.saveUser(false);
        this.closeModals();
        this.showXpToast(15, isAr ? 'تم حفظ تعديلات حسابك بنجاح!' : 'Profile changes saved!');
      });
    }

    // Modal Close buttons
    ['closeEditProfileModalBtn', 'cancelEditProfileBtn', 'closeAuthModalBtn', 'cancelAuthBtn', 'cancelSignUpBtn', 'closeContactModalBtn', 'cancelContactBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this.closeModals());
    });

    // Outside click to close
    document.querySelectorAll('.custom-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModals();
      });
    });

    // Auth Tabs Switching
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const formSignIn = document.getElementById('signInForm');
    const formSignUp = document.getElementById('signUpForm');

    if (tabSignIn && tabSignUp && formSignIn && formSignUp) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        formSignIn.style.display = 'flex';
        formSignUp.style.display = 'none';
      });

      tabSignUp.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        formSignUp.style.display = 'flex';
        formSignIn.style.display = 'none';
      });

      // Sign In Action
      formSignIn.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signInEmail').value.trim();
        this.currentUser.email = email;
        this.currentUser.isLoggedIn = true;
        this.saveUser();
        this.closeModals();
        this.showXpToast(25, 'Welcome back, Commander! / أهلاً بعودتك أيها القائد');
      });

      // Sign Up Action
      formSignUp.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signUpName').value.trim();
        const email = document.getElementById('signUpEmail').value.trim();
        const phone = document.getElementById('signUpPhone').value.trim();
        const radio = formSignUp.querySelector('input[name="signUpAvatarRadio"]:checked');

        this.currentUser.name = name;
        this.currentUser.nameAr = name;
        this.currentUser.email = email;
        this.currentUser.phone = phone;
        this.currentUser.avatar = radio ? radio.value : '👩‍🚀';
        this.currentUser.gender = radio ? radio.getAttribute('data-gender') : 'female';
        this.currentUser.isLoggedIn = true;
        this.currentUser.xp = 150; // Welcome XP

        this.saveUser();
        this.closeModals();
        this.showXpToast(50, 'Researcher Account Activated! (+50 XP)');
      });
    }

    // Contact Form Action
    const contactForm = document.getElementById('contactTransmissionForm');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = (document.getElementById('contactSenderName')?.value || '').trim();
        const email = (document.getElementById('contactSenderEmail')?.value || '').trim();
        const subjectSelect = document.getElementById('contactMissionSubject');
        const subjectText = subjectSelect ? (subjectSelect.options[subjectSelect.selectedIndex]?.text || subjectSelect.value) : 'Message';
        const message = (document.getElementById('contactSenderMsg')?.value || '').trim();

        const mailSubject = subjectText;
        const mailBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
        const mailtoUrl = `mailto:astraeateam45@gmail.com?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

        window.location.href = mailtoUrl;
        this.closeModals();

        const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
        const noticeText = isAr
          ? 'فُتح تطبيق البريد والرسالة جاهزة للإرسال.'
          : 'Your email app has opened with the message ready to send.';
        alert(noticeText);
      });
    }
  },

  openEditProfileModal() {
    window.location.href = 'profile.html';
  },

  openAuthModal() {
    window.location.href = 'login.html';
  },

  async signOut() {
    const token = localStorage.getItem('astraea_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn('Backend sign out notice:', err);
      }
    }
    localStorage.removeItem('astraea_session_token');
    localStorage.removeItem('terratwin_auth_active');
    this.currentUser = { ...this.defaultUser, isLoggedIn: false };
    this.saveUser(false);
    this.renderUserUI();

    document.dispatchEvent(new CustomEvent('astraea:signedOut'));
    window.dispatchEvent(new CustomEvent('astraea:signedOut'));

    const isAr = (window.I18n ? window.I18n.currentLang : 'en') === 'ar';
    this.showGuestStatusToast(isAr ? 'تم تسجيل الخروج بنجاح. يمكنك تسجيل الدخول أو إنشاء حساب جديد في أي وقت.' : 'Signed out successfully. Sign In & Create Account buttons are now active.');
  },

  showGuestStatusToast(message) {
    let container = document.getElementById('xpToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'xpToastContainer';
      container.className = 'xp-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.innerHTML = `
      <div class="xp-toast-badge">SESSION</div>
      <div class="xp-toast-content">
        <span class="xp-toast-icon" style="display:inline-flex;align-items:center;color:var(--accent-cyan);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </span>
        <span class="xp-toast-text">${message}</span>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    }, 3600);
  },

  openContactModal() {
    this.injectModals();
    this.renderContactModal();
    const user = this.currentUser;
    const nameInput = document.getElementById('contactSenderName');
    const emailInput = document.getElementById('contactSenderEmail');

    if (nameInput && user && user.name) nameInput.value = user.name;
    if (emailInput && user && user.email) emailInput.value = user.email;

    const overlay = document.getElementById('contactModalOverlay');
    if (overlay) overlay.classList.add('active');
  },

  closeModals() {
    document.querySelectorAll('.custom-modal-overlay').forEach(m => m.classList.remove('active'));
  },

  openEthicsGuideModal() {
    window.location.href = 'guide.html';
  },

  bindEthicsModalEvents() {
    const overlay = document.getElementById('ethicsGuideModalOverlay');
    const closeBtn = document.getElementById('closeEthicsGuideModalBtn');
    const finishBtn = document.getElementById('finishEthicsGuideBtn');

    const closeModal = () => {
      if (overlay) overlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (finishBtn) finishBtn.addEventListener('click', closeModal);

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Tab buttons handling
    const tabBtns = document.querySelectorAll('.ethics-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent-blue)';
        btn.style.color = '#fff';

        document.querySelectorAll('.ethics-tab-content').forEach(c => {
          c.style.display = 'none';
        });
        const activeContent = document.getElementById('tabContent_' + targetTab);
        if (activeContent) activeContent.style.display = 'block';
      });
    });
  },

};

// Expose UserSystem globally
window.UserSystem = UserSystem;

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UserSystem.init());
} else {
  UserSystem.init();
}

// Re-render UI on language change event
document.addEventListener('languageChanged', () => {
  if (window.UserSystem) {
    window.UserSystem.renderUserUI();
  }
});
