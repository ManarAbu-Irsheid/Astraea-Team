/**
 * TerraTwin AI - assistant UI + conversation logic.
 *
 * Every answer comes from the local TerraTwin catalog: js/rag-engine.js retrieves entries from
 * data/terratwin-knowledge.json + data/terratwin-platform-guide.json and the matching entries
 * are shown with their sources. No external service is called.
 *
 * Routing per message:
 *   terratwin           -> catalog answer + sources list
 *   greeting / general  -> polite scope reply + 3 example questions
 *
 * Layout (a03279a): 520px dialog, compact collapsible suggested questions (4 / 8) that hide
 * once the chat starts, no category filter bar.
 */
(function (global) {
  'use strict';

  const SS_CHAT = 'terratwin_chat_v3';  // v3: catalog-only answers (older AI-era history is ignored)
  const SS_OPEN = 'terratwin_chat_open';
  const MAX_STORED = 40;
  const MAX_MESSAGE = 2000;

  const ssGet = (k) => { try { return global.sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { global.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ------------------------------------------------------------------ *
   * Markdown (safe: everything is escaped first)
   * ------------------------------------------------------------------ */
  function renderInline(text) {
    const codes = [];
    // Some models write citations as 【1】; show them like [1].
    let s = escapeHtml(String(text).replace(/【(\d{1,2})(?:†[^】]*)?】/g, '[$1]')).replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\[(\d{1,2})\]/g, '<sup class="chat-cite">[$1]</sup>');
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code class="chat-code">${codes[+i]}</code>`);
  }

  function renderMarkdown(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const out = [];
    let para = [];
    const flush = () => { if (para.length) { out.push(`<p>${para.map(renderInline).join('<br>')}</p>`); para = []; } };
    const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
      if (fence) {
        flush();
        const lang = fence[1] || '';
        const code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        out.push(`<div class="chat-pre" dir="ltr"><div class="chat-pre-head"><span>${escapeHtml(lang || 'code')}</span><button type="button" class="chat-copy-btn">Copy</button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        continue;
      }
      const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
      if (h) { flush(); out.push(`<h4 class="chat-h">${renderInline(h[2])}</h4>`); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); out.push('<hr class="chat-hr">'); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        out.push(`<div class="chat-table-wrap"><table class="chat-table"><thead><tr>${head.map(c => `<th>${renderInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^\s*[-*•]\s+/.test(line)) {
        flush();
        const items = [];
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++; }
        out.push(`<ul>${items.map(t => `<li>${renderInline(t)}</li>`).join('')}</ul>`);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        flush();
        const items = [];
        const start = parseInt(line.trim(), 10) || 1;
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out.push(`<ol start="${start}">${items.map(t => `<li>${renderInline(t)}</li>`).join('')}</ol>`);
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      para.push(line);
      i++;
    }
    flush();
    return out.join('');
  }

  /* ------------------------------------------------------------------ *
   * UI strings
   * ------------------------------------------------------------------ */
  const STR = {
    en: {
      subtitle: 'Planetary Intelligence Assistant',
      placeholder: 'Ask about TerraTwin: sites, Moon and Mars targets, data, method, pages...',
      send: 'Send', clear: 'Clear Chat', minimize: 'Minimize', close: 'Close',
      suggested: 'Suggested Questions', more: 'More Questions ▾', less: 'Show Less ▴',
      welcomeTitle: 'Welcome to TerraTwin AI',
      welcomeDesc: 'Ask me about TerraTwin: its Earth analog sites, Moon and Mars targets, similarity rankings, data sources, method and pages. Every answer comes from the TerraTwin catalog, with its sources.',
      thinking: 'Searching the TerraTwin catalog...',
      tooLong: (n) => `Your message is too long. Please keep it under ${n} characters.`,
      sourcesLabel: 'TerraTwin sources used:',
      copied: 'Copied',
      status: 'TerraTwin catalog',
      footer: 'Answers from the TerraTwin catalog',
      footerMode: 'CATALOG',
      badge: { instant: 'TERRATWIN', catalog: 'CATALOG DATA', notice: 'NOTICE', user: 'YOU' },
      scope: 'I answer questions about TerraTwin: its sites, Moon and Mars targets, data, method and pages.',
      examplesLabel: 'For example, you can ask:',
      examples: ['Which Earth sites best match Jezero Crater?', 'What is the ROC AUC of TerraTwin?', 'How does the NDVI gate filter vegetation and cities?']
    },
    ar: {
      subtitle: 'المساعد العلمي الذكي للكواكب',
      placeholder: 'اسأل عن TerraTwin: المواقع، أهداف القمر والمريخ، البيانات، المنهجية، الصفحات...',
      send: 'إرسال', clear: 'مسح المحادثة', minimize: 'تصغير', close: 'إغلاق',
      suggested: 'الأسئلة المقترحة', more: 'المزيد من الأسئلة ▾', less: 'عرض أقل ▴',
      welcomeTitle: 'أهلاً بك في TerraTwin AI',
      welcomeDesc: 'اسألني عن TerraTwin: المواقع الأرضية النظيرة، وأهداف القمر والمريخ، وترتيب التشابه، ومصادر البيانات، والمنهجية، وصفحات المنصة. كل إجابة مأخوذة من كتالوج TerraTwin مع ذكر مصادرها.',
      thinking: 'جارٍ البحث في كتالوج TerraTwin...',
      tooLong: (n) => `رسالتك طويلة جداً. يرجى ألا تتجاوز ${n} حرف.`,
      sourcesLabel: 'مصادر TerraTwin المستخدمة:',
      copied: 'تم النسخ',
      status: 'كتالوج TerraTwin',
      footer: 'الإجابات من كتالوج TerraTwin',
      footerMode: 'الكتالوج',
      badge: { instant: 'TERRATWIN', catalog: 'بيانات الكتالوج', notice: 'تنبيه', user: 'أنت' },
      scope: 'أجيب عن الأسئلة المتعلقة بمنصة TerraTwin: مواقعها، وأهداف القمر والمريخ، والبيانات، والمنهجية، والصفحات.',
      examplesLabel: 'على سبيل المثال، يمكنك أن تسأل:',
      examples: ['ما المواقع الأرضية الأكثر تطابقاً مع فوهة جيزيرو؟', 'ما قيمة ROC AUC في TerraTwin؟', 'كيف تحجب بوابة NDVI الغطاء النباتي والمدن؟']
    }
  };

  const GREETINGS = {
    en: {
      salam: 'Wa alaikum assalam!', hello: 'Hello!', morning: 'Good morning!', evening: 'Good evening!',
      howareyou: "I'm doing well, thank you for asking!", thanks: "You're very welcome - happy to help!",
      bye: 'Goodbye! Come back any time.',
      who: "I'm **TerraTwin AI**, the assistant built into this website."
    },
    ar: {
      salam: 'وعليكم السلام ورحمة الله وبركاته!', hello: 'أهلاً وسهلاً!', morning: 'صباح النور!', evening: 'مساء النور!',
      howareyou: 'بخير والحمد لله، شكراً لسؤالك!', thanks: 'عفواً، يسعدني ذلك دائماً!',
      bye: 'مع السلامة! أهلاً بك في أي وقت.',
      who: 'أنا **TerraTwin AI**، المساعد المدمج في هذا الموقع.'
    }
  };

  /* ------------------------------------------------------------------ *
   * Suggested questions (verified against the knowledge base)
   * ------------------------------------------------------------------ */
  const PAGE_PROMPTS = {
    home: [
      { q_en: 'What makes Mafraq (Jordan) match Jezero by 95.76%?', q_ar: 'ما الذي جعل المفرق في الأردن يطابق جيزيرو بنسبة 95.76%؟', icon: '⭐' },
      { q_en: 'How similar is the Atacama Desert (Yungay) to Jezero?', q_ar: 'ما مدى تشابه صحراء أتاكاما (يونغاي) مع جيزيرو؟', icon: '🪐' }
    ],
    finder: [
      { q_en: 'What is the best Earth analog for Shackleton Crater?', q_ar: 'ما هو أفضل نظير أرضي لفوهة شاكلتون؟', icon: '⭐' },
      { q_en: 'How do I use the Site Finder?', q_ar: 'كيف أستخدم مستكشف المواقع؟', icon: '🔍' }
    ],
    compare: [
      { q_en: 'What are the main similarities and differences between these two sites?', q_ar: 'ما أوجه التشابه والاختلاف الرئيسية بين هذين الموقعين؟', icon: '⭐' },
      { q_en: 'Why can Earth sites never simulate lunar gravity or radiation?', q_ar: 'لماذا تعجز المواقع الأرضية عن محاكاة جاذبية القمر أو الإشعاع؟', icon: '🌙' }
    ],
    evidence: [
      { q_en: 'Why was Medicine Lake Volcano rejected?', q_ar: 'لماذا تم استبعاد بركان ميديسين ليك؟', icon: '⭐' },
      { q_en: 'Which satellite datasets does TerraTwin use?', q_ar: 'ما هي بيانات الأقمار الاصطناعية التي تستخدمها TerraTwin؟', icon: '🛰️' }
    ],
    guide: [
      { q_en: 'How does the two-stage pipeline evaluate analogs?', q_ar: 'كيف تقيّم خوارزمية المرحلتين المواقع النظيرة؟', icon: '⭐' },
      { q_en: 'What is TerraTwin?', q_ar: 'ما هي TerraTwin؟', icon: '🛰️' }
    ]
  };
  const PROMPT_POOL = [
    { q_en: 'What is TerraTwin?', q_ar: 'ما هي TerraTwin؟', icon: '🛰️' },
    { q_en: 'How does the NDVI gate filter vegetation and cities?', q_ar: 'كيف تحجب بوابة NDVI الغطاء النباتي والمدن؟', icon: '📊' },
    { q_en: 'Compare the Atacama Desert (Yungay) and Mafraq for Mars testing.', q_ar: 'قارن بين صحراء أتاكاما (يونغاي) والمفرق لاختبارات المريخ.', icon: '⚖️' },
    { q_en: 'What is the Mahalanobis distance in TerraTwin?', q_ar: 'ما هي مسافة ماهالانوبيس في TerraTwin؟', icon: '🧠' },
    { q_en: 'What is the ROC AUC of TerraTwin?', q_ar: 'ما قيمة ROC AUC في TerraTwin؟', icon: '📈' },
    { q_en: 'Which Earth sites best match Jezero Crater?', q_ar: 'ما المواقع الأرضية الأكثر تطابقاً مع فوهة جيزيرو؟', icon: '🔴' },
    { q_en: 'Which Earth locations resemble Martian terrain?', q_ar: 'ما المواقع الأرضية التي تشبه تضاريس المريخ؟', icon: '🌍' },
    { q_en: 'Why can Earth sites never simulate lunar gravity or radiation?', q_ar: 'لماذا تعجز المواقع الأرضية عن محاكاة جاذبية القمر أو الإشعاع؟', icon: '🌙' }
  ];

  const ICON_GLOBE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3.6 9h16.8"></path><path d="M3.6 15h16.8"></path><path d="M11.5 3a17 17 0 0 0 0 18"></path><path d="M12.5 3a17 17 0 0 1 0 18"></path></svg>';
  const ICON_AVATAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line></svg>';
  const ICON_SEND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  const ICON_STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';

  /* ------------------------------------------------------------------ *
   * Chatbot
   * ------------------------------------------------------------------ */
  const TerraTwinAIChatbot = {
    currentPage: 'home',
    isOpen: false,
    isSuggestionsExpanded: false,
    hasStartedChatting: false,
    busy: false,
    messages: [],       // {id, role, content, lang, mode, sources, time}
    lastAnalysis: null,
    _seq: 0,

    get RAG() { return global.TerraTwinRAG; },
    uiLang() { return (global.I18n && global.I18n.currentLang === 'ar') ? 'ar' : 'en'; },
    t(lang) { return STR[lang === 'ar' ? 'ar' : 'en']; },

    /* ---------------------------------------------------- lifecycle */
    init(pageName = 'home') {
      this.currentPage = pageName;
      this.restore();
      this.renderWidget();
      this.bindGlobalEvents();
      if (this.RAG) this.RAG.init();
      if (ssGet(SS_OPEN) === '1') this.openDialog(false);
      this.removeLegacyServiceWorker();
    },

    /** The earlier in-browser model build registered terratwin-llm-sw.js; it is no longer used. */
    removeLegacyServiceWorker() {
      try {
        if (!global.navigator || !global.navigator.serviceWorker || !global.navigator.serviceWorker.getRegistrations) return;
        global.navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => {
          const url = (r.active || r.waiting || r.installing || {}).scriptURL || '';
          if (/terratwin-llm-sw\.js$/.test(url)) r.unregister();
        })).catch(() => {});
      } catch (e) { /* ignore */ }
    },

    restore() {
      try {
        const saved = JSON.parse(ssGet(SS_CHAT) || 'null');
        if (saved && Array.isArray(saved.messages)) {
          this.messages = saved.messages;
          this.lastAnalysis = saved.lastAnalysis || null;
          this._seq = this.messages.reduce((mx, m) => Math.max(mx, m.id || 0), 0);
        }
      } catch (e) { this.messages = []; }
      this.hasStartedChatting = this.messages.length > 0;
    },

    persist() {
      const msgs = this.messages.slice(-MAX_STORED).map(m => ({
        id: m.id, role: m.role, content: m.content, lang: m.lang, mode: m.mode, sources: m.sources, time: m.time
      }));
      ssSet(SS_CHAT, JSON.stringify({ messages: msgs, lastAnalysis: this.lastAnalysis }));
    },

    /* ---------------------------------------------------- rendering */
    renderWidget() {
      let container = document.getElementById('chatbotWidgetContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'chatbotWidgetContainer';
        container.className = 'chatbot-widget-container';
        document.body.appendChild(container);
      }
      const draft = (document.getElementById('chatbotInputField') || {}).value || '';
      const lang = this.uiLang();
      const T = this.t(lang);
      const title = 'TerraTwin AI';

      container.innerHTML = `
        <button class="chatbot-trigger-btn" id="chatbotTriggerBtn" title="${title} — ${escapeHtml(T.subtitle)}" aria-label="${title}">
          ${ICON_GLOBE}
          <span class="chatbot-trigger-dot"></span>
        </button>

        <div class="chatbot-dialog ${this.isOpen ? 'open' : ''}" id="chatbotDialog" role="dialog" aria-label="${title}">
          <div class="chatbot-header">
            <div class="chatbot-header-info">
              <div class="chatbot-header-avatar">${ICON_AVATAR}</div>
              <div>
                <div class="chatbot-title-row">
                  <span class="chatbot-title">${title}</span>
                  <span class="header-model-pill" id="chatbotHeaderModelPill">
                    <span class="status-indicator-dot dot-ready" id="chatbotHeaderStatusDot"></span>
                    <span id="chatbotHeaderStatusText"></span>
                  </span>
                </div>
                <div class="chatbot-subtitle">${escapeHtml(T.subtitle)}</div>
              </div>
            </div>
            <div class="chatbot-header-actions">
              <button class="chatbot-header-action-btn" id="chatbotClearBtn" title="${escapeHtml(T.clear)}" aria-label="${escapeHtml(T.clear)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
              </button>
              <button class="chatbot-header-action-btn" id="chatbotMinBtn" title="${escapeHtml(T.minimize)}" aria-label="${escapeHtml(T.minimize)}">—</button>
              <button class="chatbot-header-action-btn close-btn" id="chatbotCloseBtn" title="${escapeHtml(T.close)}" aria-label="${escapeHtml(T.close)}">✕</button>
            </div>
          </div>

          <div class="chatbot-suggestions-section ${this.hasStartedChatting ? 'chat-active' : ''}" id="chatbotSuggestionsSection">
            <div class="suggestions-header">
              <span class="suggestions-title">${escapeHtml(T.suggested)}</span>
              <button type="button" class="suggestions-text-link" id="btnToggleSuggestions">
                <span id="suggestionsToggleText">${escapeHtml(this.isSuggestionsExpanded ? T.less : T.more)}</span>
              </button>
            </div>
            <div class="suggestions-grid" id="suggestionsGrid">${this.renderSuggestionCards(lang)}</div>
          </div>

          <div class="chatbot-messages-body" id="chatbotMessagesBody" aria-live="polite"></div>

          <div class="chatbot-typing-bar" id="chatbotTypingIndicator" style="display: none;">
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <span class="typing-label" id="chatbotTypingLabel"></span>
          </div>

          <form class="chatbot-input-bar" id="chatbotInputForm">
            <textarea class="chatbot-input-field" id="chatbotInputField" rows="1" dir="auto"
              placeholder="${escapeHtml(T.placeholder)}" autocomplete="off" maxlength="${MAX_MESSAGE}"></textarea>
            <button type="submit" class="chatbot-send-btn" id="chatbotSendBtn" title="${escapeHtml(T.send)}" aria-label="${escapeHtml(T.send)}">${ICON_SEND}</button>
          </form>

          <div class="chatbot-footer-status" id="chatbotFooterStatus">
            <span class="footer-powered">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              <span>${escapeHtml(T.footer)}</span>
            </span>
            <span class="footer-mode-badge mode-ready" id="chatbotFooterModeBadge">
              <span class="mode-dot"></span>
              <span id="chatbotFooterModeText"></span>
            </span>
          </div>
        </div>
      `;

      const input = document.getElementById('chatbotInputField');
      if (input && draft) { input.value = draft; this.autoGrow(input); }
      this.renderMessages();
      this.bindWidgetEvents();
      this.updateStatusUI();
      this.setBusyUI(this.busy);
    },

    renderWelcome(lang) {
      const T = this.t(lang);
      return `
        <div class="chat-welcome-card">
          <div class="welcome-header">
            <div class="welcome-avatar-glow">${ICON_AVATAR}</div>
            <div class="welcome-title-wrap">
              <h3 class="welcome-title">${escapeHtml(T.welcomeTitle)}</h3>
              <span class="welcome-badge">PLANETARY INTELLIGENCE</span>
            </div>
          </div>
          <p class="welcome-desc">${escapeHtml(T.welcomeDesc)}</p>
          <div class="welcome-pills">
            <span class="welcome-pill"><span>📚</span> TerraTwin catalog</span>
            <span class="welcome-pill"><span>🛰️</span> NASA PDS / USGS</span>
            <span class="welcome-pill"><span>🌐</span> العربية / English</span>
          </div>
        </div>`;
    },

    renderMessages() {
      const body = document.getElementById('chatbotMessagesBody');
      if (!body) return;
      body.innerHTML = this.messages.length ? '' : this.renderWelcome(this.uiLang());
      for (const m of this.messages) body.appendChild(this.buildBubble(m));
      body.scrollTop = body.scrollHeight;
    },

    buildBubble(m) {
      const el = document.createElement('div');
      el.dataset.id = m.id;
      this.fillBubble(el, m);
      return el;
    },

    fillBubble(el, m) {
      const ui = this.t(this.uiLang());
      const L = this.t(m.lang || this.uiLang());
      const dir = m.role === 'user' ? 'auto' : (m.lang === 'ar' ? 'rtl' : 'ltr');
      const badgeCls = {
        user: 'badge-user', instant: 'badge-terratwin', catalog: 'badge-qwen-rag', notice: 'badge-model-loading'
      }[m.role === 'user' ? 'user' : m.mode] || 'badge-terratwin';
      const badgeText = m.role === 'user' ? ui.badge.user : (ui.badge[m.mode] || 'TERRATWIN AI');
      const text = m.role === 'user'
        ? `<p>${escapeHtml(m.content).replace(/\n/g, '<br>')}</p>`
        : renderMarkdown(m.content);

      let sources = '';
      if (m.role !== 'user' && Array.isArray(m.sources) && m.sources.length) {
        sources = `
          <div class="chat-sources-container">
            <div class="chat-sources-label">${ICON_STAR}<span>${escapeHtml(L.sourcesLabel)}</span></div>
            <div class="chat-sources-badges">
              ${m.sources.map(s => `<span class="chat-source-badge" title="${escapeHtml(s.title)}"><span class="badge-pill">${escapeHtml(s.n)}</span><span>${escapeHtml(s.title)}</span></span>`).join('')}
            </div>
          </div>`;
      }

      el.className = `chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`;
      el.innerHTML = `
        <div class="chat-text" dir="${dir}">${text}</div>
        ${sources}
        <div class="chat-meta">
          <span class="chat-badge ${badgeCls}">${escapeHtml(badgeText)}</span>
          <span class="chat-time">${escapeHtml(m.time || '')}</span>
        </div>`;
    },

    renderMessage(m) {
      const body = document.getElementById('chatbotMessagesBody');
      if (!body) return;
      const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
      let el = body.querySelector(`.chat-bubble[data-id="${m.id}"]`);
      if (!el) {
        const welcome = body.querySelector('.chat-welcome-card');
        if (welcome) welcome.remove();
        el = this.buildBubble(m);
        body.appendChild(el);
      } else {
        this.fillBubble(el, m);
      }
      if (nearBottom || m.role === 'user') body.scrollTop = body.scrollHeight;
    },

    addMessage(fields) {
      const m = Object.assign({
        id: ++this._seq, role: 'assistant', content: '', lang: this.uiLang(), mode: 'catalog', sources: [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, fields);
      this.messages.push(m);
      this.renderMessage(m);
      this.persist();
      return m;
    },

    getCuratedQuestions() {
      const list = [...(PAGE_PROMPTS[this.currentPage] || PAGE_PROMPTS.home)];
      for (const q of PROMPT_POOL) {
        if (list.length >= 8) break;
        if (!list.some(x => x.q_en === q.q_en)) list.push(q);
      }
      return list;
    },

    renderSuggestionCards(lang) {
      const isAr = lang === 'ar';
      return this.getCuratedQuestions().slice(0, this.isSuggestionsExpanded ? 8 : 4).map(item => {
        const q = isAr ? item.q_ar : item.q_en;
        return `<button type="button" class="suggestion-card" data-prompt-text="${encodeURIComponent(q)}">
            <span class="card-icon-wrap">${item.icon || '✦'}</span>
            <span class="card-question">${escapeHtml(q)}</span>
          </button>`;
      }).join('');
    },

    /* ---------------------------------------------------- status UI */
    updateStatusUI() {
      const T = this.t(this.uiLang());
      const textEl = document.getElementById('chatbotHeaderStatusText');
      if (textEl) textEl.textContent = T.status;
      const ft = document.getElementById('chatbotFooterModeText');
      if (ft) ft.textContent = T.footerMode;
    },

    /* ---------------------------------------------------- events */
    bindWidgetEvents() {
      const $ = (id) => document.getElementById(id);
      $('chatbotTriggerBtn')?.addEventListener('click', () => this.toggleDialog());
      $('chatbotCloseBtn')?.addEventListener('click', () => this.closeDialog());
      $('chatbotMinBtn')?.addEventListener('click', () => this.toggleDialog());
      $('chatbotClearBtn')?.addEventListener('click', () => this.clearChat());

      $('btnToggleSuggestions')?.addEventListener('click', () => {
        this.isSuggestionsExpanded = !this.isSuggestionsExpanded;
        const T = this.t(this.uiLang());
        const tt = $('suggestionsToggleText');
        if (tt) tt.textContent = this.isSuggestionsExpanded ? T.less : T.more;
        const grid = $('suggestionsGrid');
        if (grid) grid.innerHTML = this.renderSuggestionCards(this.uiLang());
      });
      $('suggestionsGrid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.suggestion-card');
        if (card) this.handleUserQuery(decodeURIComponent(card.getAttribute('data-prompt-text') || ''));
      });

      const form = $('chatbotInputForm');
      const input = $('chatbotInputField');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (this.busy) return;
        const q = (input.value || '').trim();
        if (!q) return;
        input.value = '';
        this.autoGrow(input);
        this.handleUserQuery(q);
      });
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          if (!this.busy) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
      input?.addEventListener('input', () => this.autoGrow(input));

      $('chatbotMessagesBody')?.addEventListener('click', (e) => {
        const copy = e.target.closest('.chat-copy-btn');
        if (copy) {
          const code = copy.closest('.chat-pre')?.querySelector('code')?.textContent || '';
          const done = () => { copy.textContent = this.t(this.uiLang()).copied; setTimeout(() => { copy.textContent = 'Copy'; }, 1500); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(() => {});
        }
      });
    },

    bindGlobalEvents() {
      if (this._globalBound) return;
      this._globalBound = true;
      document.addEventListener('languageChanged', () => this.renderWidget());
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) this.closeDialog(); });
    },

    autoGrow(el) {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    },

    setBusyUI(busy) {
      const T = this.t(this.uiLang());
      const btn = document.getElementById('chatbotSendBtn');
      const typing = document.getElementById('chatbotTypingIndicator');
      const lbl = document.getElementById('chatbotTypingLabel');
      if (btn) btn.disabled = busy;
      if (typing) typing.style.display = busy ? 'flex' : 'none';
      if (lbl) lbl.textContent = busy ? T.thinking : '';
    },

    /* ---------------------------------------------------- dialog */
    toggleDialog() { this.isOpen ? this.closeDialog() : this.openDialog(true); },

    openDialog(focus = true) {
      this.isOpen = true;
      ssSet(SS_OPEN, '1');
      document.getElementById('chatbotDialog')?.classList.add('open');
      if (focus) setTimeout(() => document.getElementById('chatbotInputField')?.focus(), 150);
    },

    closeDialog() {
      this.isOpen = false;
      ssSet(SS_OPEN, '0');
      document.getElementById('chatbotDialog')?.classList.remove('open');
    },

    clearChat() {
      this.messages = [];
      this.lastAnalysis = null;
      this.hasStartedChatting = false;
      this.persist();
      document.getElementById('chatbotSuggestionsSection')?.classList.remove('chat-active');
      this.renderMessages();
    },

    markChatStarted() {
      if (this.hasStartedChatting) return;
      this.hasStartedChatting = true;
      document.getElementById('chatbotSuggestionsSection')?.classList.add('chat-active');
    },

    /* ---------------------------------------------------- page context */
    getPageContext() {
      try {
        const cell = (c, role) => c ? {
          role, name: c.name || c.location_name, country: c.country || c.real_place_name || '',
          terrain: c.terrain_type || '', score: (typeof c.similarity_score === 'number') ? c.similarity_score : null
        } : null;
        if (this.currentPage === 'compare' && global.SiteComparator && global.SiteComparator.siteA) {
          const sc = global.SiteComparator;
          const t = sc.selectedTarget;
          return { page: 'compare', items: [cell(sc.siteA, 'Site A'), cell(sc.siteB, 'Site B')].filter(Boolean),
            target: t ? { name: t.name, body: t.body } : null };
        }
        if (this.currentPage === 'finder' && global.SiteFinder && global.SiteFinder.selectedSite) {
          return { page: 'finder', items: [cell(global.SiteFinder.selectedSite, 'Selected site')], target: null };
        }
      } catch (e) { /* page state not ready */ }
      return null;
    },

    /* ---------------------------------------------------- conversation */
    async handleUserQuery(raw) {
      const text = String(raw || '').trim();
      if (!text || this.busy) return;
      this.markChatStarted();

      if (text.length > MAX_MESSAGE) {
        const lang = this.RAG ? this.RAG.detectLanguage(text, this.uiLang()) : this.uiLang();
        this.addMessage({ role: 'assistant', content: this.t(lang).tooLong(MAX_MESSAGE), lang, mode: 'notice' });
        return;
      }

      // The catalog loads once from the local data/ files; later questions answer immediately.
      if (this.RAG && !this.RAG.isLoaded) {
        this.busy = true;
        this.setBusyUI(true);
        try { await this.RAG.init(); } finally { this.busy = false; this.setBusyUI(false); }
      }

      const context = this.getPageContext();
      const analysis = this.RAG
        ? this.RAG.analyze(text, { uiLang: this.uiLang(), page: this.currentPage, context, previous: this.lastAnalysis })
        : { lang: this.uiLang(), intent: 'general', question: text, chunks: [], entityIds: [] };

      this.addMessage({ role: 'user', content: text, lang: analysis.lang });

      if (analysis.intent !== 'terratwin') {
        this.addMessage({ role: 'assistant', content: this.scopeReply(analysis), lang: analysis.lang, mode: 'instant' });
        return;
      }

      this.lastAnalysis = { intent: analysis.intent, query: analysis.question, entityIds: analysis.entityIds };
      const chunks = (analysis.chunks || []).slice(0, 3);
      this.addMessage({
        role: 'assistant',
        content: this.RAG.directAnswer(analysis),
        lang: analysis.lang,
        mode: 'catalog',
        sources: this.RAG.sourcesFor(chunks)
      });
    },

    /** Reply for greetings and questions outside TerraTwin: the assistant's scope + 3 example questions. */
    scopeReply(analysis) {
      const lang = analysis.lang === 'ar' ? 'ar' : 'en';
      const T = this.t(lang);
      const G = GREETINGS[lang];
      let opener = '';
      if (analysis.intent === 'greeting') {
        const types = (analysis.greeting && analysis.greeting.types) || ['hello'];
        if (types.includes('who') || types.includes('capabilities')) opener = G.who;
        else {
          const order = ['salam', 'morning', 'evening', 'hello', 'howareyou', 'thanks', 'bye'];
          opener = order.filter(t => types.includes(t)).map(t => G[t]).join(' ');
        }
      }
      const examples = T.examples.map(q => `- ${q}`).join('\n');
      return `${opener ? opener + ' ' : ''}${T.scope}\n\n${T.examplesLabel}\n${examples}`;
    }
  };

  global.ScientificChatbot = TerraTwinAIChatbot;
  global.TerraTwinAIChatbot = TerraTwinAIChatbot;
  global.TerraTwinMarkdown = { render: renderMarkdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = TerraTwinAIChatbot;
})(typeof window !== 'undefined' ? window : globalThis);
