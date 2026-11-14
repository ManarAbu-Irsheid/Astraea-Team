/**
 * TerraTwin AI - Client-side retrieval (RAG) and question router.
 *
 * Responsibilities:
 *   1. Load data/terratwin-knowledge.json + data/terratwin-platform-guide.json.
 *   2. Split them into small, self-contained chunks (one per site, ranking,
 *      rejected site, method detail, data source, page, metric...).
 *   3. Route a user message:  greeting  |  terratwin  |  general.
 *      - greetings are detected only when the WHOLE message is a greeting;
 *      - TerraTwin questions need a real signal (site name, TerraTwin term,
 *        or several domain words), so ordinary questions stay "general";
 *      - follow-ups ("why?", "and the second one?") inherit the previous topic;
 *      - "this site" / "these two sites" use the Compare / Finder selection.
 *   4. Rank chunks with BM25 + whole-word entity matching (no substring hits),
 *      with an Arabic -> English glossary so Arabic questions find English data.
 *
 * Pure JavaScript, no dependencies. Also loadable in Node for testing
 * (module.exports + loadData()).
 */
(function (global) {
  'use strict';

  const KB_URL = 'data/terratwin-knowledge.json';
  const GUIDE_URL = 'data/terratwin-platform-guide.json';

  /* ------------------------------------------------------------------ *
   * Text normalisation & tokenisation
   * ------------------------------------------------------------------ */

  function normalizeText(input) {
    if (!input) return '';
    let t = String(input).normalize('NFD');
    // Latin accents, Arabic harakat, superscript alef, tatweel
    t = t.replace(/[̀-ًͯ-ٰٟـ]/g, '');
    t = t.toLowerCase();
    // Arabic-Indic and Persian digits -> ASCII
    t = t.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
         .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
    // Arabic letter variants
    t = t.replace(/[إأآٱا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
         .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[گ]/g, 'ك').replace(/[پ]/g, 'ب');
    // Apostrophes inside words: ma'an -> maan
    t = t.replace(/(\p{L})['’`](\p{L})/gu, '$1$2');
    // Keep decimal points between digits, drop other punctuation
    t = t.replace(/(\d)\.(\d)/g, '$1\u0001$2');
    t = t.replace(/[^\p{L}\p{N}\u0001]+/gu, ' ');
    t = t.replace(/\u0001/g, '.');
    return t.replace(/\s+/g, ' ').trim();
  }

  const AR_PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];

  function stem(word) {
    if (!word) return word;
    if (/[ء-ي]/.test(word)) {
      for (const p of AR_PREFIXES) {
        if (word.startsWith(p) && word.length - p.length >= 2) {
          return word.slice(p.length);
        }
      }
      return word;
    }
    if (/^[a-z]+$/.test(word) && word.length > 4) {
      if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
    }
    return word;
  }

  function tokenize(text) {
    const norm = normalizeText(text);
    if (!norm) return [];
    return norm.split(' ').filter(Boolean).map(stem);
  }

  function detectLanguage(text, uiLang = 'en') {
    const s = String(text || '');
    const ar = (s.match(/[؀-ۿ]/g) || []).length;
    const lat = (s.match(/[A-Za-z]/g) || []).length;
    if (ar === 0 && lat === 0) return uiLang === 'ar' ? 'ar' : 'en';
    return ar >= lat * 0.5 ? 'ar' : 'en';
  }

  const STOPWORDS = new Set([
    // English
    'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'about', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'doe', 'does', 'did', 'what', 'which',
    'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'this', 'that', 'these', 'those', 'it',
    'its', 'i', 'you', 'we', 'they', 'he', 'she', 'me', 'my', 'your', 'our', 'their', 'can', 'could',
    'would', 'should', 'will', 'shall', 'may', 'might', 'must', 'and', 'or', 'but', 'if', 'then',
    'than', 'so', 'not', 'no', 'yes', 'please', 'tell', 'explain', 'describe', 'give', 'show', 'list',
    'there', 'here', 'any', 'some', 'all', 'more', 'most', 'much', 'many', 'very', 'also', 'just',
    'into', 'over', 'under', 'between', 'vs', 'versus', 'has', 'have', 'had', 'know', 'want',
    'need', 'like', 'make', 'use', 'used', 'using', 'get', 'one', 'two', 'way', 'kind', 'thing',
    // Arabic (normalised, after prefix stemming)
    'ما', 'ماذا', 'ماهي', 'ماهو', 'من', 'هو', 'هي', 'هم', 'هما', 'في', 'علي', 'الي', 'عن', 'مع', 'او',
    'و', 'ثم', 'كيف', 'لماذا', 'ليش', 'متي', 'اين', 'وين', 'هل', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي',
    'الذي', 'الذين', 'اي', 'كل', 'بعض', 'عند', 'لدي', 'لي', 'لك', 'انا', 'انت', 'نحن', 'هناك', 'هنا',
    'كان', 'كانت', 'يكون', 'تكون', 'قد', 'لقد', 'ان', 'انه', 'انها', 'لا', 'نعم', 'بين', 'حول',
    'اعطني', 'اخبرني', 'اشرح', 'وضح', 'ممكن', 'يمكن', 'رجاء', 'فضلك', 'شو', 'ايش', 'اذا', 'به', 'بها',
    'له', 'لها', 'منه', 'منها', 'فيه', 'فيها', 'عليه', 'عليها', 'لم', 'لن', 'ليس', 'غير', 'جدا',
    'ذي', 'الذي', 'التي', 'كم', 'اكثر', 'اقل', 'مثل', 'حتي', 'لكن', 'بل', 'اما', 'ايضا'
  ].map(w => normalizeText(w)));

  /* ------------------------------------------------------------------ *
   * Arabic -> English glossary (query expansion)
   * Keys are written naturally; they are normalised + stemmed at build time.
   * ------------------------------------------------------------------ */
  const AR_GLOSSARY = {
    // bodies & generic terms
    'المريخ': 'mars', 'مريخي': 'martian mars', 'المريخية': 'martian mars', 'القمر': 'moon', 'قمري': 'lunar moon',
    'القمرية': 'lunar moon', 'الأرض': 'earth', 'أرضي': 'earth', 'الأرضية': 'earth', 'كوكب': 'planet', 'الكواكب': 'planetary planet',
    'كوكبي': 'planetary', 'الكوكبية': 'planetary', 'فوهة': 'crater', 'فوهات': 'crater', 'موقع': 'site', 'مواقع': 'site',
    'الموقعين': 'site', 'تضاريس': 'terrain', 'سطح': 'surface', 'نظير': 'analog', 'نظائر': 'analog', 'النظير': 'analog',
    'شبيه': 'analog', 'الشبيهة': 'analog', 'مشابه': 'similar', 'تشبه': 'resemble', 'يشبه': 'resemble', 'تشابه': 'similarity',
    'التشابه': 'similarity', 'تطابق': 'similarity match', 'مطابقة': 'similarity match', 'نسبة': 'score', 'درجة': 'score',
    'ترتيب': 'ranking rank', 'أفضل': 'best', 'أقرب': 'closest', 'مقارنة': 'compare comparison', 'قارن': 'compare',
    'الفرق': 'difference', 'الاختلاف': 'difference', 'اختلافات': 'difference',
    // metrics & physics
    'انحدار': 'slope', 'الميل': 'slope', 'خشونة': 'roughness', 'البياض': 'albedo', 'الألبيدو': 'albedo', 'انعكاس': 'albedo reflectance',
    'حراري': 'thermal', 'الحرارة': 'temperature thermal', 'التباين الحراري': 'thermal swing', 'جاذبية': 'gravity', 'الجاذبية': 'gravity',
    'إشعاع': 'radiation', 'الإشعاع': 'radiation', 'فراغ': 'vacuum', 'ضغط': 'pressure', 'تلوث': 'contamination', 'حيوي': 'biological',
    'الغطاء النباتي': 'vegetation ndvi', 'نباتي': 'vegetation', 'بوابة': 'gate', 'حاجز': 'gate', 'غير حيوي': 'abiotic',
    'ارتفاع': 'elevation', 'إحداثيات': 'coordinate',
    // methodology & data
    'منهجية': 'methodology method', 'المنهجية': 'methodology method', 'طريقة': 'method', 'خوارزمية': 'algorithm',
    'المرحلتين': 'two stage pipeline', 'مرحلة': 'stage', 'مراحل': 'stage', 'مسافة': 'distance', 'بيانات': 'data dataset',
    'مصادر': 'source', 'مصدر': 'source', 'أقمار صناعية': 'satellite', 'الأقمار الاصطناعية': 'satellite', 'أقمار اصطناعية': 'satellite',
    'مستشعر': 'sensor', 'مستشعرات': 'sensor', 'دقة': 'accuracy recall', 'موثوقية': 'reliability recall validation',
    'تحقق': 'validation', 'التحقق': 'validation', 'استبعاد': 'rejected disqualified', 'مستبعد': 'rejected disqualified',
    'استبعد': 'rejected disqualified', 'رفض': 'rejected', 'مرفوض': 'rejected', 'اختبار': 'test', 'اختبارات': 'test',
    'كتالوج': 'catalog', 'الكتالوج': 'catalog', 'حساسية': 'sensitivity',
    // terrain
    'صحراء': 'desert', 'صحراوي': 'desert', 'بركان': 'volcano', 'بركاني': 'volcanic', 'بركانية': 'volcanic', 'حمم': 'lava',
    'اللابة': 'lava', 'لابة': 'lava', 'أنابيب': 'tube', 'أنبوب': 'tube', 'كهوف': 'cave', 'كهف': 'cave', 'جليد': 'ice',
    'قطب': 'pole polar', 'قطبي': 'polar', 'دلتا': 'delta', 'بحيرة': 'lake', 'وادي': 'valley', 'سهل': 'plain', 'هضبة': 'plateau',
    'بازلت': 'basalt', 'بازلتي': 'basalt', 'ثرى': 'regolith', 'الحطام الصخري': 'regolith',
    // missions & operations
    'روفر': 'rover', 'مركبة': 'rover', 'المركبات': 'rover', 'هبوط': 'landing', 'قاعدة': 'base', 'موارد': 'resource isru',
    'مهمة': 'mission', 'مهمات': 'mission', 'ملف المهمة': 'mission profile', 'أوزان': 'weight', 'الوزن': 'weight',
    // platform
    'المنصة': 'platform', 'منصة': 'platform', 'المشروع': 'project', 'مشروع': 'project', 'صفحة': 'page', 'الصفحة': 'page',
    'مستكشف المواقع': 'site finder', 'مقارنة المواقع': 'compare site', 'الأدلة': 'evidence', 'دليل': 'guide',
    'الرئيسية': 'home', 'خريطة': 'map', 'تصدير': 'export', 'شات بوت': 'chatbot assistant', 'المساعد': 'assistant',
    'تيرا توين': 'terratwin', 'تيراتوين': 'terratwin', 'تيرا تون': 'terratwin', 'أستريا': 'astraea',
    'ماهالانوبيس': 'mahalanobis', 'ماهالانوبس': 'mahalanobis', 'تاسي': 'tasi',
    // place & target names
    'جيزيرو': 'jezero', 'جيزرو': 'jezero', 'شاكلتون': 'shackleton', 'موتون': 'mouton', 'مونس موتون': 'mons mouton',
    'أوليمبوس': 'olympus mons', 'اوليمبس': 'olympus mons', 'أوليمبوس مونس': 'olympus mons', 'مارينيريس': 'valles marineris',
    'وادي مارينر': 'valles marineris', 'فاليس مارينيريس': 'valles marineris', 'ميريدياني': 'meridiani planum',
    'بحر السكون': 'mare tranquillitatis', 'بحر الهدوء': 'mare tranquillitatis', 'ترانكويليتاتيس': 'tranquillitatis',
    'أرياديوس': 'rima ariadaeus', 'ريما أرياديوس': 'rima ariadaeus', 'غيل': 'gale', 'فوهة غيل': 'gale crater', 'فوهة جيل': 'gale crater',
    'غوسيف': 'gusev', 'إليسيوم': 'elysium', 'يوتوبيا': 'utopia', 'هيلاس': 'hellas', 'أرجير': 'argyre', 'تايكو': 'tycho',
    'كوبرنيكوس': 'copernicus', 'أريستارخوس': 'aristarchus', 'كلافيوس': 'clavius',
    'المفرق': 'mafraq', 'مفرق': 'mafraq', 'معان': 'maan', 'وادي رم': 'wadi rum', 'ظفار': 'dhofar', 'أتاكاما': 'atacama',
    'يونغاي': 'yungay', 'يونجاي': 'yungay', 'ديفون': 'devon island', 'جزيرة ديفون': 'devon island', 'هوتون': 'haughton',
    'ريو تينتو': 'rio tinto', 'ميديسين ليك': 'medicine lake', 'ميديسين': 'medicine lake', 'ثيرستون': 'thurston', 'ثورستون': 'thurston',
    'لافا بيدز': 'lava bed', 'لانزاروتي': 'lanzarote', 'آيسلندا': 'iceland', 'ايسلندا': 'iceland', 'النرويج': 'norway',
    'سفالبارد': 'svalbard', 'منغوليا': 'mongolia', 'غوبي': 'gobi', 'ناميبيا': 'namibia', 'أستراليا': 'australia',
    'إيران': 'iran', 'السعودية': 'saudi arabia', 'ليبيا': 'libya', 'الجزائر': 'algeria', 'عمان': 'oman', 'الأردن': 'jordan',
    'تشيلي': 'chile', 'الأرجنتين': 'argentina', 'الأمازون': 'amazon', 'النيل': 'nile', 'طوكيو': 'tokyo', 'مانهاتن': 'manhattan',
    'الكونغو': 'congo', 'آيوا': 'iowa', 'هاواي': 'hawaii', 'أبولو': 'apollo', 'أرتميس': 'artemis',
    'بيرسيفيرانس': 'perseverance', 'برسفيرانس': 'perseverance', 'كيوريوسيتي': 'curiosity', 'أوبورتيونيتي': 'opportunity'
  };

  /* ------------------------------------------------------------------ *
   * Routing vocabularies (English stems; Arabic arrives via the glossary)
   * ------------------------------------------------------------------ */
  const STRONG_TERMS = new Set(['terratwin', 'astraea', 'analog', 'analogue', 'ndvi', 'tasi', 'mahalanobis',
    'abiotic', 'benchmark', 'catalog', 'catalogue', 'platform', 'project', 'chatbot'].map(stem));
  const STRONG_PHRASES = [
    'similarity score', 'site finder', 'compare site', 'mission profile', 'negative control', 'two stage pipeline',
    'two stage', 'data source', 'your data', 'your dataset', 'this website', 'this platform', 'this project',
    'earth simulation limit', 'evidence page', 'guide page', 'home page'
  ].map(p => tokenize(p));
  const ABOUT_PLATFORM = new Set(['terratwin', 'astraea', 'platform', 'project'].map(stem));
  const PLANET_TERMS = new Set(['mars', 'martian', 'moon', 'lunar', 'earth', 'planetary', 'planet'].map(stem));
  const FEATURE_TERMS = new Set(['crater', 'site', 'location', 'terrain', 'desert', 'gravity', 'radiation', 'vacuum',
    'slope', 'roughness', 'albedo', 'thermal', 'similarity', 'similar', 'resemble', 'match', 'compare', 'comparison',
    'rover', 'landing', 'regolith', 'volcanic', 'lava', 'tube', 'rejected', 'disqualified', 'gate', 'methodology',
    'pipeline', 'stage', 'algorithm', 'dataset', 'satellite', 'sensor', 'score', 'ranking', 'rank', 'closest', 'mission',
    'artemis', 'perseverance', 'apollo', 'vegetation', 'contamination', 'validation', 'recall', 'isru', 'base',
    'swing', 'elevation', 'field', 'test'].map(stem));
  const SIMILARITY_VERBS = new Set(['resemble', 'resembl', 'similar', 'similarity', 'match', 'equivalent', 'twin', 'analog', 'closest'].map(stem));
  const DEIXIS = new Set(['it', 'its', 'this', 'that', 'these', 'those', 'they', 'them', 'there', 'both', 'same',
    'first', 'second', 'third', 'former', 'latter', 'one', 'هذا', 'هذه', 'ذلك', 'تلك', 'هما', 'نفس',
    'كلاهما', 'اول', 'الاول', 'ثاني', 'الثاني', 'المختار', 'مختار', 'الحالي', 'حالي'].map(w => stem(normalizeText(w))));
  const PAGE_DEIXIS_PHRASES = ['this site', 'this location', 'this target', 'these site', 'these two', 'both site',
    'selected site', 'current site', 'current comparison', 'this comparison', 'site a', 'site b',
    'هذا الموقع', 'هذه المواقع', 'الموقعين', 'الموقع المختار', 'المقارنة الحالية', 'هذه المقارنة'].map(p => tokenize(p));
  const COMPARE_WORDS = new Set(['compare', 'comparison', 'difference', 'different', 'similarity', 'similarit', 'versus',
    'قارن', 'مقارنه', 'فرق', 'الفرق', 'اختلاف', 'الاختلاف', 'تشابه', 'التشابه'].map(w => stem(normalizeText(w))));
  const FOLLOW_UP_CUES = /^(and|also|what about|how about|why not|more|explain more|tell me more|continue|و|وماذا|ماذا عن|طيب|وكيف|ولماذا|اكثر|المزيد|اكمل)( |$)/;
  const GENERAL_MARKERS = /\b(code|python|javascript|typescript|java|c\+\+|function|program|programming|sql|html|css|regex|algorithm to|recipe|poem|story|translate|essay|email|joke)\b|برمج|كود|بايثون|جافا|دالة|ترجم|قصيدة|قصة|نكتة|وصفة/i;

  // Names that identify a TerraTwin site on their own (normalised).
  const STRONG_NAMES = new Set([
    'jezero', 'shackleton', 'mouton', 'mons mouton', 'olympus mons', 'valles marineris', 'meridiani', 'meridiani planum',
    'tranquillitatis', 'mare tranquillitatis', 'ariadaeus', 'rima ariadaeus', 'gusev', 'eberswalde', 'clavius', 'aristarchus',
    'theophilus', 'gassendi', 'petavius', 'grimaldi', 'devon island', 'haughton', 'haughton crater', 'atacama', 'atacama desert',
    'yungay', 'mars desert research station', 'mdrs', 'hi sea', 'hi seas', 'hi sea mauna loa', 'mauna loa', 'rio tinto',
    'gobi desert mars base', 'dhofar', 'dhofar amadee site', 'amadee', 'medicine lake', 'medicine lake volcano', 'mafraq',
    'maan', 'wadi rum', 'lava bed', 'lava beds nm', 'lanzarote', 'cueva de los verdes', 'thurston', 'thurston lava tube',
    'tamanrasset', 'murzuq', 'in guezzam', 'al wahat', 'ardakan', 'ardakan county', 'kerman county', 'omnogovi', 'dornogovi',
    'erongo', 'erongo region', 'hardap', 'kgalagadi', 'chubut', 'salta', 'antofagasta', 'svalbard', 'sakha republic',
    'kamchatka krai', 'ethiopian rift', 'iowa corn belt', 'nile delta cropland', 'congo basin tropical forest',
    'tokyo metropolis', 'manhattan urban core', 'amazon rainforest'
  ].map(n => tokenize(n).join(' ')));
  const GEO_TERMS = new Set(['mons', 'mare', 'planitia', 'vallis', 'valle', 'valles', 'chasma', 'chao', 'chaos', 'terra',
    'fossae', 'planum', 'montes', 'rima', 'crater', 'island', 'volcano', 'rift', 'borealis', 'australe', 'boreum', 'sirenum',
    'noachis', 'major', 'acidalia', 'chryse', 'isidi', 'isidis', 'amazoni', 'amazonis', 'hellas', 'argyre', 'utopia',
    'elysium', 'mawrth', 'nili', 'aram', 'candor', 'ophir', 'kasei', 'ares', 'vastita', 'vastitas'].map(stem));

  // Extra aliases for ranking targets and well-known sites.
  const MANUAL_ALIASES = {
    'rank:mars_jezero': ['jezero', 'jezero crater', 'jezero delta', 'perseverance landing site'],
    'rank:mars_valles_marineris': ['valles marineris', 'grand canyon of mars'],
    'rank:mars_meridiani_planum': ['meridiani planum', 'meridiani', 'opportunity landing site'],
    'rank:mars_olympus_mons': ['olympus mons'],
    'rank:moon_shackleton': ['shackleton', 'shackleton crater', 'lunar south pole'],
    'rank:moon_mons_mouton': ['mons mouton', 'mouton', 'artemis iii landing site'],
    'rank:moon_mare_tranquillitatis': ['mare tranquillitatis', 'tranquillitatis', 'sea of tranquility', 'sea of tranquillity', 'apollo 11 landing site'],
    'rank:moon_rima_ariadaeus': ['rima ariadaeus', 'ariadaeus']
  };

  /* ------------------------------------------------------------------ *
   * Greetings (whole-message only)
   * ------------------------------------------------------------------ */
  const GREETING_PHRASES = [
    ['salam', ['السلام عليكم ورحمة الله وبركاته', 'السلام عليكم ورحمة الله', 'السلام عليكم', 'سلام عليكم', 'السلام', 'سلام']],
    ['morning', ['صباح الخير', 'صباح النور', 'good morning', 'morning']],
    ['evening', ['مساء الخير', 'مساء النور', 'good evening', 'good afternoon', 'evening']],
    ['howareyou', ['كيف حالك', 'كيف الحال', 'كيفك', 'شلونك', 'شو اخبارك', 'اخبارك', 'how are you doing', 'how are you',
      'how is it going', 'hows it going', 'how r u', 'whats up', 'what is up', 'sup']],
    ['who', ['من انت', 'مين انت', 'مين حضرتك', 'عرف بنفسك', 'عرفني بنفسك', 'ما اسمك', 'شو اسمك', 'who are you', 'what are you',
      'introduce yourself', 'what is your name', 'whats your name']],
    ['capabilities', ['ماذا تستطيع ان تفعل', 'ماذا تستطيع', 'ماذا يمكنك ان تفعل', 'شو بتقدر تعمل', 'كيف يمكنك مساعدتي', 'كيف تساعدني',
      'what can you do', 'how can you help me', 'how can you help', 'what do you do']],
    ['thanks', ['شكرا جزيلا', 'شكرا لك', 'شكرا', 'مشكور', 'تسلم', 'يعطيك العافيه', 'جزاك الله خيرا', 'thank you so much', 'thank you very much',
      'thanks a lot', 'thank you', 'thanks', 'thx', 'ty', 'merci', 'great thanks', 'ok thanks', 'perfect thanks']],
    ['bye', ['مع السلامه', 'الى اللقاء', 'باي', 'bye bye', 'goodbye', 'bye', 'see you', 'see you later', 'good night']],
    ['hello', ['اهلا وسهلا', 'اهلا', 'اهلين', 'مرحبا', 'مرحبتين', 'هلا', 'هاي', 'هلو', 'hello there', 'hi there', 'hey there',
      'hello', 'hiya', 'hi', 'hey', 'howdy', 'greetings', 'yo']]
  ].map(([type, phrases]) => [type, phrases.map(p => normalizeText(p).split(' '))]);
  const SALUTATIONS = new Set(['salam', 'hello', 'morning', 'evening', 'thanks']);
  const GREETING_FILLERS = new Set(['يا', 'صديقي', 'بوت', 'تيرا', 'توين', 'تيراتوين', 'terratwin', 'bot', 'there', 'friend',
    'everyone', 'all', 'again', 'ai', 'assistant', 'and', 'و', 'ok', 'okay', 'اوكي', 'تمام', 'dear', 'buddy'].map(w => normalizeText(w)));

  function parseGreeting(text) {
    const words = normalizeText(text).split(' ').filter(Boolean);
    const types = [];
    let i = 0;
    let progressed = true;
    while (i < words.length && progressed) {
      progressed = false;
      if (GREETING_FILLERS.has(words[i])) { i++; progressed = true; continue; }
      for (const [type, phrases] of GREETING_PHRASES) {
        const hit = phrases.find(p => p.every((w, k) => words[i + k] === w));
        if (hit) { types.push(type); i += hit.length; progressed = true; break; }
      }
    }
    if (types.length === 0) return null;
    // Remainder after the greeting prefix (original-ish words)
    const remainder = words.slice(i).join(' ').trim();
    return { types, onlyGreeting: remainder.length === 0, consumedWords: i };
  }

  // Strip a leading greeting from the ORIGINAL text (keeps case/punctuation of the question).
  function stripLeadingGreeting(original, consumedWords) {
    if (!consumedWords) return original;
    const parts = String(original).trim().split(/\s+/);
    let count = 0;
    let idx = 0;
    while (idx < parts.length && count < consumedWords) {
      if (normalizeText(parts[idx])) count += normalizeText(parts[idx]).split(' ').length;
      idx++;
    }
    return parts.slice(idx).join(' ').replace(/^[\s,،.!؟?:;-]+/, '').trim();
  }

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const round = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 10 ** d) / 10 ** d : v;
  const slug = s => normalizeText(s).replace(/\s+/g, '_');
  const has = (arr, seq) => {
    if (!seq.length) return false;
    outer: for (let i = 0; i + seq.length <= arr.length; i++) {
      for (let k = 0; k < seq.length; k++) if (arr[i + k] !== seq[k]) continue outer;
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------------ *
   * Engine
   * ------------------------------------------------------------------ */
  const TerraTwinRAG = {
    data: null,
    guide: null,
    chunks: [],
    entities: [],          // [{id, tokens, strong, chunkIds}]
    isLoaded: false,
    loadError: null,
    _initPromise: null,
    _glossary: null,       // [{tokens, expansion[]}], longest first
    _df: null,
    _avgLen: 0,

    /* ---------- loading ---------- */
    init() {
      if (this.isLoaded) return Promise.resolve(true);
      if (this._initPromise) return this._initPromise;
      this._initPromise = (async () => {
        const fetchJson = async (url, attempts = 2) => {
          let lastErr;
          for (let a = 0; a < attempts; a++) {
            try {
              const res = await fetch(url, { cache: 'no-cache' });
              if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
              return await res.json();
            } catch (e) {
              lastErr = e;
              await new Promise(r => setTimeout(r, 400));
            }
          }
          throw lastErr;
        };
        try {
          const [kb, guide] = await Promise.all([
            fetchJson(KB_URL),
            fetchJson(GUIDE_URL).catch(e => { console.warn('[TerraTwinRAG] platform guide not loaded:', e); return null; })
          ]);
          this.loadData(kb, guide);
          return true;
        } catch (e) {
          this.loadError = e;
          this._initPromise = null; // allow retry
          console.warn('[TerraTwinRAG] knowledge base could not be loaded:', e);
          return false;
        }
      })();
      return this._initPromise;
    },

    loadData(kb, guide) {
      this.data = kb || {};
      this.guide = guide || null;
      this._buildGlossary();
      this._buildChunks();
      this._buildEntities();
      this._buildIndex();
      this.isLoaded = true;
      this.loadError = null;
    },

    _buildGlossary() {
      const list = Object.entries(AR_GLOSSARY).map(([ar, en]) => ({
        tokens: tokenize(ar),
        expansion: tokenize(en)
      })).filter(g => g.tokens.length);
      list.sort((a, b) => b.tokens.length - a.tokens.length);
      this._glossary = list;
    },

    /* ---------- chunk construction ---------- */
    _buildChunks() {
      const kb = this.data;
      const chunks = [];
      const add = (c) => { c.tokens = null; chunks.push(c); return c; };
      const m = kb.methodology || {};
      const kpis = m.kpis || {};

      // Overview
      add({
        id: 'method:overview', kind: 'method', entityIds: [],
        title_en: 'TerraTwin overview and key results', title_ar: 'نظرة عامة على TerraTwin ونتائجها الرئيسية',
        keywords: 'terratwin astraea platform project mission what is overview kpi results recall roc auc cells scanned catalog size about',
        text: `${m.system_name || 'TerraTwin'}: ${m.mission || ''} Key results: ${kpis.cells_scanned ? kpis.cells_scanned.toLocaleString('en-US') : '?'} Earth terrain cells scanned; recall ${kpis.recall_rate || '?'}; ROC-AUC ${kpis.roc_auc ?? '?'}; catalog: ${kpis.catalog_size || '?'}. Method: a two-stage pipeline (Stage 1 NDVI abiotic gate, Stage 2 TASI multi-criteria similarity ranking).`,
        text_ar: `${m.mission_ar || ''} النتائج الرئيسية: مسح ${kpis.cells_scanned ? kpis.cells_scanned.toLocaleString('en-US') : '?'} خلية أرضية؛ نسبة الاسترجاع ${kpis.recall_rate || '?'}؛ ROC-AUC ${kpis.roc_auc ?? '?'}؛ الكتالوج: ${kpis.catalog_size || '?'}. المنهجية: خط معالجة من مرحلتين (المرحلة 1 بوابة NDVI غير الحيوية، والمرحلة 2 تصنيف التشابه متعدد المعايير TASI).`
      });

      const p = m.two_stage_pipeline || {};
      if (p.stage_1) {
        add({
          id: 'method:stage1', kind: 'method', entityIds: [],
          title_en: `Stage 1: ${p.stage_1.name}`, title_ar: `المرحلة الأولى: ${p.stage_1.name_ar || p.stage_1.name}`,
          keywords: 'stage 1 first ndvi gate abiotic vegetation filter threshold 0.20 disqualified barren how identify pipeline cities urban',
          text: `Stage 1 of the TerraTwin two-stage pipeline (${p.stage_1.name}). Threshold: ${p.stage_1.threshold}. ${p.stage_1.rule} ${p.stage_1.purpose}`
        });
      }
      if (p.stage_2) {
        add({
          id: 'method:stage2', kind: 'method', entityIds: [],
          title_en: `Stage 2: ${p.stage_2.name}`, title_ar: `المرحلة الثانية: ${p.stage_2.name_ar || p.stage_2.name}`,
          keywords: 'stage 2 second tasi similarity score ranking weights parameters influence formula percentile mars moon calculated how identify pipeline',
          text: `Stage 2 of the TerraTwin two-stage pipeline (${p.stage_2.name}). ${p.stage_2.mars_formula} ${p.stage_2.moon_formula}`
        });
        add({
          id: 'method:distance', kind: 'method', entityIds: [],
          title_en: 'Distance metric (Mahalanobis)', title_ar: 'مقياس المسافة (ماهالانوبيس)',
          keywords: 'mahalanobis distance metric covariance cosine kernel collinear algorithm similarity calculated',
          text: `TerraTwin distance metric: ${p.stage_2.distance_metric} It is applied in Stage 2 (${p.stage_2.name}) after the NDVI gate.`
        });
      }

      (m.data_sources || []).forEach((s, i) => add({
        id: `source:${i}`, kind: 'source', entityIds: [],
        title_en: `Data source: ${s.name}`, title_ar: `مصدر بيانات: ${s.name}`,
        keywords: 'data source dataset satellite sensor instrument catalog power where data come from nasa esa usgs',
        text: `TerraTwin data source: ${s.name} (used for ${s.body}). Instruments / products: ${s.instruments}.`
      }));
      if ((m.data_sources || []).length) {
        add({
          id: 'source:all', kind: 'source', entityIds: [],
          title_en: 'All TerraTwin data sources', title_ar: 'جميع مصادر بيانات TerraTwin',
          keywords: 'data sources datasets satellite which list all catalog power scientific data use sensors',
          text: 'TerraTwin uses these public data sources: ' + m.data_sources.map(s => `${s.name} (${s.body})`).join('; ') + '.'
        });
      }

      (m.earth_simulation_limits || []).forEach((l, i) => add({
        id: `limit:${i}`, kind: 'limit', entityIds: [],
        title_en: `What Earth cannot simulate: ${l.parameter}`, title_ar: `ما لا تحاكيه الأرض: ${l.parameter_ar || l.parameter}`,
        keywords: 'earth cannot simulate limit limitation never constraint gravity radiation vacuum pressure contamination atmosphere',
        text: `Earth simulation limit - ${l.parameter}. Earth: ${l.earth_val}. Moon: ${l.moon_val}. Mars: ${l.mars_val}. ${l.scientific_constraint}`,
        text_ar: `حد المحاكاة الأرضية - ${l.parameter_ar || l.parameter}. الأرض: ${l.earth_val}. القمر: ${l.moon_val}. المريخ: ${l.mars_val}. ${l.scientific_constraint_ar || l.scientific_constraint}`
      }));

      if ((m.valid_analog_tests || []).length) {
        add({
          id: 'method:valid_tests', kind: 'method', entityIds: [],
          title_en: 'What Earth analog sites are valid for testing', title_ar: 'الاختبارات التي تصلح لها المواقع النظيرة الأرضية',
          keywords: 'valid tests suitable good for use cases rover mobility regolith dust slam lava tube eva isru what makes suitable analog',
          text: 'Earth analog sites are valid for: ' + m.valid_analog_tests.join('; ') + '. They cannot reproduce reduced gravity, space radiation, hard vacuum or sterility.'
        });
      }

      // Sites
      const sites = kb.all_sites || [];
      this._sites = sites;
      const rankings = kb.similarity_rankings || {};
      const siteChunkByName = new Map();
      sites.forEach((s) => {
        const id = `site:${s.type.toLowerCase()}:${slug(s.location_name)}`;
        const t = s.type;
        const temp = (s.temp_min_C != null && s.temp_max_C != null)
          ? `surface temperature ${round(s.temp_min_C, 1)} to ${round(s.temp_max_C, 1)} °C (thermal swing ${round(s.temp_swing_C, 1)} °C)` : '';
        const where = s.real_place_name ? ` in ${s.real_place_name}` : '';
        const kindLabel = t === 'Earth'
          ? (s.analog_environment_type === 'Negative Control (Non-Space Analog)' ? 'Earth negative-control site' : (s.is_official_analog ? 'Earth official analog field site' : 'Earth candidate analog site'))
          : `${t} target`;
        const c = add({
          id, kind: 'site', body: t, entityIds: [id], site: s,
          title_en: `${t === 'Earth' ? 'Earth site' : t + ' target'}: ${s.location_name}`,
          title_ar: `${t === 'Earth' ? 'موقع أرضي' : (t === 'Mars' ? 'هدف على المريخ' : 'هدف على القمر')}: ${s.location_name}`,
          keywords: `${t.toLowerCase()} ${t === 'Mars' ? 'martian' : t === 'Moon' ? 'lunar' : ''} ${s.terrain_type || ''} ${s.analog_environment_type || ''} ${s.analog_subtype || ''}`,
          text: `${kindLabel}: ${s.location_name}${where}. Terrain: ${s.terrain_type || 'n/a'}; environment type: ${s.analog_environment_type || 'n/a'}. Coordinates ${round(s.lat, 2)}, ${round(s.lon, 2)}. Elevation ${round(s.elevation_m, 0)} m; slope ${round(s.slope_deg, 2)}° (${s.slope_class || ''}); roughness ${round(s.roughness_m, 1)} m; albedo ${round(s.albedo, 3)}; ${temp}. NDVI ${s.ndvi} (${s.ndvi_gate_status || ''}).`
        });
        siteChunkByName.set(normalizeText(s.location_name), c);
      });

      // Rankings (+ cross references into site chunks)
      const findSiteChunk = (analogName) => {
        const n = normalizeText(analogName);
        if (siteChunkByName.has(n)) return siteChunkByName.get(n);
        const manual = { 'mdrs utah': 'mars desert research station', 'norway svalbard': 'norway', 'australia interior': 'australia',
          'california arid basins': 'california united states', 'nevada arid basins': 'nevada united states',
          'rio tinto spain': 'rio tinto', 'iceland cryo volcanic': 'iceland', 'ethiopian rift grid pt 2': 'ethiopian rift grid pt 2',
          'western australia': 'western australia australia' };
        if (manual[n] && siteChunkByName.has(manual[n])) return siteChunkByName.get(manual[n]);
        // best token overlap among Earth sites
        const q = new Set(n.split(' '));
        let best = null, bestScore = 0;
        for (const [name, chunk] of siteChunkByName) {
          if (chunk.body !== 'Earth') continue;
          const toks = name.split(' ');
          const inter = toks.filter(x => q.has(x)).length;
          const score = inter / Math.max(q.size, toks.length);
          if (score > bestScore) { bestScore = score; best = chunk; }
        }
        return bestScore >= 0.5 ? best : null;
      };
      const targetSiteFor = (key) => {
        const map = { mars_jezero: 'jezero', mars_valles_marineris: 'valles marineris', mars_meridiani_planum: 'meridiani planum',
          mars_olympus_mons: 'olympus mons', moon_shackleton: 'shackleton', moon_mons_mouton: 'mons mouton',
          moon_mare_tranquillitatis: 'mare tranquillitatis', moon_rima_ariadaeus: 'rima ariadaeus' };
        const n = map[key];
        if (!n) return null;
        for (const [name, chunk] of siteChunkByName) if (chunk.body !== 'Earth' && (name === n || name.includes(n))) return chunk;
        return null;
      };

      const topSummary = [];
      Object.entries(rankings).forEach(([key, r]) => {
        const id = `rank:${key}`;
        const list = r.top_analogs || [];
        const lines = list.map((a, i) => i < 6
          ? `${i + 1}. ${a.name} - ${a.similarity}% (${a.type}): ${a.notes}`
          : `${i + 1}. ${a.name} - ${a.similarity}%`);
        const body = key.startsWith('mars') ? 'Mars' : 'Moon';
        const targetChunk = targetSiteFor(key);
        const entityIds = [id];
        if (targetChunk) entityIds.push(targetChunk.id);
        add({
          id, kind: 'ranking', body, entityIds,
          title_en: `Benchmark ranking: ${r.target}`, title_ar: `ترتيب المطابقة: ${r.target}`,
          keywords: `best closest top earth analog analogs similarity score ranking benchmark ${body.toLowerCase()} ${body === 'Mars' ? 'martian' : 'lunar'} resemble match compare`,
          text: `TerraTwin benchmark ranking for ${r.target} - ${r.description}. Ranked Earth analogs by similarity: ${lines.join(' ')}`
        });
        list.forEach((a, i) => {
          const sc = findSiteChunk(a.name);
          if (sc) {
            sc.entityIds.push(id);
            sc.rankRefs = sc.rankRefs || [];
            sc.rankRefs.push(`#${i + 1} for ${r.target} (${a.similarity}%)`);
          }
        });
        if (targetChunk && list[0]) {
          targetChunk.text += ` TerraTwin benchmark: best Earth analog is ${list[0].name} (${list[0].similarity}%)` +
            (list[1] ? `, then ${list[1].name} (${list[1].similarity}%)` : '') + '.';
        }
        if (list[0]) topSummary.push(`${r.target}: ${list.slice(0, 3).map(a => `${a.name} ${a.similarity}%`).join(', ')}`);
      });
      chunks.filter(c => c.kind === 'site' && c.rankRefs).forEach(c => {
        c.text += ` Appears in TerraTwin benchmark rankings as: ${c.rankRefs.join('; ')}.`;
      });
      if (topSummary.length) {
        add({
          id: 'list:top_analogs', kind: 'list', entityIds: [],
          title_en: 'Best Earth analogs for each Moon and Mars target', title_ar: 'أفضل النظائر الأرضية لكل هدف على القمر والمريخ',
          keywords: 'best closest top earth analog analogs location locations resemble martian lunar terrain mars moon which overall summary sites similar',
          text: 'Top-3 Earth analogs per benchmark target (similarity): ' + topSummary.join(' | ') + '.'
        });
      }

      // Rejected sites
      const rejected = kb.rejected_sites || [];
      rejected.forEach(r => {
        const id = `rejected:${slug(r.name)}`;
        const sc = findSiteChunk(r.name);
        add({
          id, kind: 'rejected', entityIds: sc ? [id, sc.id] : [id],
          title_en: `Rejected by the NDVI gate: ${r.name}`, title_ar: `مستبعد عبر بوابة NDVI: ${r.name}`,
          keywords: 'rejected disqualified excluded failed ndvi gate vegetation why negative control',
          text: `${r.name} (${r.location}) was rejected by TerraTwin's Stage 1 NDVI gate: NDVI ${r.ndvi} is above the 0.20 threshold. ${r.reason}`
        });
        if (sc) sc.entityIds.push(id);
      });
      if (rejected.length) {
        add({
          id: 'list:rejected', kind: 'list', entityIds: [],
          title_en: 'All sites rejected by the NDVI gate', title_ar: 'جميع المواقع المستبعدة عبر بوابة NDVI',
          keywords: 'rejected disqualified excluded sites list all which ndvi gate failed negative controls',
          text: 'Sites rejected by the NDVI > 0.20 gate: ' + rejected.map(r => `${r.name} (NDVI ${r.ndvi})`).join('; ') + '.'
        });
      }

      // Catalog lists
      ['Earth', 'Mars', 'Moon'].forEach(body => {
        const names = sites.filter(s => s.type === body).map(s => s.location_name);
        if (!names.length) return;
        add({
          id: `list:${body.toLowerCase()}`, kind: 'list', entityIds: [],
          title_en: `Catalog: all ${body} ${body === 'Earth' ? 'sites' : 'targets'} (${names.length})`,
          title_ar: `الكتالوج: جميع ${body === 'Earth' ? 'المواقع الأرضية' : body === 'Mars' ? 'أهداف المريخ' : 'أهداف القمر'} (${names.length})`,
          keywords: `list all how many number count catalog ${body.toLowerCase()} ${body === 'Mars' ? 'martian' : body === 'Moon' ? 'lunar' : ''} sites targets names which`,
          text: `The TerraTwin catalog has ${names.length} ${body} ${body === 'Earth' ? 'sites' : 'targets'}: ${names.join(', ')}.`
        });
      });

      // Platform guide
      const g = this.guide;
      if (g) {
        (g.pages || []).forEach(pg => add({
          id: `guide:${pg.id}`, kind: 'guide', page: pg.id, entityIds: [],
          title_en: pg.title_en, title_ar: pg.title_ar,
          keywords: `${pg.keywords} page how to use navigate website feature`,
          text: pg.text_en, text_ar: pg.text_ar
        }));
        (g.metrics || []).forEach(mt => add({
          id: `metric:${mt.id}`, kind: 'guide', entityIds: [],
          title_en: mt.title_en, title_ar: mt.title_ar, keywords: `${mt.keywords} metric parameter definition meaning`,
          text: mt.text_en, text_ar: mt.text_ar
        }));
        if (g.assistant) {
          add({
            id: 'guide:assistant', kind: 'guide', entityIds: [],
            title_en: g.assistant.title_en, title_ar: g.assistant.title_ar, keywords: g.assistant.keywords,
            text: g.assistant.text_en, text_ar: g.assistant.text_ar
          });
        }
      }

      this.chunks = chunks;
      this._chunkById = new Map(chunks.map(c => [c.id, c]));
    },

    /* ---------- entity aliases ---------- */
    _buildEntities() {
      const ents = new Map();
      const addAlias = (entityId, alias, forceStrong = null) => {
        const tokens = tokenize(alias);
        if (!tokens.length) return;
        if (tokens.length === 1 && tokens[0].length < 3) return;
        const key = tokens.join(' ');
        const strong = forceStrong != null ? forceStrong
          : (STRONG_NAMES.has(key) || (tokens.length >= 2 && tokens.some(t => GEO_TERMS.has(t))));
        const k = `${entityId}|${key}`;
        if (ents.has(k)) return;
        ents.set(k, { id: entityId, tokens, strong });
      };

      const addFirstWordAlias = (entityId, name) => {
        const first = stem(normalizeText(String(name).split(/\s+/)[0]));
        if (first.length < 4 || FEATURE_TERMS.has(first) || PLANET_TERMS.has(first) || STOPWORDS.has(first)) return;
        addAlias(entityId, first, false);
      };
      for (const c of this.chunks) {
        if (c.kind === 'site') {
          const name = c.site.location_name;
          addAlias(c.id, name);
          // "Devon Island / Haughton Crater", "Hawaii - Thurston Lava Tube", "Atacama Desert (Yungay)", "Tamanrasset, Algeria"
          name.split(/\s*\/\s*|\s+-\s+/).forEach(part => {
            addAlias(c.id, part.replace(/\(.*?\)/g, ''));
            const paren = part.match(/\((.*?)\)/);
            if (paren) addAlias(c.id, paren[1]);
            const comma = part.split(',')[0];
            if (comma && comma !== part) addAlias(c.id, comma);
          });
          if (/mars desert research station/i.test(name)) addAlias(c.id, 'MDRS', true);
          if (c.site.analog_environment_type === 'Negative Control (Non-Space Analog)') addFirstWordAlias(c.id, name);
          if (/hi-seas/i.test(name)) { addAlias(c.id, 'HI-SEAS', true); addAlias(c.id, 'HI SEAS', true); }
        } else if (c.kind === 'rejected') {
          const name = c.title_en.replace(/^Rejected by the NDVI gate:\s*/, '');
          addAlias(c.id, name);
          name.split(/\s*\/\s*|\s+-\s+/).forEach(part => {
            addAlias(c.id, part.replace(/\(.*?\)/g, ''));
            const paren = part.match(/\((.*?)\)/);
            if (paren) addAlias(c.id, paren[1], false);
          });
          addFirstWordAlias(c.id, name); // "Tokyo", "Amazon", "Iowa" (weak on their own)
        } else if (c.kind === 'ranking') {
          const target = c.title_en.replace(/^Benchmark ranking:\s*/, '').replace(/\(.*?\)/g, '');
          addAlias(c.id, target);
          (MANUAL_ALIASES[c.id] || []).forEach(a => addAlias(c.id, a, true));
        }
      }
      // short distinctive names for Earth / rejected sites
      const extra = { 'medicine lake': 'rejected:medicine_lake_volcano', 'thurston': 'rejected:hawaii_thurston_lava_tube',
        'lava beds': 'rejected:lava_beds_nm' };
      for (const [alias, id] of Object.entries(extra)) if (this._chunkById.has(id)) addAlias(id, alias, true);

      this.entities = Array.from(ents.values()).sort((a, b) => b.tokens.length - a.tokens.length);
    },

    /* ---------- BM25 index ---------- */
    _chunkTokens(c) {
      const title = tokenize(c.title_en);
      const titleAr = c.title_ar ? tokenize(c.title_ar) : [];
      return [...title, ...title, ...titleAr, ...tokenize(c.keywords || ''), ...tokenize(c.text || ''), ...(c.text_ar ? tokenize(c.text_ar) : [])]
        .filter(t => !STOPWORDS.has(t));
    },

    _buildIndex() {
      const df = new Map();
      let total = 0;
      for (const c of this.chunks) {
        c.tokens = this._chunkTokens(c);
        c.tf = new Map();
        for (const t of c.tokens) c.tf.set(t, (c.tf.get(t) || 0) + 1);
        for (const t of c.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
        total += c.tokens.length;
      }
      this._df = df;
      this._avgLen = total / Math.max(1, this.chunks.length);
    },

    _bm25(queryTokens, c) {
      const N = this.chunks.length, k1 = 1.2, b = 0.75;
      let score = 0;
      const seen = new Set();
      for (const t of queryTokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        const f = c.tf.get(t);
        if (!f) continue;
        const n = this._df.get(t) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.tokens.length / this._avgLen));
      }
      return score;
    },

    /* ---------- query processing ---------- */
    _expandQuery(text) {
      const raw = tokenize(text);
      const out = [];
      for (let i = 0; i < raw.length;) {
        let matched = null;
        for (const g of this._glossary) {
          if (g.tokens.length && g.tokens.every((t, k) => raw[i + k] === t)) { matched = g; break; }
        }
        if (matched) {
          out.push(...matched.tokens, ...matched.expansion);
          i += matched.tokens.length;
        } else {
          out.push(raw[i]);
          i++;
        }
      }
      return out;
    },

    _matchEntities(tokens) {
      const found = new Map(); // id -> {strong}
      for (const e of this.entities) {
        if (has(tokens, e.tokens)) {
          const prev = found.get(e.id);
          found.set(e.id, { id: e.id, strong: (prev && prev.strong) || e.strong, len: Math.max(prev ? prev.len : 0, e.tokens.length) });
        }
      }
      return Array.from(found.values());
    },

    /**
     * Analyse a user message.
     * @param {string} query
     * @param {object} opts { uiLang, page, context:{page, items:[{role,name,country,terrain}], target:{name, body}}, previous:{intent, entityIds, query} }
     */
    analyze(query, opts = {}) {
      const uiLang = opts.uiLang || 'en';
      const original = String(query || '').trim();
      const lang = detectLanguage(original, uiLang);
      const result = {
        lang, intent: 'general', greeting: null, question: original, chunks: [], entityIds: [],
        usedContext: false, contextText: '', isFollowUp: false, debug: {}
      };
      if (!original) return result;

      // 1. Greetings
      const greet = parseGreeting(original);
      if (greet && greet.onlyGreeting) {
        result.intent = 'greeting';
        result.greeting = { types: greet.types };
        return result;
      }
      let question = original;
      // "Hello, what is the best analog for Jezero?" -> answer the question part.
      // Only plain salutations are stripped ("how are you able to..." stays intact).
      if (greet && !greet.onlyGreeting && greet.types.every(t => SALUTATIONS.has(t))) {
        question = stripLeadingGreeting(original, greet.consumedWords) || original;
      }
      result.question = question;

      if (!this.isLoaded) {
        result.debug.reason = 'kb-not-loaded';
        result.intent = this._looksTerraTwinWithoutKb(question) ? 'terratwin' : 'general';
        return result;
      }

      // 2. Signals
      const tokens = this._expandQuery(question);
      const content = tokens.filter(t => !STOPWORDS.has(t));
      const entities = this._matchEntities(tokens);
      const strongEntities = entities.filter(e => e.strong);
      const weakEntities = entities.filter(e => !e.strong);
      const strongTerms = content.filter(t => STRONG_TERMS.has(t)).length + STRONG_PHRASES.filter(p => has(tokens, p)).length;
      const planets = new Set(content.filter(t => PLANET_TERMS.has(t))).size;
      const features = new Set(content.filter(t => FEATURE_TERMS.has(t))).size;
      const simPattern = content.some(t => SIMILARITY_VERBS.has(t)) && planets > 0;
      const deixis = tokens.some(t => DEIXIS.has(t)) || PAGE_DEIXIS_PHRASES.some(p => has(tokens, p));
      const pageDeixis = PAGE_DEIXIS_PHRASES.some(p => has(tokens, p));
      const isGeneralMarked = GENERAL_MARKERS.test(question);

      // 3. Page context ("this site", "these two sites", compare page questions)
      const ctx = opts.context && Array.isArray(opts.context.items) && opts.context.items.length ? opts.context : null;
      let contextTokens = [];
      if (ctx && strongEntities.length === 0 && !isGeneralMarked) {
        const compareish = ctx.page === 'compare' && content.some(t => COMPARE_WORDS.has(t));
        if (pageDeixis || compareish || (deixis && features > 0)) {
          result.usedContext = true;
          const names = ctx.items.map(i => i.name).filter(Boolean);
          if (ctx.target && ctx.target.name) names.push(ctx.target.name);
          contextTokens = this._expandQuery(names.join(' , '));
          result.contextText = this._describeContext(ctx);
        }
      }

      // 4. Intent decision
      const ctxEntities = contextTokens.length ? this._matchEntities(contextTokens) : [];
      const prev = opts.previous || null;
      let intent = 'general';
      if (strongTerms > 0 || strongEntities.length > 0 || simPattern || result.usedContext) intent = 'terratwin';
      else if (weakEntities.length > 0 && (features > 0 || planets > 0)) intent = 'terratwin';
      else if (features >= 2 || (features >= 1 && planets >= 1)) intent = 'terratwin-candidate';

      // Follow-up inheritance
      let followTokens = [];
      const refersBack = deixis && entities.length === 0 && !result.usedContext;
      if (prev && prev.intent === 'terratwin' && !isGeneralMarked && (intent !== 'terratwin' || refersBack)) {
        // "why?", "explain more" (no content of its own) or an explicit follow-up cue / reference.
        // A short but self-contained question ("capital of Japan?") is NOT a follow-up.
        const noContent = content.length <= 1;
        const cue = FOLLOW_UP_CUES.test(normalizeText(question));
        if (deixis || noContent || cue) {
          intent = 'terratwin';
          result.isFollowUp = true;
          followTokens = this._expandQuery(prev.query || '');
        }
      }

      // 5. Retrieval
      const queryTokens = [...content, ...contextTokens.filter(t => !STOPWORDS.has(t)), ...followTokens.filter(t => !STOPWORDS.has(t))];
      const entityIds = new Set([...entities, ...ctxEntities].map(e => e.id));
      if (result.isFollowUp && prev && Array.isArray(prev.entityIds) && entities.length === 0) prev.entityIds.forEach(id => entityIds.add(id));
      const scored = this._rank(queryTokens, entityIds, strongEntities.length + ctxEntities.length > 0, {
        wantsRanking: content.some(t => SIMILARITY_VERBS.has(t) || t === 'best' || t === 'top' || t === 'closest'),
        aboutPlatform: content.some(t => ABOUT_PLATFORM.has(t))
      });
      const top = scored[0] ? scored[0].score : 0;

      if (intent === 'terratwin-candidate') {
        // Several domain words but no explicit TerraTwin signal: accept only if retrieval is confident.
        intent = (top >= 5.5 && features >= 1) ? 'terratwin' : 'general';
      }
      result.intent = intent;
      result.entityIds = Array.from(entityIds);
      result.debug = { strongTerms, planets, features, simPattern, deixis, strongEntities: strongEntities.map(e => e.id),
        weakEntities: weakEntities.map(e => e.id), top: round(top, 2), tokens: queryTokens };

      if (intent === 'terratwin') {
        result.chunks = this._select(scored, lang);
      }
      return result;
    },

    _looksTerraTwinWithoutKb(text) {
      const toks = this._glossary ? this._expandQuery(text) : tokenize(text);
      return toks.some(t => STRONG_TERMS.has(t));
    },

    _describeContext(ctx) {
      const pageName = { compare: 'Compare Sites', finder: 'Site Finder', home: 'Home', evidence: 'Evidence & Method', guide: 'Guide' }[ctx.page] || ctx.page;
      const items = ctx.items.map(i => `${i.role}: ${i.name}${i.country && i.country !== i.name ? ` (${i.country})` : ''}${i.terrain ? `, terrain ${i.terrain}` : ''}${i.score != null ? `, similarity ${i.score}%` : ''}`);
      const target = ctx.target && ctx.target.name ? `; target: ${ctx.target.name}${ctx.target.body ? ` (${ctx.target.body})` : ''}` : '';
      return `The user is on the ${pageName} page. Current selection - ${items.join('; ')}${target}.`;
    },

    _rank(queryTokens, entityIds, hasStrongEntity, hints = {}) {
      const out = [];
      for (const c of this.chunks) {
        let s = this._bm25(queryTokens, c);
        // "What is TerraTwin?" - the name is in almost every chunk, so BM25 alone can't find the overview.
        if (hints.aboutPlatform && c.id === 'method:overview') s += 4;
        if (hints.wantsRanking && (c.kind === 'ranking' || c.id === 'list:top_analogs')) s *= 1.25;
        let entityHit = false;
        if (entityIds.size && c.entityIds && c.entityIds.length) {
          const primary = c.entityIds[0];
          if (entityIds.has(primary)) { s += 9; entityHit = true; }
          else if (c.entityIds.some(id => entityIds.has(id))) { s += 3.5; entityHit = true; }
        }
        // A single rejected site repeats "NDVI gate" in its text; unless that site is named,
        // the method explanation and the rejected-sites list answer the question better.
        if (c.kind === 'rejected' && !entityHit) s *= 0.6;
        // Lists are useful only for list-style questions; keep them from crowding entity answers.
        if (c.kind === 'list' && hasStrongEntity) s *= 0.6;
        if (s > 0) out.push({ chunk: c, score: s });
      }
      out.sort((a, b) => b.score - a.score);
      return out;
    },

    _select(scored, lang, maxChunks = 5, maxChars = 3400) {
      if (!scored.length) return [];
      const top = scored[0].score;
      const minScore = Math.max(2.0, top * 0.38);
      const picked = [];
      let chars = 0;
      const kindCount = {};
      for (const { chunk, score } of scored) {
        if (score < minScore || picked.length >= maxChunks) break;
        const k = chunk.kind;
        if ((kindCount[k] || 0) >= (k === 'site' ? 3 : k === 'source' ? 3 : 2)) continue;
        const text = this.chunkText(chunk, lang);
        if (chars + text.length > maxChars && picked.length > 0) continue;
        picked.push({ ...this._publicChunk(chunk, lang), score: round(score, 2) });
        kindCount[k] = (kindCount[k] || 0) + 1;
        chars += text.length;
      }
      return picked;
    },

    _publicChunk(c, lang) {
      return {
        id: c.id, kind: c.kind,
        title: lang === 'ar' && c.title_ar ? c.title_ar : c.title_en,
        title_en: c.title_en,
        text: this.chunkText(c, lang)
      };
    },

    chunkText(c, lang) {
      return (lang === 'ar' && c.text_ar) ? c.text_ar : c.text;
    },

    /* ---------- output helpers ---------- */
    formatEvidence(chunks) {
      return chunks.map((c, i) => `[${i + 1}] ${c.title_en}\n${c.text}`).join('\n\n');
    },

    sourcesFor(chunks) {
      return chunks.map((c, i) => ({ n: i + 1, id: c.id, kind: c.kind, title: c.title }));
    },

    /** Answer built straight from the TerraTwin catalog entries retrieved by analyze(). */
    directAnswer(analysis) {
      const ar = analysis.lang === 'ar';
      const chunks = (analysis.chunks || []).slice(0, 3);
      if (!chunks.length) {
        return ar
          ? 'لم أجد معلومات عن هذا السؤال في كتالوج TerraTwin. جرّب ذكر اسم موقع (مثل جيزيرو أو المفرق) أو موضوع منهجي (مثل بوابة NDVI).'
          : "I couldn't find this in the TerraTwin catalog. Try naming a site (for example Jezero or Mafraq) or a method topic (for example the NDVI gate).";
      }
      const head = ar ? 'إليك ما يقوله كتالوج TerraTwin:' : 'Here is what the TerraTwin catalog says:';
      const body = chunks.map((c, i) => `**[${i + 1}] ${c.title}**\n${c.text}`).join('\n\n');
      return `${head}\n\n${body}`;
    },

    /** Legacy API kept for compatibility with older callers. */
    search(query, lang = 'en') {
      const a = this.analyze(query, { uiLang: lang });
      return {
        snippets: a.chunks.map(c => `[${c.title_en}] ${c.text}`),
        sources: a.chunks.map(c => ({ title: c.title })),
        isGreeting: a.intent === 'greeting',
        isProjectQuery: a.intent === 'terratwin',
        matchedEntities: a.entityIds
      };
    },

    isGreeting(text) {
      const g = parseGreeting(text);
      return !!(g && g.onlyGreeting);
    },

    // exposed for the UI and tests
    normalize: normalizeText,
    tokenize,
    detectLanguage,
    parseGreeting
  };

  global.TerraTwinRAG = TerraTwinRAG;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerraTwinRAG;
})(typeof window !== 'undefined' ? window : globalThis);
