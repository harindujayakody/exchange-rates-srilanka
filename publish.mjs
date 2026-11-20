// Static publisher: fetches every bank once, writes JSON files for the web app and uploads them to Cloudflare Pages.
// Runs once and exits (scripts/install-publisher.ps1 schedules it every 3 hours on a Windows PC).
//   node --env-file=.env publish.mjs            fetch, build if needed, deploy
//   node --env-file=.env publish.mjs --no-deploy   write the files only
// DATA_ONLY=1 (with DATA_PATH=d/<unlisted-id>) publishes just the JSON under that path and no web page, for a site
// that shows the rates itself and reads them from here.
import { appendFile, mkdir, readFile, rename, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BANKS, MAX_HISTORY, REFRESH_MS, formatHistory, load } from './server.mjs';

const ROOT = import.meta.dirname;
const DATA = path.join(ROOT, process.env.DATA_DIR || 'data');
const DATA_ONLY = process.env.DATA_ONLY === '1';
const DATA_PATH = (process.env.DATA_PATH || 'data').replace(/^\/|\/$/g, '');
const OUT_DIR = DATA_ONLY ? 'dist-data' : 'web/dist';
const DIST = path.join(ROOT, OUT_DIR);
const PROJECT = process.env.CF_PAGES_PROJECT || 'exchange-rates';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const deploy = !process.argv.includes('--no-deploy');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const log = line => {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  return appendFile(path.join(ROOT, 'publish.log'), text + '\n').catch(() => {});
};
const read = async (f, fallback) => { try { return await readFile(f, 'utf8'); } catch { return fallback; } };

if (!process.env.OPENROUTER_API_KEY) { await log('Set OPENROUTER_API_KEY in .env'); process.exit(1); }

// Last saved rates and history (same files the old server used, so nothing is lost).
const state = JSON.parse(await read(path.join(DATA, 'state.json'), '{}'));
state.banks ??= {};
let history = (await read(path.join(DATA, 'history.jsonl'), '')).split('\n').filter(Boolean).slice(-MAX_HISTORY).map(l => JSON.parse(l));

const started = Date.now();
const fresh = [], failed = [];
for (const id of Object.keys(BANKS)) { // one at a time: free models reject parallel bursts
  try { state.banks[id] = await load(id).catch(() => load(id)); fresh.push(id); }
  catch (e) { state.banks[id] = { ...state.banks[id], error: e.message }; failed.push(`${id} (${e.message})`); } // keep the last good rates
}
const at = new Date().toISOString();
await log(`fetched ${fresh.length}/${Object.keys(BANKS).length} banks in ${Math.round((Date.now() - started) / 1000)}s${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
if (!fresh.length) { await log('nothing fetched, not publishing'); process.exit(1); }

history.push({ at, rates: Object.fromEntries(fresh.map(id => [id, Object.fromEntries(state.banks[id].rates.map(r => [r.currency, [r.buying, r.selling]]))])) });
history = history.slice(-MAX_HISTORY);
state.lastRefresh = { at, trigger: 'scheduled' };
await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, 'history.jsonl'), history.map(h => JSON.stringify(h)).join('\n') + '\n');
await writeFile(path.join(DATA, 'state.json.tmp'), JSON.stringify(state));
await rename(path.join(DATA, 'state.json.tmp'), path.join(DATA, 'state.json')); // atomic

// Build the web app once; later runs reuse it.
if (!DATA_ONLY) try { await access(path.join(DIST, 'index.html')); }
catch { await log('building the web app'); execFileSync(npm, ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }); }

// Files the app reads: /data/status.json and /data/history/<CUR>.json
const banks = Object.entries(BANKS).map(([id, b]) => ({ id, name: b.name, short: b.short, url: b.url, rates: [], ...state.banks[id] }));
await mkdir(path.join(DIST, DATA_PATH, 'history'), { recursive: true });
await writeFile(path.join(DIST, DATA_PATH, 'status.json'), JSON.stringify({
  banks, lastRefresh: state.lastRefresh, nextRefresh: new Date(Date.now() + REFRESH_MS).toISOString(), refreshing: false,
}));
const codes = new Set(banks.flatMap(b => b.rates.map(r => r.currency)));
for (const h of history) for (const r of Object.values(h.rates)) for (const c of Object.keys(r)) codes.add(c);
for (const c of codes) await writeFile(path.join(DIST, DATA_PATH, `history/${c}.json`), JSON.stringify(formatHistory(history, c)));

// Cloudflare Pages reads these from the site root. Rewritten each run so a SITE_URL change takes effect.
if (SITE_URL && !DATA_ONLY) {
  const idx = path.join(DIST, 'index.html');
  let html = await readFile(idx, 'utf8');
  html = html.replace('content="/apple-touch-icon.png"', `content="${SITE_URL}/apple-touch-icon.png"`);
  if (!html.includes('rel="canonical"')) html = html.replace('<link rel="icon"', `<link rel="canonical" href="${SITE_URL}/" />\n    <link rel="icon"`);
  await writeFile(idx, html);
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const day = at.slice(0, 10);
  await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + ['/', '/history'].map(p => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${day}</lastmod></url>`).join('\n') + '\n</urlset>\n');
}
// Data-only: the root just sends visitors to the site that shows the rates.
if (DATA_ONLY && process.env.SITE_HOME) await writeFile(path.join(DIST, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${process.env.SITE_HOME}"><link rel="canonical" href="${process.env.SITE_HOME}"><a href="${process.env.SITE_HOME}">Exchange rates</a>`);
const cors = `/${DATA_PATH}/*\n  Cache-Control: no-cache\n  Access-Control-Allow-Origin: *\n`;
await writeFile(path.join(DIST, '_headers'), cors + (DATA_ONLY ? '' : '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n'));

if (!deploy) { await log(`wrote files to ${OUT_DIR}, skipped deploy`); process.exit(0); }
try {
  const out = execFileSync(npx, ['--yes', 'wrangler', 'pages', 'deploy', OUT_DIR, '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'],
    { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  await log(`deployed to Cloudflare Pages (${PROJECT}): ${out.match(/https:\/\/\S+/g)?.pop() ?? 'ok'}`);
} catch (e) { await log(`deploy failed: ${String(e.stderr || e.message).split('\n').slice(0, 5).join(' | ')}`); process.exit(1); }
