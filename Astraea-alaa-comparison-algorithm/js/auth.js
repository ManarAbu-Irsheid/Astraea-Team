/**
 * TerraTwin - Authentication Controller (Sign In & Register)
 * Handles in-card smooth 3D tab sliding, bilingual language switching,
 * dark/light themes, persistent user registration & login session management.
 */

// Global Toggle Functions (callable inline from HTML onclick)
window.toggleAuthTheme = function() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('terratwin_theme', next);
  const themeBtn = document.getElementById('authThemeBtn');
  if (themeBtn) {
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
  }
};

window.toggleAuthLanguage = function() {
  const cur = document.documentElement.getAttribute('lang') || 'ar';
  const next = cur === 'ar' ? 'en' : 'ar';
  setLanguage(next);
};

// Main Initialization Function
async function initAuth() {
  // 0. If user already has an active session, skip login/register and enter platform directly
  const allowSwitch = new URLSearchParams(window.location.search).get('switch') === '1';
  if (!allowSwitch) {
    const existingToken = localStorage.getItem('astraea_session_token');
    if (existingToken) {
      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${existingToken}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.success && meData.user) {
            const activeUser = { ...meData.user, isLoggedIn: true };
            localStorage.setItem('terratwin_user_profile', JSON.stringify(activeUser));
            localStorage.setItem('terratwin_auth_active', 'true');
            window.location.replace('index.html');
            return;
          }
        } else if (meRes.status === 401) {
          localStorage.removeItem('astraea_session_token');
          localStorage.removeItem('terratwin_auth_active');
        }
      } catch (e) {
        if (localStorage.getItem('terratwin_auth_active') === 'true') {
          window.location.replace('index.html');
          return;
        }
      }
    } else if (localStorage.getItem('terratwin_auth_active') === 'true' && localStorage.getItem('terratwin_user_profile')) {
      window.location.replace('index.html');
      return;
    }
  }

  // 1. Initialize Theme & Render Professional SVG Avatars
  if (window.AstraeaAvatars) {
    window.AstraeaAvatars.hydrateDom();
  }
  const savedTheme = 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('authThemeBtn');
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  // 2. Initialize Language
  if (window.I18n) {
    try {
      await window.I18n.init();
    } catch (e) {
      console.warn('I18n init error:', e);
    }
  }

  const currentLang = 'en';
  setLanguage(currentLang);

  // 3. Bind Theme and Language Events
  if (themeBtn) {
    themeBtn.onclick = window.toggleAuthTheme;
  }
  const langBtn = document.getElementById('authLangBtn');
  if (langBtn) {
    langBtn.onclick = window.toggleAuthLanguage;
  }

  // 4. In-Card Sliding Tab Navigation (Sign In <-> Register)
  const tabSignIn = document.getElementById('tabBtnSignIn');
  const tabRegister = document.getElementById('tabBtnRegister');
  const linkToRegister = document.getElementById('linkToRegister');
  const linkToLogin = document.getElementById('linkToLogin');

  if (tabSignIn) tabSignIn.addEventListener('click', () => switchToView('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => switchToView('register'));
  if (linkToRegister) linkToRegister.addEventListener('click', (e) => { e.preventDefault(); switchToView('register'); });
  if (linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); switchToView('login'); });

  // Initial tab state from URL or filename
  const isRegPage = window.location.pathname.includes('register') || window.location.hash === '#register';
  switchToView(isRegPage ? 'register' : 'login');

  // 5. Password Visibility Toggles
  const eyeOpenSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const eyeOffSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

  document.querySelectorAll('.auth-password-toggle').forEach(btn => {
    btn.innerHTML = eyeOpenSvg;
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      if (input) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass ? eyeOffSvg : eyeOpenSvg;
      }
    });
  });

  // 6. Handle Sign In Submission
  const signInView = document.getElementById('signInFormView');
  if (signInView) {
    signInView.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const pass = document.getElementById('loginPassword').value;
      const remember = document.getElementById('rememberMeCheckbox')?.checked;

      const result = await performLogin(email, pass, remember);
      if (result.success) {
        showAuthAlert('success', result.message);
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 850);
      } else {
        showAuthAlert('error', result.message);
      }
    });
  }

  // 7. Handle 1-Click Fast Demo Login
  const demoBtn = document.getElementById('quickDemoLoginBtn');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      const result = await performLogin('researcher@terratwin.space', 'demo123', true, true);
      showAuthAlert('success', result.message);
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 750);
    });
  }

  // 8. Handle Registration Submission
  const registerView = document.getElementById('registerFormView');
  if (registerView) {
    registerView.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const role = document.getElementById('regRole').value;
      const avatarRadio = document.querySelector('input[name="userAvatarRadio"]:checked');
      const avatar = avatarRadio ? avatarRadio.value : 'astronaut_m';
      const gender = avatarRadio ? avatarRadio.getAttribute('data-gender') : 'male';

      if (password.length < 4) {
        showAuthAlert('error', isAr ? 'يجب أن تتكون كلمة المرور من 4 خانات على الأقل.' : 'Password must be at least 4 characters.');
        return;
      }

      const result = await performRegistration({
        name,
        email,
        password,
        role,
        avatar,
        gender
      });

      if (result.success) {
        showAuthAlert('success', result.message);
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } else {
        showAuthAlert('error', result.message);
      }
    });
  }

  // 9. Forgot / Reset Password via Email Flow
  const forgotLink = document.getElementById('forgotPassLink');
  const forgotView = document.getElementById('forgotFormView');
  const backFromForgot = document.getElementById('backToSignInFromForgot');
  const forgotEmailInput = document.getElementById('forgotEmailInput');
  const forgotResetFields = document.getElementById('forgotResetFields');
  const forgotCodeBanner = document.getElementById('forgotCodeBanner');
  const forgotSubmitBtnText = document.getElementById('forgotSubmitBtnText');
  const resendForgotCodeBtn = document.getElementById('resendForgotCodeBtn');
  let forgotStep = 'email';

  const resetForgotUI = () => {
    forgotStep = 'email';
    if (forgotResetFields) forgotResetFields.style.display = 'none';
    if (forgotCodeBanner) forgotCodeBanner.style.display = 'none';
    if (resendForgotCodeBtn) resendForgotCodeBtn.style.display = 'none';
    if (forgotEmailInput) forgotEmailInput.readOnly = false;
    const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
    if (forgotSubmitBtnText) {
      forgotSubmitBtnText.textContent = isAr ? 'إرسال رمز التحقق إلى البريد' : 'Send Verification Code';
    }
  };

  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      resetForgotUI();
      const loginEmailVal = document.getElementById('loginEmail')?.value.trim();
      if (loginEmailVal && forgotEmailInput) forgotEmailInput.value = loginEmailVal;
      switchToView('forgot');
    });
  }

  if (backFromForgot) {
    backFromForgot.addEventListener('click', (e) => {
      e.preventDefault();
      resetForgotUI();
      switchToView('login');
    });
  }

  const requestForgotCode = async (email) => {
    const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
    const res = await performForgotPassword(email);
    if (res.success) {
      forgotStep = 'reset';
      if (forgotEmailInput) forgotEmailInput.readOnly = true;
      if (forgotResetFields) forgotResetFields.style.display = 'flex';
      if (resendForgotCodeBtn) resendForgotCodeBtn.style.display = 'block';
      if (forgotSubmitBtnText) {
        forgotSubmitBtnText.textContent = isAr ? 'تأكيد وتغيير كلمة المرور' : 'Verify & Update Password';
      }
      if (forgotCodeBanner) {
        forgotCodeBanner.style.display = 'block';
        const mailSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-inline-end:6px;color:var(--accent-cyan)"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>`;
        forgotCodeBanner.innerHTML = isAr
          ? `${mailSvg}تم إرسال رمز التحقق إلى <span>${email}</span>.<br>رمز التحقق للبريد المحلي: <strong>${res.previewCode}</strong> (صالح لمدة 15 دقيقة)`
          : `${mailSvg}Verification code sent to <span>${email}</span>.<br>Local email verification code: <strong>${res.previewCode}</strong> (valid 15 min)`;
      }
      showAuthAlert('success', isAr ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' : 'Verification code sent to your email.');
    } else {
      showAuthAlert('error', res.message);
    }
  };

  if (resendForgotCodeBtn) {
    resendForgotCodeBtn.addEventListener('click', async () => {
      const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
      if (email) await requestForgotCode(email);
    });
  }

  if (forgotView) {
    forgotView.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
      const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';

      if (forgotStep === 'email') {
        if (!email) {
          showAuthAlert('error', isAr ? 'يرجى إدخال البريد الإلكتروني المسجّل.' : 'Please enter your registered email.');
          return;
        }
        await requestForgotCode(email);
        return;
      }

      const code = document.getElementById('forgotResetCode')?.value.trim() || '';
      const newPassword = document.getElementById('forgotNewPassword')?.value || '';
      const confirmPassword = document.getElementById('forgotConfirmPassword')?.value || '';

      if (!code || code.length < 4) {
        showAuthAlert('error', isAr ? 'يرجى إدخال رمز التحقق المرسل لبريدك.' : 'Please enter the verification code.');
        return;
      }
      if (newPassword.length < 5) {
        showAuthAlert('error', isAr ? 'كلمة المرور الجديدة يجب أن تكون 5 خانات على الأقل.' : 'New password must be at least 5 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showAuthAlert('error', isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
        return;
      }

      const result = await performResetPassword({ email, code, newPassword });
      if (result.success) {
        showAuthAlert('success', result.message);
        const loginEmailEl = document.getElementById('loginEmail');
        const loginPassEl = document.getElementById('loginPassword');
        if (loginEmailEl) loginEmailEl.value = email;
        if (loginPassEl) loginPassEl.value = '';
        setTimeout(() => {
          resetForgotUI();
          switchToView('login');
          showAuthAlert('success', result.message);
        }, 1200);
      } else {
        showAuthAlert('error', result.message);
      }
    });
  }
}

function switchToView(mode) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const cardContainer = document.getElementById('authCardContainer');
  const card = document.querySelector('.auth-card');
  const tabSignIn = document.getElementById('tabBtnSignIn');
  const tabRegister = document.getElementById('tabBtnRegister');
  const navTabs = document.getElementById('authNavTabs');
  const slider = document.getElementById('authTabSlider');
  const signInView = document.getElementById('signInFormView');
  const registerView = document.getElementById('registerFormView');
  const forgotView = document.getElementById('forgotFormView');
  const brandMark = document.getElementById('authBrandMark');

  // 1. Dynamic Card Holographic Laser Wipe & 3D Depth Pulse
  if (card) {
    card.classList.remove('morphing-transition');
    void card.offsetWidth; // Trigger reflow for clean re-trigger
    card.classList.add('morphing-transition');
  }

  // 2. Icon 360° Orbital Flip & Visual Morphing between Planetary Orbit and Star Clearance
  if (brandMark) {
    brandMark.classList.toggle('mode-register', isRegister);
    brandMark.classList.toggle('mode-signin', !isRegister);

    const iconSignin = brandMark.querySelector('.brand-icon-signin');
    const iconRegister = brandMark.querySelector('.brand-icon-register');
    if (iconSignin && iconRegister) {
      if (isRegister) {
        iconSignin.style.display = 'none';
        iconRegister.style.display = 'block';
      } else {
        iconRegister.style.display = 'none';
        iconSignin.style.display = 'block';
      }
    }
  }

  if (cardContainer) {
    cardContainer.classList.toggle('mode-register', isRegister);
  }

  if (navTabs) {
    navTabs.style.display = isForgot ? 'none' : 'grid';
  }

  if (tabSignIn && tabRegister) {
    tabSignIn.classList.toggle('active', !isRegister && !isForgot);
    tabRegister.classList.toggle('active', isRegister);
  }

  if (slider) {
    if (isRegister) {
      slider.style.transform = isAr ? 'translateX(-100%)' : 'translateX(100%)';
    } else {
      slider.style.transform = 'translateX(0)';
    }
  }

  if (signInView && registerView) {
    signInView.classList.remove('active', 'hidden-left', 'hidden-right');
    registerView.classList.remove('active', 'hidden-left', 'hidden-right');
    if (forgotView) forgotView.classList.remove('active', 'hidden-left', 'hidden-right');

    if (isForgot && forgotView) {
      signInView.classList.add('hidden-left');
      registerView.classList.add('hidden-right');
      forgotView.classList.add('active');
    } else if (isRegister) {
      signInView.classList.add('hidden-left');
      registerView.classList.add('active');
      if (forgotView) forgotView.classList.add('hidden-right');
    } else {
      registerView.classList.add('hidden-right');
      signInView.classList.add('active');
      if (forgotView) forgotView.classList.add('hidden-right');
    }
  }

  updateHeaderTexts(mode, isAr);

  const alertBox = document.getElementById('authAlertBox');
  if (alertBox) alertBox.style.display = 'none';

  try {
    const hash = isForgot ? '#forgot' : (isRegister ? '#register' : '#login');
    history.replaceState(null, null, hash);
  } catch (e) {}
}

function setLanguage(lang) {
  const isAr = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  localStorage.setItem('terratwin_lang', lang);

  if (window.I18n) {
    window.I18n.currentLang = lang;
    if (typeof window.I18n.applyLanguage === 'function') {
      window.I18n.applyLanguage(lang, false);
    }
  }

  const langBtn = document.getElementById('authLangBtn');
  if (langBtn) {
    langBtn.textContent = isAr ? 'English' : 'عربي';
  }

  // Update All Elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (window.I18n && typeof window.I18n.t === 'function') {
      const translated = window.I18n.t(key);
      if (translated && translated !== key) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = translated;
        } else {
          el.textContent = translated;
        }
      }
    }
  });

  // Re-align tab slider for RTL/LTR
  const slider = document.getElementById('authTabSlider');
  const isRegister = document.getElementById('tabBtnRegister')?.classList.contains('active');
  const isForgot = document.getElementById('forgotFormView')?.classList.contains('active');
  if (slider) {
    if (isRegister) {
      slider.style.transform = isAr ? 'translateX(-100%)' : 'translateX(100%)';
    } else {
      slider.style.transform = 'translateX(0)';
    }
  }

  // Update Header title & subtitle
  updateHeaderTexts(isForgot ? 'forgot' : (isRegister ? 'register' : 'login'), isAr);
}

function updateHeaderTexts(mode, isAr) {
  const titleEl = document.getElementById('authHeaderTitle');
  const subEl = document.getElementById('authHeaderSub');
  const isRegister = mode === true || mode === 'register';
  const isForgot = mode === 'forgot';

  if (titleEl && subEl) {
    if (isForgot) {
      titleEl.textContent = isAr ? 'استعادة كلمة المرور' : 'Reset Account Password';
      subEl.textContent = isAr ? 'أدخل بريدك الإلكتروني المسجّل لاستلام رمز التحقق وتعيين كلمة مرور جديدة' : 'Enter your registered email to verify your identity and set a new password';
    } else if (isRegister) {
      titleEl.textContent = isAr ? 'إنشاء حساب باحث فلكي' : 'Researcher Account Clearance';
      subEl.textContent = isAr ? 'انضم إلى شبكة Astraea العلمية لاستكشاف ومطابقة تضاريس الكواكب' : 'Join the Astraea scientific network to catalog and match planetary analogs';
    } else {
      titleEl.textContent = isAr ? 'بوابة تسجيل الدخول' : 'Mission Clearance Sign In';
      subEl.textContent = isAr ? 'أدخل معرّفك الفلكي للوصول إلى تحليلات النظائر الكوكبية' : 'Authenticate to access planetary twin telemetry & field catalogs';
    }
  }
}

function showAuthAlert(type, message) {
  const alertBox = document.getElementById('authAlertBox');
  if (!alertBox) return;

  const iconSvg = type === 'success'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  alertBox.className = `auth-alert-box ${type}`;
  alertBox.innerHTML = `${iconSvg} <span>${message}</span>`;
  alertBox.style.display = 'flex';
}

function getStoredUsers() {
  const raw = localStorage.getItem('terratwin_registered_users');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  const defaultList = [
    {
      name: 'Dr. Researcher',
      nameAr: 'د. باحث',
      email: 'researcher@terratwin.space',
      password: 'demo',
      role: 'Astraea Science Team',
      roleAr: 'فريق Astraea العلمي',
      avatar: '👨‍🚀',
      gender: 'male',
      xp: 420,
      visitedPages: ['home', 'finder', 'guide'],
      discoveredSites: ['atacama_yungay', 'antarctica_dryvalleys', 'moon-shackleton'],
      searchesCount: 4,
      comparisonsCount: 2
    }
  ];
  localStorage.setItem('terratwin_registered_users', JSON.stringify(defaultList));
  return defaultList;
}

async function performLogin(email, password, remember, isDemo = false) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';

  // 1. Try real backend API first
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, isDemo, remember })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const user = data.user;
        user.isLoggedIn = true;
        localStorage.setItem('astraea_session_token', data.token || '');
        localStorage.setItem('terratwin_auth_active', 'true');
        localStorage.setItem('terratwin_user_profile', JSON.stringify(user));

        if (window.UserSystem) {
          window.UserSystem.currentUser = user;
          window.UserSystem.renderUserUI();
        }

        return {
          success: true,
          message: isAr 
            ? `أهلاً بك مجدداً يا ${user.nameAr || user.name}! جارٍ توجيهك إلى غرفة القيادة...` 
            : `Welcome back, ${user.name}! Routing to mission observatory...`
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.message && !isDemo) {
        return {
          success: false,
          message: isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : (errData.message || 'Invalid credentials.')
        };
      }
    }
  } catch (err) {
    console.warn('Backend login unavailable, attempting local fallback:', err);
  }

  // 2. Offline / Local fallback
  const users = getStoredUsers();
  let matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (isDemo && !matchedUser) {
    matchedUser = users[0];
  }

  if (matchedUser && (isDemo || matchedUser.password === password)) {
    matchedUser.isLoggedIn = true;
    localStorage.setItem('terratwin_auth_active', 'true');
    localStorage.setItem('terratwin_user_profile', JSON.stringify(matchedUser));

    if (window.UserSystem) {
      window.UserSystem.currentUser = matchedUser;
      window.UserSystem.addXP(25, 'Daily mission clearance access', 'تسجيل دخول علمي يومي');
    }

    return {
      success: true,
      message: isAr 
        ? `أهلاً بك مجدداً يا ${matchedUser.nameAr || matchedUser.name}! جارٍ توجيهك إلى غرفة القيادة...` 
        : `Welcome back, ${matchedUser.name}! Routing to mission observatory...`
    };
  }

  return {
    success: false,
    message: isAr 
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مجدداً.' 
      : 'Invalid email or password. Please verify credentials.'
  };
}

async function performRegistration(data) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';

  // 1. Try real backend API first
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        nameAr: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        avatar: data.avatar,
        gender: data.gender
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.user) {
        const newUser = result.user;
        newUser.isLoggedIn = true;
        localStorage.setItem('astraea_session_token', result.token || '');
        localStorage.setItem('terratwin_auth_active', 'true');
        localStorage.setItem('terratwin_user_profile', JSON.stringify(newUser));

        if (window.UserSystem) {
          window.UserSystem.currentUser = newUser;
          window.UserSystem.renderUserUI();
        }

        return {
          success: true,
          message: isAr 
            ? `تم إنشاء حساب الباحث بنجاح! مرحباً بك في Astraea يا ${newUser.name}.` 
            : `Clearance granted! Welcome to Astraea, ${newUser.name}.`
        };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      if (err.message) {
        return {
          success: false,
          message: isAr ? (err.message.includes('already') ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : err.message) : err.message
        };
      }
    }
  } catch (err) {
    console.warn('Backend register unavailable, attempting local fallback:', err);
  }

  // 2. Offline / Local fallback
  const users = getStoredUsers();
  const exists = users.some(u => u.email.toLowerCase() === data.email.toLowerCase());
  if (exists) {
    return {
      success: false,
      message: isAr ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : 'This email is already registered. Please sign in.'
    };
  }

  const newUser = {
    name: data.name,
    nameAr: data.name,
    email: data.email,
    password: data.password,
    role: data.role || 'Astraea Science Team',
    roleAr: data.role || 'فريق Astraea العلمي',
    avatar: data.avatar || '👨‍🚀',
    gender: data.gender || 'male',
    isLoggedIn: true,
    xp: 200,
    visitedPages: ['home'],
    discoveredSites: ['atacama_yungay', 'antarctica_dryvalleys'],
    searchesCount: 0,
    comparisonsCount: 0,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
  localStorage.setItem('terratwin_auth_active', 'true');
  localStorage.setItem('terratwin_user_profile', JSON.stringify(newUser));

  if (window.UserSystem) {
    window.UserSystem.currentUser = newUser;
  }

  return {
    success: true,
    message: isAr 
      ? `تم إنشاء حساب الباحث بنجاح! مرحباً بك في Astraea يا ${newUser.name}.` 
      : `Clearance granted! Welcome to Astraea, ${newUser.name}.`
  };
}

async function performForgotPassword(email) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        previewCode: data.previewCode,
        email: data.email || email
      };
    }
    return {
      success: false,
      message: isAr
        ? (res.status === 404 ? 'لا يوجد حساب مسجّل بهذا البريد الإلكتروني.' : (data.message || 'تعذر إرسال رمز التحقق.'))
        : (data.message || 'Could not send verification code.')
    };
  } catch (err) {
    // Offline fallback
    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return {
        success: false,
        message: isAr ? 'لا يوجد حساب مسجّل بهذا البريد الإلكتروني.' : 'No account found with this email address.'
      };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
    return { success: true, previewCode: code, email: user.email };
  }
}

async function performResetPassword({ email, code, newPassword }) {
  const isAr = (document.documentElement.getAttribute('lang') || 'ar') === 'ar';
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message: isAr
          ? 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
          : 'Password updated successfully! You can now sign in with your new password.'
      };
    }
    return {
      success: false,
      message: isAr
        ? (data.message && data.message.includes('Invalid verification') ? 'رمز التحقق غير صحيح.' : (data.message || 'تعذر تحديث كلمة المرور.'))
        : (data.message || 'Failed to reset password.')
    };
  } catch (err) {
    // Offline fallback
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1 || users[idx].resetCode !== String(code).trim()) {
      return {
        success: false,
        message: isAr ? 'رمز التحقق غير صحيح أو البريد غير مسجل.' : 'Invalid verification code or email.'
      };
    }
    users[idx].password = newPassword;
    delete users[idx].resetCode;
    localStorage.setItem('terratwin_registered_users', JSON.stringify(users));
    return {
      success: true,
      message: isAr
        ? 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
        : 'Password updated successfully! You can now sign in.'
    };
  }
}

// Start immediately or on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
