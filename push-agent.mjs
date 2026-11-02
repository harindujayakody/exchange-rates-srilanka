// Push agent: runs on a home PC with plain Node (no Docker). Some banks block the server's datacenter IP but not
// a home connection, so this fetches just those banks here and sends them to the server's POST /api/push.
//   node --env-file=.env push-agent.mjs        (scripts/install-push-agent.ps1 runs it in the background on Windows)
// Needs PUSH_TO (the server, e.g. https://rates.infiax.dev), PUSH_TOKEN (same value as on the server) and
// OPENROUTER_API_KEY. It never starts the web server or the Telegram bot.
import { appendFile } from 'node:fs/promises';
import { REFRESH_MS, load } from './server.mjs';

const { PUSH_TO, PUSH_TOKEN, OPENROUTER_API_KEY } = process.env;
const BANKS = (process.env.PUSH_BANKS || 'combank,boc,ntb').split(',').map(s => s.trim()).filter(Boolean);
const LOG = new URL('./push-agent.log', import.meta.url);

// Logs to the console and to push-agent.log, since the background task has no window.
const log = line => {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  return appendFile(LOG, text + '\n').catch(() => {});
};

if (!PUSH_TO || !PUSH_TOKEN || !OPENROUTER_API_KEY) {
  await log('push agent: set PUSH_TO, PUSH_TOKEN and OPENROUTER_API_KEY in .env');
  process.exit(1);
}

async function pushOnce() {
  const banks = {};
  for (const id of BANKS) {
    try { banks[id] = await load(id).catch(() => load(id)); } // one retry, like the server
    catch (e) { await log(`${id}: ${e.message}`); }
  }
  if (!Object.keys(banks).length) return log('nothing fetched, nothing pushed');
  const res = await fetch(new URL('/api/push', PUSH_TO), {
    method: 'POST',
    headers: { Authorization: `Bearer ${PUSH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ banks }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  await log(`push ${res.status}: accepted ${body.accepted?.join(', ') || 'nothing'}${body.error ? ` (${body.error})` : ''}`);
}

const run = () => pushOnce().catch(e => log(`push failed: ${e.message}`));
await log(`push agent started: ${BANKS.join(', ')} to ${PUSH_TO} every ${REFRESH_MS / 3_600_000} hours`);
run();
setInterval(run, REFRESH_MS);
