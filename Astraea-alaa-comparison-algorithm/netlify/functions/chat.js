/**
 * TerraTwin AI - Netlify Function: POST /api/chat
 *
 * - Retrieval (RAG) runs here with the same engine the browser uses (js/rag-engine.js) over
 *   data/terratwin-knowledge.json + data/terratwin-platform-guide.json. Clients only send the
 *   question, so they cannot inject fake "catalog data" into the prompt.
 * - Answers come from Groq (OpenAI-compatible API) and are streamed back as NDJSON lines:
 *     {"type":"meta","intent","lang","sources":[{n,title}],"model"}
 *     {"type":"delta","text":"..."}            (many)
 *     {"type":"done","finish":"stop|length"}  or  {"type":"error","code":"..."}
 * - The API key is read ONLY from process.env.GROQ_API_KEY (local: .env via `netlify dev`;
 *   production: Netlify environment variables). It is never logged or returned.
 * - Guards: same-origin check, POST only, body/message size limits, rate limiting:
 *     1. Netlify platform rate limit (config.rateLimit below) - enforced by Netlify in front of every
 *        function instance in production. Not enforced by `netlify dev`.
 *     2. In-memory per-IP limiter - best effort only (each serverless instance has its own memory).
 */
import RAG from '../../js/rag-engine.js';
import knowledgeBase from '../../data/terratwin-knowledge.json';
import platformGuide from '../../data/terratwin-platform-guide.json';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// qwen/qwen3.8-27b: strongest Arabic + English quality in our tests, consistent [n] citations, ~1 s answers.
// openai/gpt-oss-120b, openai/gpt-oss-20b: fallbacks. On Groq's free tier each model has its own
// limit (8,000 tokens/min, 1,000 requests/day), so falling back on HTTP 429 roughly triples capacity.
const MODELS = (process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : [])
  .concat(['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  .filter((m, i, a) => m && a.indexOf(m) === i);
const MODEL_OPTIONS = {
  'qwen/qwen3.8-27b': { reasoning_effort: 'none' },
  'openai/gpt-oss-120b': { reasoning_effort: 'low' },
  'openai/gpt-oss-20b': { reasoning_effort: 'low' }
};

const LIMITS = {
  bodyBytes: 16000,       // whole request
  message: 2000,          // characters per user message
  historyMessages: 6,     // last 3 question/answer pairs
  historyChars: 1200,     // per history message
  perMinute: 10,          // requests per IP
  perHour: 60,
  maxTokens: { terratwin: 700, general: 1000 }
};

RAG.loadData(knowledgeBase, platformGuide);

/* ----------------------------------------------------------------- rate limiting
 * Secondary, best-effort limiter: counts per warm function instance only.
 * The real limit is the Netlify platform rule in `config.rateLimit` at the end of this file. */
const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600000);
  const lastMinute = list.filter(t => now - t < 60000).length;
  if (lastMinute >= LIMITS.perMinute) return 60 - Math.floor((now - list.filter(t => now - t < 60000)[0]) / 1000);
  if (list.length >= LIMITS.perHour) return 3600 - Math.floor((now - list[0]) / 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) { for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 3600000) hits.delete(k); }
  return 0;
}

/* ----------------------------------------------------------------- helpers */
const json = (status, obj, extra = {}) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
});

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin fetches and server-to-server calls may omit it
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    if (o.host === self.host) return true;
    if (/^(localhost|127\.0\.0\.1)$/.test(o.hostname) && /^(localhost|127\.0\.0\.1)$/.test(self.hostname)) return true;
    const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    return allowed.includes(o.origin);
  } catch (e) {
    return false;
  }
}

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== 'object' || !Array.isArray(ctx.items)) return null;
  return {
    page: clip(ctx.page, 20),
    items: ctx.items.slice(0, 3).map(i => ({
      role: clip(i && i.role, 30), name: clip(i && i.name, 120), country: clip(i && i.country, 120),
      terrain: clip(i && i.terrain, 80), score: (i && typeof i.score === 'number') ? i.score : null
    })).filter(i => i.name),
    target: ctx.target && ctx.target.name ? { name: clip(ctx.target.name, 120), body: clip(ctx.target.body, 20) } : null
  };
}

function sanitizePrevious(prev) {
  if (!prev || typeof prev !== 'object') return null;
  return {
    intent: prev.intent === 'terratwin' ? 'terratwin' : 'general',
    query: clip(prev.query, LIMITS.message),
    entityIds: Array.isArray(prev.entityIds) ? prev.entityIds.slice(0, 10).map(x => clip(x, 120)) : []
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim())
    .slice(-LIMITS.historyMessages)
    .map(h => ({ role: h.role, content: clip(h.content, LIMITS.historyChars) }));
}

const PAGE_NAMES = { home: 'Home', finder: 'Site Finder', compare: 'Compare Sites', evidence: 'Evidence & Method', guide: 'Guide' };

function buildSystemPrompt(analysis, page) {
  const lang = analysis.lang;
  const langRule = lang === 'ar'
    ? 'Write your whole answer in Modern Standard Arabic (العربية الفصحى). Keep code, formulas and units in their original form. Use the Arabic names of places when they are well known (for example المفرق، معان، وادي رم، أتاكاما).'
    : 'Write your whole answer in English.';
  let system = `You are TerraTwin AI, the assistant built into the TerraTwin website. TerraTwin is a planetary-analog platform that matches Earth sites to Moon and Mars targets using orbital remote-sensing data.

How to answer:
- Help with any topic: general knowledge, science, space, math, programming, history, geography, everyday questions and friendly conversation. Do not limit yourself to TerraTwin.
- Be accurate and honest. If you are not sure, say so. Never invent facts, numbers, sites or sources.
- Be clear and concise: short paragraphs, bullet lists when useful, code in fenced code blocks with the language name, math step by step.
- Answer the latest user message; use earlier messages only as context.
- ${langRule}
- The user is on the ${PAGE_NAMES[page] || 'Home'} page of the website.`;
  if (analysis.usedContext && analysis.contextText) system += `\n- ${analysis.contextText}`;

  if (analysis.intent === 'terratwin' && analysis.chunks.length) {
    const evidence = analysis.chunks.map((c, i) => `[${i + 1}] ${c.title_en}\n${c.text}`).join('\n\n');
    system += `

TERRATWIN DATA (verified entries from the TerraTwin catalog):
${evidence}

Rules for TerraTwin facts:
- Use TERRATWIN DATA as the only source for TerraTwin-specific facts (site names, similarity percentages, measurements, rankings, methods). Copy numbers exactly as written.
- Cite the entries you use with their number in square brackets, like [1] or [2].
- If TERRATWIN DATA does not contain the answer, say that the TerraTwin catalog does not include it. You may add general scientific background, but say that it is general knowledge.`;
  }
  return system;
}

async function callGroq(model, messages, maxTokens, signal) {
  return fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.4,
      max_tokens: maxTokens,
      ...(MODEL_OPTIONS[model] || {})
    })
  });
}

/* ----------------------------------------------------------------- handler */
export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json(405, { error: 'method-not-allowed' }, { Allow: 'POST' });
  if (!sameOrigin(req)) return json(403, { error: 'forbidden-origin' });

  const raw = await req.text();
  if (raw.length > LIMITS.bodyBytes) return json(413, { error: 'too-large', limit: LIMITS.message });
  let body;
  try { body = JSON.parse(raw || '{}'); } catch (e) { return json(400, { error: 'bad-json' }); }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(400, { error: 'empty-message' });
  if (message.length > LIMITS.message) return json(413, { error: 'message-too-long', limit: LIMITS.message });

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const retryAfter = rateLimited(ip);
  if (retryAfter) return json(429, { error: 'rate-limited', retryAfter }, { 'Retry-After': String(Math.max(1, retryAfter)) });

  if (!process.env.GROQ_API_KEY) {
    console.error('[chat] GROQ_API_KEY is not set');
    return json(503, { error: 'not-configured' });
  }

  const lang = body.lang === 'ar' ? 'ar' : 'en';
  const page = PAGE_NAMES[body.page] ? body.page : 'home';
  const analysis = RAG.analyze(message, {
    uiLang: lang, page, context: sanitizeContext(body.context), previous: sanitizePrevious(body.previous)
  });
  if (analysis.intent === 'greeting') analysis.intent = 'general';

  const messages = [
    { role: 'system', content: buildSystemPrompt(analysis, page) },
    ...sanitizeHistory(body.history),
    { role: 'user', content: analysis.question || message }
  ];
  const maxTokens = analysis.intent === 'terratwin' ? LIMITS.maxTokens.terratwin : LIMITS.maxTokens.general;

  // Try the models in order; fall back on rate limits (429), "model unavailable" and server errors.
  let upstream = null, model = null, rateLimitedRetryAfter = 0;
  for (const m of MODELS) {
    try {
      const r = await callGroq(m, messages, maxTokens, req.signal);
      if (r.ok && r.body) { upstream = r; model = m; break; }
      const status = r.status;
      await r.text().catch(() => '');
      console.error(`[chat] Groq ${m} returned HTTP ${status}`);
      if (status === 429) { rateLimitedRetryAfter = Math.max(rateLimitedRetryAfter, Number(r.headers.get('retry-after')) || 30); continue; }
      if (status === 401 || status === 403) return json(502, { error: 'upstream-auth' });
      if (status === 413) return json(413, { error: 'too-large' });
    } catch (e) {
      if (req.signal && req.signal.aborted) return new Response(null, { status: 499 });
      console.error(`[chat] Groq ${m} request failed: ${e && e.name}`);
    }
  }
  if (!upstream && rateLimitedRetryAfter) {
    return json(429, { error: 'rate-limited', upstream: true, retryAfter: rateLimitedRetryAfter }, { 'Retry-After': String(rateLimitedRetryAfter) });
  }
  if (!upstream) return json(502, { error: 'upstream-unavailable' });

  const encoder = new TextEncoder();
  const sources = analysis.intent === 'terratwin' ? RAG.sourcesFor(analysis.chunks) : [];
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      send({ type: 'meta', intent: analysis.intent, lang: analysis.lang, sources, model });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', finish = null, inThink = false;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            let evt;
            try { evt = JSON.parse(data); } catch (e) { continue; }
            const choice = evt.choices && evt.choices[0];
            if (!choice) continue;
            if (choice.finish_reason) finish = choice.finish_reason;
            let text = (choice.delta && choice.delta.content) || '';
            if (!text) continue;
            // Defensive: drop any <think> block if a model ever emits one.
            if (text.includes('<think>')) { inThink = true; text = text.split('<think>')[0]; }
            if (inThink) { const end = text.indexOf('</think>'); if (end < 0) continue; inThink = false; text = text.slice(end + 8); }
            if (text) send({ type: 'delta', text });
          }
        }
        send({ type: 'done', finish: finish || 'stop' });
      } catch (e) {
        if (!(req.signal && req.signal.aborted)) {
          console.error(`[chat] stream interrupted: ${e && e.name}`);
          send({ type: 'error', code: 'stream-interrupted' });
        }
      } finally {
        controller.close();
      }
    },
    cancel() { try { upstream.body.cancel(); } catch (e) { /* ignore */ } }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};

// Route + platform rate limit (applied by Netlify at deploy time; https://ntl.fyi/rate-limiting-code).
// 10 requests per 60 s per client IP and site domain; extra requests get HTTP 429 from Netlify.
export const config = {
  path: '/api/chat',
  rateLimit: {
    windowLimit: LIMITS.perMinute,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  }
};
