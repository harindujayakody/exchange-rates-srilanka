// Sri Lankan bank exchange rates API + web UI. Node 20+, no runtime dependencies.
// Fetches each bank's public rates page, lets a free OpenRouter model turn the text into JSON.
import http from 'node:http';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { createBot } from './bot.mjs';
import { createCardRenderer } from './cardimage.mjs';

// tt = [buying, selling] positions of the Telegraphic Transfer rates among a row's numbers (0 = first).
// All checked against the live pages on 2026-11-02.
// shortcut: if a bank reorders its table columns, update tt here.
const BANKS = {
  combank: { name: 'Commercial Bank', short: 'Commercial', url: 'https://www.combank.lk/rates-tariff', tt: [4, 5] },
  boc: { name: 'Bank of Ceylon', short: 'BOC', url: 'https://www.boc.lk/rates-tariff', tt: [4, 5] },
  peoples: { name: "People's Bank", short: "People's", url: 'https://www.peoplesbank.lk/exchange-rates/', tt: [4, 5] },
  sampath: {
    name: 'Sampath Bank', short: 'Sampath', url: 'https://www.sampath.lk/api/exchange-rates',
    // Already JSON, so no model needed.
    parse: ({ data = [] }) => ({
      bankUpdatedAt: data[0]?.RateWEF ?? null,
      rates: data.map(r => ({ currency: r.CurrCode, buying: r.TTBUY, selling: r.TTSEL })),
    }),
  },
  ndb: { name: 'NDB Bank', short: 'NDB', url: 'https://www.ndbbank.com/rates/exchange-rates', tt: [4, 5] },
  seylan: { name: 'Seylan Bank', short: 'Seylan', url: 'https://www.seylan.lk/exchange-rates', tt: [4, 5] },
  ntb: { name: 'Nations Trust Bank', short: 'NTB', url: 'https://www.nationstrust.com/exchange-rates', tt: [4, 5] },
  // DD buy, note encashment, TT buy, DD/TT sell, note sell
  dfcc: { name: 'DFCC Bank', short: 'DFCC', url: 'https://www.dfcc.lk/rates-and-tariff/exchange-rates', tt: [2, 3] },
  // buying TT, buying notes, selling TT, selling notes
  nsb: { name: 'National Savings Bank', short: 'NSB', url: 'https://www.nsb.lk/rates-tarriffs/nsb-exchange-rates/', tt: [0, 2] },
  // shortcut: Pan Asia serves a JavaScript bot check instead of its rates, so it is left out.
  // shortcut: HNB renders rates with JavaScript only, add it with a headless browser if needed.
};
const MODELS = (process.env.OPENROUTER_MODELS || 'nvidia/nemotron-3.5-super-vl:free,google/gemma-4-31b-it:free').split(',');
export const REFRESH_MS = (Number(process.env.REFRESH_HOURS) || 3) * 3_600_000;
export const MAX_HISTORY = 720; // 90 days at 8 refreshes/day (every 3 hours)
const MANUAL_LIMIT = 2; // per hour, for the whole server: protects the free OpenRouter quota
// Banks that block the server's IP can be fetched by push-agent.mjs on a home connection instead, which sends
// them to POST /api/push. With PUSH_TOKEN set, the server stops fetching those banks itself.
const PUSH_TOKEN = process.env.PUSH_TOKEN || '';
const PUSH_BANKS = PUSH_TOKEN ? (process.env.PUSH_BANKS || 'combank,boc,ntb').split(',').map(s => s.trim()).filter(Boolean) : [];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36';
const DIST = path.resolve(import.meta.dirname, 'web/dist');
const DATA = path.resolve(import.meta.dirname, process.env.DATA_DIR || 'data');
const STATE_FILE = path.join(DATA, 'state.json');
const HISTORY_FILE = path.join(DATA, 'history.jsonl'); // one line per refresh: {at, rates: {bank: {USD: [buy, sell]}}}

const state = {
  banks: {}, lastRefresh: null, nextRefresh: null, refreshing: null, manual: [],
  usage: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, since: new Date().toISOString() },
};
let history = [];

export function pageText(html) {
  const s = html.replace(/<!--[\s\S]*?-->|<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  const i = s.search(/\b3\d\d\.\d/); // first USD-sized number = where the rate table starts
  return i < 0 ? s.slice(0, 20000) : s.slice(Math.max(0, i - 3000), i + 12000);
}

// Never trust model output with money: keep only sane rows.
export function cleanRates(rows) {
  return (Array.isArray(rows) ? rows : []).map(r => ({
    currency: String(r.currency || '').toUpperCase().trim(),
    buying: Number(r.buying), selling: Number(r.selling),
  })).filter(r => /^[A-Z]{3}$/.test(r.currency) && r.currency !== 'LKR'
    && r.buying > 0 && r.selling > 0 && r.selling >= r.buying && r.selling < r.buying * 1.5);
}

// The model only copies each row's numbers in order (reliable); the code picks the TT columns (the model got this wrong).
export function ttColumns(rows, [buy, sell]) {
  return (Array.isArray(rows) ? rows : []).map(r => ({
    currency: r?.currency, buying: r?.values?.[buy], selling: r?.values?.[sell],
  }));
}

// Banks write dates many ways ("02.11.2026 11:30:05 AM", "Monday, November 02 2026, 08:13:56 AM", "02 Nov 2026 - 10:56AM").
// Returns ISO in Sri Lanka time ("2026-11-02T11:30:00+05:30"), just the date if no time is given, or null.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function bankTime(text) {
  const s = String(text ?? '');
  const month = name => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
  let m, y, mo, d;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) [, y, mo, d] = m.map(Number);
  else if ((m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})/i))) [d, mo, y] = [+m[1], month(m[2]), +m[3]];
  else if ((m = s.match(/([a-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/i))) [d, mo, y] = [+m[2], month(m[1]), +m[3]];
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = n => String(n).padStart(2, '0');
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  const t = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!t) return date;
  let h = +t[1] % (t[3] ? 12 : 24);
  if (t[3]?.toLowerCase().startsWith('p')) h += 12;
  return `${date}T${pad(h)}:${t[2]}:00+05:30`;
}

// Manual refresh timestamps still inside the last hour, or null if the limit is reached.
export function allowManual(times, now = Date.now()) {
  const recent = times.filter(t => now - t < 3_600_000);
  return recent.length < MANUAL_LIMIT ? [...recent, now] : null;
}

// Adds one OpenRouter response's token counts to the all-time totals and to today's (Sri Lanka date) bucket.
export const colomboDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
export function trackUsage(usage, u, now = new Date()) {
  const add = (t = {}) => ({
    requests: (t.requests || 0) + 1,
    promptTokens: (t.promptTokens || 0) + (u.prompt_tokens || 0),
    completionTokens: (t.completionTokens || 0) + (u.completion_tokens || 0),
    totalTokens: (t.totalTokens || 0) + (u.total_tokens || 0),
    cost: (t.cost || 0) + (u.cost || 0),
  });
  const day = colomboDate(now);
  Object.assign(usage, add(usage));
  usage.daily = { ...usage.daily, [day]: add(usage.daily?.[day]) };
  return usage;
}

// Per-IP limit on API calls: true once an IP passes `limit` requests in a minute.
const hits = new Map();
export function overLimit(ip, now = Date.now(), limit = 120) {
  const h = hits.get(ip);
  if (!h || now - h.start > 60_000) { hits.set(ip, { start: now, count: 1 }); return false; }
  return ++h.count > limit;
}

async function extract(text, tt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(90000),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      models: MODELS, // OpenRouter falls back to the next model if one is down or rate limited
      temperature: 0,
      reasoning: { enabled: false }, // with reasoning on, free models take minutes per page
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: 'This is a Sri Lankan bank page with a foreign exchange rates table (LKR per 1 unit of foreign currency). '
          + 'For each currency row return values: every rate cell in that row from left to right as numbers, '
          + 'null for "-" or empty cells. Do not put the currency name or code in values. '
          + 'Copy numbers exactly, never invent any. Use ISO 4217 codes for currency. '
          + 'updatedAt = the date/time the page says the rates are valid as at, as written, or null. '
          + 'Reply only with JSON: {"updatedAt":"...","rates":[{"currency":"USD","values":[0,0]}]}\n\nPAGE:\n' + text,
      }],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body.error?.message || 'error'}`);
  const u = body.usage || {};
  trackUsage(state.usage, u);
  const choice = body.choices?.[0];
  const content = choice?.message?.content || '';
  if (!content.includes('{')) throw new Error(`model returned no JSON (${choice?.error?.message || body.error?.message || choice?.finish_reason || 'empty reply'})`);
  const json = JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1));
  return { model: body.model, tokens: u.total_tokens || 0, bankUpdatedAt: json.updatedAt || null, rates: cleanRates(ttColumns(json.rates, tt)) };
}

export async function load(bank) {
  const { url, parse, tt } = BANKS[bank];
  const page = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!page.ok) throw new Error(`page returned ${page.status}`);
  const result = parse
    ? (({ bankUpdatedAt, rates }) => ({ model: 'direct (no AI)', tokens: 0, bankUpdatedAt, rates: cleanRates(rates) }))(parse(await page.json()))
    : await extract(pageText(await page.text()), tt);
  if (!result.rates.length) throw new Error('no rates found on page');
  result.bankUpdatedAt = bankTime(result.bankUpdatedAt);
  return { ...result, fetchedAt: new Date().toISOString(), error: null };
}

// One bank at a time: free models reject bursts of parallel requests. Returns the banks that loaded.
async function loadAll() {
  const fresh = [];
  for (const bank of Object.keys(BANKS).filter(id => !PUSH_BANKS.includes(id))) {
    try { state.banks[bank] = await load(bank).catch(() => load(bank)); fresh.push(bank); } // one retry
    catch (e) { state.banks[bank] = { ...state.banks[bank], error: e.message }; } // keep the last good rates
  }
  return fresh;
}

// Saved to disk so a restart keeps rates and usage, and the chart has history to draw.
async function save(fresh, at = state.lastRefresh.at) {
  const snapshot = {
    at,
    rates: Object.fromEntries(fresh.map(id => [id, Object.fromEntries(state.banks[id].rates.map(r => [r.currency, [r.buying, r.selling]]))])),
  };
  history.push(snapshot);
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  await mkdir(DATA, { recursive: true });
  if (history.length >= MAX_HISTORY) {
    await writeFile(HISTORY_FILE, history.map(h => JSON.stringify(h)).join('\n') + '\n');
  } else {
    await appendFile(HISTORY_FILE, JSON.stringify(snapshot) + '\n');
  }
  const { banks, lastRefresh, usage, manual } = state;
  await writeFile(STATE_FILE + '.tmp', JSON.stringify({ banks, lastRefresh, usage, manual }));
  await rename(STATE_FILE + '.tmp', STATE_FILE); // atomic, so a crash never leaves half a file
}

async function restore() {
  try { Object.assign(state, JSON.parse(await readFile(STATE_FILE, 'utf8'))); } catch {}
  try {
    const lines = (await readFile(HISTORY_FILE, 'utf8')).split('\n').filter(Boolean);
    history = lines.slice(-MAX_HISTORY).map(l => JSON.parse(l));
  } catch {}
}

function refreshAll(trigger) {
  const started = Date.now(), requests = state.usage.requests;
  state.refreshing ??= loadAll().then(async fresh => {
    state.lastRefresh = { at: new Date().toISOString(), trigger };
    if (fresh.length) await save(fresh).catch(e => console.error('could not save data:', e.message));
    // One line per refresh, so log viewers (Dozzle, Coolify) show health at a glance.
    const failed = Object.keys(BANKS).filter(id => !fresh.includes(id) && !PUSH_BANKS.includes(id));
    console.log(`refresh (${trigger}): ${fresh.length}/${Object.keys(BANKS).length - PUSH_BANKS.length} banks${PUSH_BANKS.length ? ` (+${PUSH_BANKS.length} pushed)` : ''} in ${Math.round((Date.now() - started) / 1000)}s, `
      + `${state.usage.requests - requests} AI requests${failed.length ? `; failed: ${failed.map(id => `${id} (${state.banks[id]?.error})`).join(', ')}` : ''}`);
  }).finally(() => { state.refreshing = null; });
  return state.refreshing;
}

// Health for Docker / Coolify / uptime monitors: unhealthy only when rates have gone stale
// (no refresh for two intervals) or every bank failed last time. Starting up counts as healthy.
export function health(now = Date.now()) {
  const total = Object.keys(BANKS).length;
  const ok = Object.values(state.banks).filter(b => b.fetchedAt && !b.error).length;
  const age = state.lastRefresh ? now - new Date(state.lastRefresh.at).getTime() : null;
  const healthy = age === null || (age < REFRESH_MS * 2 + 10 * 60_000 && ok > 0);
  return { healthy, body: { ok: healthy, lastRefresh: state.lastRefresh?.at ?? null, banksOk: ok, banksTotal: total, refreshing: !!state.refreshing } };
}

// On-demand refresh of one bank (the Telegram bot's Refresh button). Data younger than maxAgeMs is reused,
// so repeated taps never spend AI quota; concurrent taps share one fetch.
const inflight = new Map();
function refreshBank(id, maxAgeMs = 10 * 60_000) {
  if (PUSH_BANKS.includes(id)) return Promise.resolve(false); // arrives from the push agent; keep the last push
  const b = state.banks[id];
  if (b?.fetchedAt && !b.error && Date.now() - new Date(b.fetchedAt).getTime() < maxAgeMs) return Promise.resolve(false);
  if (!inflight.has(id)) {
    inflight.set(id, (async () => {
      try {
        state.banks[id] = await load(id);
        await save([id], state.banks[id].fetchedAt).catch(e => console.error('could not save data:', e.message));
        return true;
      } catch (e) {
        state.banks[id] = { ...state.banks[id], error: e.message };
        throw e;
      } finally { inflight.delete(id); }
    })());
  }
  return inflight.get(id);
}

const bankList = () => Object.entries(BANKS).map(([id, b]) => ({ id, name: b.name, short: b.short, url: b.url, rates: [], ...state.banks[id] }));

// No CORS header on purpose: browsers only let this app's own pages read the API.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; "
    + "frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
};

const send = (res, code, data) => {
  res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data, null, 2));
};

// shortcut: behind a reverse proxy every visitor shares the proxy's IP; set TRUST_PROXY=1 there.
const clientIp = req => (process.env.TRUST_PROXY && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress;

// Manual refresh only from this app's own page, never from another site or a script with no Origin.
const sameOrigin = req => {
  if (req.headers['sec-fetch-site']) return req.headers['sec-fetch-site'] === 'same-origin';
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
};

// Optional API tokens for outside callers (agents such as Hermes, scripts). When API_TOKENS is set, the data
// endpoints need `Authorization: Bearer <token>` unless the request comes from this app's own page.
const API_TOKENS = (process.env.API_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);
const bearerMatches = (req, tokens) => {
  const given = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  return tokens.some(t => t.length === given.length && timingSafeEqual(Buffer.from(t), Buffer.from(given)));
};
export function authorized(req, tokens = API_TOKENS) {
  return !tokens.length || sameOrigin(req) || bearerMatches(req, tokens);
}

// Validates a push from the home agent into `banks`: only allowed banks, rates that pass the same checks as
// fetched ones, a real timestamp not in the future, and never older than what is already saved. Returns accepted ids.
export function acceptPush(banks, body, allowed, now = Date.now()) {
  const accepted = [];
  for (const [id, b] of Object.entries(body?.banks ?? {})) {
    if (!allowed.includes(id) || !b || typeof b !== 'object') continue;
    const rates = cleanRates(b.rates);
    const at = Date.parse(b.fetchedAt);
    if (!rates.length || !(at <= now + 60_000) || at <= new Date(banks[id]?.fetchedAt ?? 0).getTime()) continue;
    banks[id] = {
      rates, fetchedAt: new Date(at).toISOString(), error: null, model: 'pushed', tokens: 0,
      bankUpdatedAt: typeof b.bankUpdatedAt === 'string' ? bankTime(b.bankUpdatedAt) : null,
    };
    accepted.push(id);
  }
  return accepted;
}

async function readJson(req, limit = 256_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    if ((size += c.length) > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'LKR Rates API', version: '1.0.0',
    description: 'Telegraphic transfer buying and selling rates (LKR per 1 unit of foreign currency) from Sri Lankan banks. '
      + 'buying = what the bank pays you; selling = what you pay the bank. Rates are indicative.',
  },
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  security: [{ bearer: [] }],
  paths: {
    '/rates': { get: {
      operationId: 'listRates', summary: 'Every bank with its TT rates, optionally for one currency',
      parameters: [{ name: 'currency', in: 'query', schema: { type: 'string', example: 'USD' } }],
      responses: { 200: { description: 'Array of banks: id, name, bankUpdatedAt (ISO, Sri Lanka time), fetchedAt, rates[{currency, buying, selling}]' } },
    } },
    '/rates/{bank}': { get: {
      operationId: 'bankRates', summary: 'One bank',
      parameters: [
        { name: 'bank', in: 'path', required: true, schema: { type: 'string', enum: Object.keys(BANKS) } },
        { name: 'currency', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'One bank with its rates' }, 404: { description: 'Unknown bank' } },
    } },
    '/banks': { get: { operationId: 'listBanks', summary: 'Supported bank ids', responses: { 200: { description: 'Array of bank ids' } } } },
    '/api/history': { get: {
      operationId: 'rateHistory', summary: 'Saved snapshots for one currency',
      parameters: [
        { name: 'currency', in: 'query', schema: { type: 'string', example: 'USD' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 720, maximum: 720, minimum: 1 }, description: 'Number of recent snapshots to return (max 720)' },
      ],
      responses: { 200: { description: 'Array of {at, rates: {bankId: [buying, selling]}}' } },
    } },
  },
};

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};
async function serveStatic(res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return send(res, 400, { error: 'Bad path' }); }
  const file = path.join(DIST, path.normalize(decoded));
  for (const f of file.startsWith(DIST + path.sep) ? [file, path.join(DIST, 'index.html')] : []) {
    try {
      const data = await readFile(f);
      res.writeHead(200, {
        ...SECURITY_HEADERS, 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
        // Vite puts a content hash in /assets file names, so they can be cached forever.
        'Cache-Control': f.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      return res.end(data);
    } catch {}
  }
  send(res, 404, { error: 'Not found. Build the UI with: cd web && npm run build' });
}

export function formatHistory(hist, cur = 'USD', limit = MAX_HISTORY) {
  const numLimit = Math.min(Math.max(parseInt(limit, 10) || MAX_HISTORY, 1), MAX_HISTORY);
  const sliced = hist.slice(-numLimit);
  return sliced.map(h => ({
    at: h.at, rates: Object.fromEntries(Object.entries(h.rates).flatMap(([id, r]) => (r[cur] ? [[id, r[cur]]] : []))),
  }));
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const [, route, bank] = url.pathname.split('/');
  const currency = url.searchParams.get('currency')?.toUpperCase();
  const api = route === 'api' || route === 'rates' || route === 'banks';
  if (api && overLimit(clientIp(req))) return send(res, 429, { error: 'Too many requests, slow down' });
  if (currency && !/^[A-Z]{3}$/.test(currency)) return send(res, 400, { error: 'currency must be a 3 letter code like USD' });
  if (url.pathname === '/openapi.json') return send(res, 200, OPENAPI);
  if (url.pathname === '/healthz') { const h = health(); return send(res, h.healthy ? 200 : 503, h.body); }
  if (url.pathname === '/api/push' && req.method === 'POST') {
    if (!PUSH_TOKEN || !bearerMatches(req, [PUSH_TOKEN])) return send(res, 401, { error: 'Missing or invalid push token' });
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, e.status ?? 400, { error: 'Send a JSON body under 256 KB' }); }
    const accepted = acceptPush(state.banks, body, PUSH_BANKS);
    if (accepted.length) await save(accepted, new Date().toISOString()).catch(e => console.error('could not save data:', e.message));
    console.log(`push: accepted ${accepted.join(', ') || 'nothing'}`);
    return send(res, 200, { accepted });
  }
  if (api && !(route === 'api' && bank === 'refresh') && !authorized(req)) {
    return send(res, 401, { error: 'Missing or invalid API token. Send Authorization: Bearer <token>' });
  }

  if (route === 'api' && bank === 'status') {
    const manual = state.manual.filter(t => Date.now() - t < 3_600_000);
    return send(res, 200, {
      banks: bankList(), lastRefresh: state.lastRefresh, nextRefresh: state.nextRefresh, refreshing: !!state.refreshing,
      manual: { limit: MANUAL_LIMIT, remaining: MANUAL_LIMIT - manual.length, resetsAt: manual.length ? new Date(manual[0] + 3_600_000).toISOString() : null },
    });
  }
  if (route === 'api' && bank === 'history') {
    const cur = currency || 'USD';
    return send(res, 200, formatHistory(history, cur, url.searchParams.get('limit')));
  }
  if (route === 'api' && bank === 'refresh' && req.method === 'POST') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Refresh is only allowed from the app' });
    if (state.refreshing) return send(res, 409, { error: 'A refresh is already running' });
    const allowed = allowManual(state.manual);
    if (!allowed) return send(res, 429, { error: `Manual refresh is limited to ${MANUAL_LIMIT} per hour` });
    state.manual = allowed;
    await refreshAll('manual');
    return send(res, 200, { ok: true });
  }
  if (route === 'banks') return send(res, 200, Object.keys(BANKS));
  if (route === 'rates') {
    if (bank && !BANKS[bank]) return send(res, 404, { error: `unknown bank, use one of: ${Object.keys(BANKS)}` });
    const out = bankList().filter(b => !bank || b.id === bank)
      .map(b => ({ ...b, rates: currency ? b.rates.filter(x => x.currency === currency) : b.rates }));
    return send(res, 200, bank ? out[0] : out);
  }
  if (req.method === 'GET') return serveStatic(res, url.pathname);
  send(res, 404, { error: 'try /banks, /rates, /rates/:bank, /rates?currency=USD, /api/status' });
}

const server = http.createServer((req, res) => handle(req, res).catch(e => {
  console.error(e);
  if (!res.headersSent) send(res, 500, { error: 'Server error' }); // never send internals to the client
}));

if (process.argv[1]?.endsWith('server.mjs')) {
  if (!process.env.OPENROUTER_API_KEY) { console.error('Set OPENROUTER_API_KEY first'); process.exit(1); }
  await restore();
  setInterval(() => { for (const [ip, h] of hits) if (Date.now() - h.start > 60_000) hits.delete(ip); }, 60_000);
  const scheduled = () => { state.nextRefresh = new Date(Date.now() + REFRESH_MS).toISOString(); return refreshAll('scheduled'); };
  // After a restart, wait out the rest of the interval instead of spending free quota again.
  const wait = Math.max(0, new Date(state.lastRefresh?.at ?? 0).getTime() + REFRESH_MS - Date.now());
  state.nextRefresh = new Date(Date.now() + wait).toISOString();
  setTimeout(() => { scheduled(); setInterval(scheduled, REFRESH_MS); }, wait);
  const port = process.env.PORT || 5821;
  server.listen(port, process.env.HOST, () => console.log(`http://localhost:${port}`));
  if (process.env.TELEGRAM_BOT_TOKEN) {
    createBot({
      token: process.env.TELEGRAM_BOT_TOKEN,
      admins: (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
      getBanks: bankList, refreshBank, getUsage: () => state.usage, getHistory: () => history,
      renderCard: await createCardRenderer(),
      // Shown on the share image's footer.
      host: process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : 'github.com/harindujayakody',
      dataFile: path.join(DATA, 'bot.json'),
      daily: { currency: (process.env.DAILY_CURRENCY || 'USD').toUpperCase(), time: process.env.DAILY_TIME || '09:00' },
    }).start();
  }
}
