/**
 * TerraTwin - Main Application Shell & Shared Utilities
 * Coordinates theme switching, data fetching, global components, and page lifecycle.
 */

const App = {
  dataCache: {
    cells: null,
    targets: null,
    validation: null,
    locales: null
  },

  async init(pageName) {
    this.initTheme();
    this.highlightActiveNav(pageName);
    this.initUserMenu();
    this.initKebabMenu(pageName);

    // Initialize core persistent systems
    await window.I18n.init();
    window.MissionProfileManager.init();
    if (window.UserSystem) {
      window.UserSystem.init();
      if (typeof window.UserSystem.recordPageVisit === 'function') {
        window.UserSystem.recordPageVisit(pageName);
      }
    }
    if (window.AstraBotGuide && typeof window.AstraBotGuide.init === 'function') {
      window.AstraBotGuide.init(pageName);
    }
    window.GuidedTour.init(pageName);
    window.ScientificChatbot.init(pageName);

    this.bindGlobalEvents();
  },

  initTheme() {
    // Dark only (the light mode switch was removed)
    this.setTheme('dark');

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('terratwin_theme', theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
      themeBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
    const kebabThemeIcon = document.getElementById('kebabThemeIcon');
    const kebabThemeText = document.getElementById('kebabThemeText');
    if (kebabThemeIcon) {
      kebabThemeIcon.innerHTML = theme === 'dark'
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
    if (kebabThemeText) kebabThemeText.textContent = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  },

  initUserMenu() {
    const userBtn = document.getElementById('userProfileBtn');
    const userDropdown = document.getElementById('userProfileDropdown');
    if (!userBtn || !userDropdown) return;

    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = userDropdown.classList.contains('open');
      document.querySelectorAll('.kebab-dropdown-panel, .profile-dropdown-panel').forEach(p => p.classList.remove('open'));
      userDropdown.classList.toggle('open', !isOpen);
      userBtn.classList.toggle('active', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
        userDropdown.classList.remove('open');
        userBtn.classList.remove('active');
      }
    });

    // Update active profile name in user dropdown on profile changes
    document.addEventListener('missionProfileChanged', (e) => {
      const missionEl = document.getElementById('userProfileActiveMission');
      if (missionEl && e.detail && e.detail.profile) {
        missionEl.textContent = window.MissionProfileManager
          ? window.MissionProfileManager.label(e.detail.profile)
          : e.detail.profile;
      }
    });
  },

  initKebabMenu(pageName) {
    const kebabBtn = document.getElementById('kebabMenuBtn');
    const kebabDropdown = document.getElementById('kebabDropdownPanel');
    if (!kebabBtn || !kebabDropdown) return;

    kebabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = kebabDropdown.classList.contains('open');
      document.querySelectorAll('.user-profile-dropdown, .profile-dropdown-panel').forEach(p => p.classList.remove('open'));
      kebabDropdown.classList.toggle('open', !isOpen);
      kebabBtn.classList.toggle('active', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!kebabDropdown.contains(e.target) && !kebabBtn.contains(e.target)) {
        kebabDropdown.classList.remove('open');
        kebabBtn.classList.remove('active');
      }
    });

    // Sub-buttons inside 3-dots kebab menu
    const kebabEthicsGuideBtn = document.getElementById('kebabEthicsGuideBtn');
    if (kebabEthicsGuideBtn) {
      kebabEthicsGuideBtn.addEventListener('click', (e) => {
        kebabDropdown.classList.remove('open');
        window.location.href = 'guide.html';
      });
    }
    const kebabProfileBtn = document.getElementById('kebabProfileBtn');
    if (kebabProfileBtn) {
      kebabProfileBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        window.location.href = 'profile.html';
      });
    }

    const kebabTourBtn = document.getElementById('kebabTourBtn');
    if (kebabTourBtn) {
      kebabTourBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        if (window.GuidedTour) {
          window.GuidedTour.startTour();
        }
      });
    }

    const kebabContactBtn = document.getElementById('kebabContactBtn');
    if (kebabContactBtn) {
      kebabContactBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        if (window.UserSystem) window.UserSystem.openContactModal();
      });
    }

    const kebabChatbotBtn = document.getElementById('kebabChatbotBtn');
    if (kebabChatbotBtn) {
      kebabChatbotBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        const botBtn = document.getElementById('chatbotTriggerBtn');
        if (botBtn) botBtn.click();
      });
    }

    const kebabThemeBtn = document.getElementById('kebabThemeBtn');
    if (kebabThemeBtn) {
      kebabThemeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        kebabDropdown.classList.remove('open');
      });
    }

    const kebabAuthBtn = document.getElementById('kebabAuthBtn');
    if (kebabAuthBtn) {
      kebabAuthBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        if (window.UserSystem) window.UserSystem.openAuthModal();
      });
    }

    const kebabResetWeightsBtn = document.getElementById('kebabResetWeightsBtn');
    if (kebabResetWeightsBtn) {
      kebabResetWeightsBtn.addEventListener('click', () => {
        kebabDropdown.classList.remove('open');
        const resetBtn = document.getElementById('resetWeightsBtn');
        if (resetBtn) resetBtn.click();
      });
    }
  },

  highlightActiveNav(pageName) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const page = link.getAttribute('data-page');
      if (page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  async fetchData(file) {
    if (this.dataCache[file]) return this.dataCache[file];
    try {
      const res = await fetch(`data/${file}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${file}.json`);
      const data = await res.json();
      this.dataCache[file] = data;
      return data;
    } catch (err) {
      if (window.__TERRATWIN_DATA__ && window.__TERRATWIN_DATA__[file]) {
        this.dataCache[file] = window.__TERRATWIN_DATA__[file];
        return this.dataCache[file];
      }
      console.error(`Failed to load data/${file}.json:`, err);
      return null;
    }
  },

  bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('#footerContactModalLink, .footer-contact-modal-btn');
      if (link) {
        e.preventDefault();
        if (window.UserSystem) window.UserSystem.openContactModal();
      }
    });
    // Listen for custom notifications or error toasts if needed
  }
};

window.App = App;
