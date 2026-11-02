// Telegram bot for LKR Rates. No dependencies: Telegram Bot API over fetch, long polling (works without a public URL).
// It only reads the server's saved rates. The one network action is the per-bank Refresh button, which the
// server answers from cache when that bank was fetched in the last 10 minutes.

const API = 'https://api.telegram.org/bot';
const FRESH_MS = 10 * 60_000; // a bank fetched this recently is not fetched again on a Refresh tap
const TOP = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD', 'CHF', 'AED', 'SAR', 'INR', 'CNY', 'QAR', 'KWD', 'NZD'];
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
// CNH (offshore yuan) is not an ISO code, so Intl has no name for it.
const currencyName = code => {
  if (code === 'CNH') return 'Chinese Yuan (offshore)';
  try { return currencyNames.of(code) ?? code; } catch { return code; }
};

// Emoji flag from the currency's country (USD → 🇺🇸); Telegram draws these on every platform.
const COUNTRY = { EUR: 'EU', CNH: 'CN' };
export const flag = code => {
  const cc = COUNTRY[code] ?? code.slice(0, 2);
  return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
};

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const num = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const int = n => Math.round(n || 0).toLocaleString('en-US');
const btn = (text, data) => ({ text, callback_data: data });
const rowsOf = (items, size) => items.reduce((rows, b, i) => (i % size ? rows[rows.length - 1].push(b) : rows.push([b]), rows), []);

export function ago(iso, now = Date.now()) {
  if (!iso) return 'never';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 2880) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

// Same display rule as the web app: ISO with time in Sri Lanka time, or just the date.
function bankClock(iso) {
  if (!iso) return 'not published';
  const dateOnly = iso.length === 10;
  return new Date(dateOnly ? `${iso}T00:00:00Z` : iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo' }),
  });
}

export function offers(banks, code) {
  return banks.flatMap(b => {
    const r = b.rates.find(x => x.currency === code);
    return r ? [{ bank: b, buying: r.buying, selling: r.selling }] : [];
  });
}

export function best(banks, code) {
  const o = offers(banks, code);
  if (!o.length) return null;
  return {
    offers: o,
    buy: o.reduce((a, b) => (b.buying > a.buying ? b : a)),
    sell: o.reduce((a, b) => (b.selling < a.selling ? b : a)),
  };
}

const codes = banks => [...new Set(banks.flatMap(b => b.rates.map(r => r.currency)))];
const topCodes = banks => TOP.filter(c => codes(banks).includes(c)).slice(0, 10);
const shortName = b => b.short || b.name;
const homeRow = [btn('🏠 Menu', 'm:home')];

// Every view returns { text, reply_markup } in Telegram HTML.
export const views = {
  home(isAdmin) {
    return {
      text: '<b>LKR Rates</b> 🇱🇰\nTelegraphic transfer rates from 9 Sri Lankan banks, refreshed every 3 hours.\n\n'
        + 'Pick a currency to see which bank pays the most, or open a bank for its full list.\n'
        + '<i>Tip: just type</i> <code>usd</code>, <code>yen</code> <i>or</i> <code>seylan</code>.',
      reply_markup: { inline_keyboard: [
        [btn('💵 Currencies', 'm:cur'), btn('🏦 Banks', 'm:banks')],
        [btn('🏆 Best today', 'm:best'), btn('ℹ️ About', 'm:about')],
        ...(isAdmin ? [[btn('📊 Usage', 'm:usage')]] : []),
      ] },
    };
  },

  currencies(banks, all = false) {
    const list = all ? codes(banks).sort() : topCodes(banks);
    return {
      text: all ? '<b>All currencies</b>\nEvery currency at least one bank quotes.' : '<b>Top currencies</b>\nPick one to compare every bank.',
      reply_markup: { inline_keyboard: [
        ...rowsOf(list.map(c => btn(`${flag(c)} ${c}`, `c:${c}`)), all ? 4 : 3),
        [all ? btn('◀ Top currencies', 'm:cur') : btn('More currencies ▶', 'm:allcur')],
        homeRow,
      ] },
    };
  },

  currency(banks, code, now = Date.now()) {
    const b = best(banks, code);
    if (!b) {
      return { text: `No bank quotes <b>${esc(code)}</b> right now.`, reply_markup: { inline_keyboard: [[btn('◀ Currencies', 'm:cur')], homeRow] } };
    }
    const sorted = [...b.offers].sort((x, y) => y.buying - x.buying);
    const w = Math.max(...sorted.map(o => shortName(o.bank).length), 4);
    const table = [
      `${'Bank'.padEnd(w)}  ${'Buying'.padStart(9)} ${'Selling'.padStart(9)}`,
      ...sorted.map(o => `${shortName(o.bank).padEnd(w)}  ${num(o.buying).padStart(9)} ${num(o.selling).padStart(9)}`
        + (o === b.buy ? ' ◀' : '')),
    ].join('\n');
    const freshest = sorted.map(o => o.bank.fetchedAt).filter(Boolean).sort().at(-1);
    return {
      text: `${flag(code)} <b>${esc(code)} → LKR</b>  ·  ${esc(currencyName(code))}\n\n`
        + `💰 <b>Best to sell ${esc(code)}</b>\n${esc(b.buy.bank.name)} pays <b>Rs ${num(b.buy.buying)}</b>\n\n`
        + `🛒 <b>Best to buy ${esc(code)}</b>\n${esc(b.sell.bank.name)} charges <b>Rs ${num(b.sell.selling)}</b>\n\n`
        + `<pre>${esc(table)}</pre>\n`
        + `<i>Buying: the bank pays you. Selling: you pay the bank. Updated ${ago(freshest, now)}.</i>`,
      reply_markup: { inline_keyboard: [[btn('◀ Currencies', 'm:cur'), ...homeRow]] },
    };
  },

  banks(banks) {
    return {
      text: '<b>Banks</b>\nOpen a bank for every rate it publishes.',
      reply_markup: { inline_keyboard: [
        ...rowsOf(banks.map(b => btn((b.error ? '⚠️ ' : '') + b.name, `b:${b.id}`)), 2),
        homeRow,
      ] },
    };
  },

  bank(bank, now = Date.now()) {
    const lines = [`${'Cur'}  ${'Buying'.padStart(10)} ${'Selling'.padStart(10)}`,
      ...bank.rates.map(r => `${r.currency}  ${num(r.buying).padStart(10)} ${num(r.selling).padStart(10)}`)];
    return {
      text: `<b>${esc(bank.name)}</b>\n`
        + `Bank updated: ${esc(bankClock(bank.bankUpdatedAt))}\nFetched ${ago(bank.fetchedAt, now)}`
        + (bank.error ? `\n⚠️ Last update failed: ${esc(bank.error)}` : '') + '\n\n'
        + (bank.rates.length ? `<pre>${esc(lines.join('\n'))}</pre>` : '<i>No rates saved yet.</i>')
        + `\n<a href="${esc(bank.url)}">Bank's rates page</a>`,
      reply_markup: { inline_keyboard: [
        [btn('🔄 Refresh', `r:${bank.id}`), btn('◀ Banks', 'm:banks')],
        homeRow,
      ] },
    };
  },

  best(banks, now = Date.now()) {
    // Two short lines per currency so the block fits a phone without wrapping.
    const rows = topCodes(banks).flatMap(code => {
      const b = best(banks, code);
      return [`${code}  sell ${num(b.buy.buying).padStart(9)}  ${shortName(b.buy.bank)}`,
        `     buy  ${num(b.sell.selling).padStart(9)}  ${shortName(b.sell.bank)}`];
    });
    const freshest = banks.map(b => b.fetchedAt).filter(Boolean).sort().at(-1);
    return {
      text: '<b>🏆 Best rates today</b>\n'
        + '<b>sell</b>: the most a bank pays you for 1 unit. <b>buy</b>: the least a bank charges you.\n\n'
        + `<pre>${esc(rows.join('\n'))}</pre>\n`
        + `<i>Updated ${ago(freshest, now)}.</i>`,
      reply_markup: { inline_keyboard: [...rowsOf(topCodes(banks).slice(0, 6).map(c => btn(`${flag(c)} ${c}`, `c:${c}`)), 3), homeRow] },
    };
  },

  usage(usage, now = new Date()) {
    const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
    const t = usage?.daily?.[day] ?? {};
    const block = u => [
      `Requests  ${int(u.requests)}`,
      `Tokens    ${int(u.totalTokens)}`,
      `  input   ${int(u.promptTokens)}`,
      `  output  ${int(u.completionTokens)}`,
      `Cost      $${(u.cost || 0).toFixed(4)}`,
    ].join('\n');
    return {
      text: '<b>📊 OpenRouter usage</b>\n\n'
        + `<b>Today</b> (${esc(day)}, Sri Lanka)\n<pre>${block(t)}</pre>\n`
        + `<b>All time</b> (since ${esc(bankClock(usage?.since))})\n<pre>${block(usage ?? {})}</pre>\n`
        + '<i>Free models allow about 50 requests a day.</i>',
      reply_markup: { inline_keyboard: [[btn('🔄 Update', 'm:usage'), ...homeRow]] },
    };
  },

  about() {
    return {
      text: '<b>About LKR Rates</b>\n'
        + 'Rates are read from each bank\'s own public website every 3 hours and are indicative. '
        + 'Always confirm with your bank before you transact.\n\n'
        + 'Free and open source (MIT) by Harindu Jayakody.\nhttps://github.com/harindujayakody/exchnage-rates-srilanka',
      reply_markup: { inline_keyboard: [homeRow] },
    };
  },
};

// Free text: a currency code or name ("usd", "yen", "dollar"), or a bank ("seylan", "boc").
export function resolve(text, banks) {
  const q = text.trim().replace(/^\/(rate|bank)\s*/i, '').toLowerCase();
  if (!q) return null;
  const all = codes(banks);
  const code = all.find(c => c.toLowerCase() === q);
  if (code) return { type: 'currency', code };
  const bank = banks.find(b => b.id === q || b.name.toLowerCase().includes(q) || (b.short || '').toLowerCase() === q);
  if (bank) return { type: 'bank', bank };
  const named = all.filter(c => currencyName(c).toLowerCase().includes(q));
  if (named.length === 1) return { type: 'currency', code: named[0] };
  if (named.length > 1) return { type: 'pick', codes: named.slice(0, 12) };
  return null;
}

export function createBot({ token, admins = [], getBanks, refreshBank, getUsage, log = console }) {
  const call = async (method, body) => {
    const res = await fetch(`${API}${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(65_000),
    });
    const json = await res.json();
    // "message is not modified" just means the user tapped the same button twice.
    if (!json.ok && !/not modified/.test(json.description)) throw new Error(`${method}: ${json.description}`);
    return json.result;
  };
  const isAdmin = id => admins.includes(String(id));
  const show = (chatId, messageId, view) => (messageId
    ? call('editMessageText', { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...view })
    : call('sendMessage', { chat_id: chatId, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...view }));

  function viewFor(data, userId) {
    const banks = getBanks();
    const [kind, arg] = data.split(':');
    if (kind === 'c') return views.currency(banks, arg);
    if (kind === 'b') { const b = banks.find(x => x.id === arg); return b ? views.bank(b) : views.banks(banks); }
    if (arg === 'cur') return views.currencies(banks);
    if (arg === 'allcur') return views.currencies(banks, true);
    if (arg === 'banks') return views.banks(banks);
    if (arg === 'best') return views.best(banks);
    if (arg === 'about') return views.about();
    if (arg === 'usage') return isAdmin(userId) ? views.usage(getUsage()) : views.home(false);
    return views.home(isAdmin(userId));
  }

  async function onCallback(q) {
    const chatId = q.message.chat.id, messageId = q.message.message_id;
    if (q.data.startsWith('r:')) {
      const id = q.data.slice(2);
      const bank = getBanks().find(b => b.id === id);
      // Telegram wants the tap answered within seconds, so say up front whether a fetch is happening.
      if (bank?.fetchedAt && !bank.error && Date.now() - new Date(bank.fetchedAt).getTime() < FRESH_MS) {
        return call('answerCallbackQuery', { callback_query_id: q.id, text: `Already up to date, fetched ${ago(bank.fetchedAt)}.` });
      }
      await call('answerCallbackQuery', { callback_query_id: q.id, text: `Fetching the latest ${bank?.name ?? ''} rates…` });
      try {
        await refreshBank(id, FRESH_MS);
        await show(chatId, messageId, viewFor(`b:${id}`, q.from.id));
      } catch (e) {
        await call('sendMessage', { chat_id: chatId, text: `Couldn't refresh ${bank?.name ?? id}: ${e.message}. Showing the last saved rates.` });
      }
      return;
    }
    await call('answerCallbackQuery', { callback_query_id: q.id });
    await show(chatId, messageId, viewFor(q.data, q.from.id));
  }

  async function onMessage(m) {
    const text = m.text || '';
    const chatId = m.chat.id, userId = m.from?.id;
    if (/^\/(start|help|menu)\b/.test(text)) return show(chatId, null, views.home(isAdmin(userId)));
    if (/^\/myid\b/.test(text)) return show(chatId, null, { text: `Your Telegram user id is <code>${userId}</code>. Add it to TELEGRAM_ADMIN_IDS to see usage.` });
    if (/^\/usage\b/.test(text)) return show(chatId, null, isAdmin(userId) ? views.usage(getUsage()) : { text: 'Usage is only available to the bot admin.' });
    if (/^\/best\b/.test(text)) return show(chatId, null, views.best(getBanks()));
    if (/^\/currencies\b/.test(text)) return show(chatId, null, views.currencies(getBanks()));
    if (/^\/banks\b/.test(text)) return show(chatId, null, views.banks(getBanks()));
    const banks = getBanks();
    const hit = resolve(text, banks);
    if (hit?.type === 'currency') return show(chatId, null, views.currency(banks, hit.code));
    if (hit?.type === 'bank') return show(chatId, null, views.bank(hit.bank));
    if (hit?.type === 'pick') {
      return show(chatId, null, { text: 'Which one?', reply_markup: { inline_keyboard: rowsOf(hit.codes.map(c => btn(`${flag(c)} ${c} · ${currencyName(c)}`, `c:${c}`)), 2) } });
    }
    return show(chatId, null, { text: "I didn't recognise that. Try a currency like <code>usd</code> or a bank like <code>sampath</code>.", reply_markup: views.home(isAdmin(userId)).reply_markup });
  }

  async function start() {
    await call('setMyCommands', { commands: [
      { command: 'start', description: 'Main menu' },
      { command: 'best', description: 'Best rates today' },
      { command: 'currencies', description: 'Pick a currency' },
      { command: 'banks', description: 'Pick a bank' },
      { command: 'usage', description: 'Token usage (admin)' },
      { command: 'myid', description: 'Show your Telegram user id' },
    ] }).catch(e => log.error('telegram:', e.message));
    log.log('Telegram bot running');
    let offset = 0;
    for (;;) {
      try {
        const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
        for (const u of updates) {
          offset = u.update_id + 1;
          // One bad update must never stop the bot.
          await (u.callback_query ? onCallback(u.callback_query) : u.message ? onMessage(u.message) : null)
            ?.catch(e => log.error('telegram update:', e.message));
        }
      } catch (e) {
        log.error('telegram:', e.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  return { start };
}
