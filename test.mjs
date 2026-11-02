// node test.mjs  (no API key needed)
import assert from 'node:assert';
import { pageText, cleanRates, allowManual, ttColumns, bankTime, overLimit, trackUsage, authorized } from './server.mjs';
import { views, resolve, best, flag, cardData } from './bot.mjs';

assert.strictEqual(flag('USD'), '🇺🇸');
assert.strictEqual(flag('EUR'), '🇪🇺');
assert.strictEqual(flag('CNH'), '🇨🇳');

// Usage: all-time totals plus a bucket per Sri Lanka date (UTC 20:00 is already the next day in Colombo).
const usage = { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
trackUsage(usage, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }, new Date('2026-11-02T10:00:00Z'));
trackUsage(usage, { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }, new Date('2026-11-02T20:00:00Z'));
assert.strictEqual(usage.totalTokens, 180);
assert.strictEqual(usage.requests, 2);
assert.deepStrictEqual(Object.keys(usage.daily), ['2026-11-02', '2026-11-03']);
assert.strictEqual(usage.daily['2026-11-03'].totalTokens, 60);
assert.match(views.usage(usage, new Date('2026-11-02T10:00:00Z')).text, /Tokens\s+120/);

// API tokens: open when none are configured; otherwise only a matching bearer token passes.
const reqWith = auth => ({ headers: { host: 'x', ...(auth ? { authorization: auth } : {}) } });
assert.strictEqual(authorized(reqWith(), []), true);
assert.strictEqual(authorized(reqWith(), ['s3cret']), false);
assert.strictEqual(authorized(reqWith('Bearer wrong!'), ['s3cret']), false);
assert.strictEqual(authorized(reqWith('Bearer s3cret'), ['s3cret']), true);
assert.strictEqual(authorized({ headers: { 'sec-fetch-site': 'same-origin' } }, ['s3cret']), true);

// Bot: best picks, free-text lookup, and views stay valid Telegram HTML.
const banks = [
  { id: 'seylan', name: 'Seylan Bank', short: 'Seylan', url: 'https://x', rates: [{ currency: 'USD', buying: 329, selling: 336 }] },
  { id: 'boc', name: 'Bank of Ceylon', short: 'BOC', url: 'https://y', rates: [{ currency: 'USD', buying: 328.1, selling: 337.1 }, { currency: 'JPY', buying: 2.05, selling: 2.14 }] },
];
assert.strictEqual(best(banks, 'USD').buy.bank.id, 'seylan');
assert.strictEqual(best(banks, 'USD').sell.bank.id, 'seylan');
assert.strictEqual(best(banks, 'EUR'), null);

// Share image data: best buying bank, the week's best-rate line, change from the week's first point.
const now2 = Date.parse('2026-11-02T12:00:00Z');
const hist = [
  { at: '2026-10-20T00:00:00Z', rates: { boc: { USD: [300, 310] } } },          // older than a week: ignored
  { at: '2026-10-30T00:00:00Z', rates: { boc: { USD: [327, 337] }, seylan: { USD: [328, 336] } } },
  { at: '2026-11-02T00:00:00Z', rates: { boc: { USD: [328.1, 337.1] }, seylan: { USD: [329, 336] } } },
];
const card = cardData(banks, hist, 'USD', now2);
assert.strictEqual(card.bank, 'Seylan Bank');
assert.deepStrictEqual(card.series, [328, 329]);
assert.strictEqual(card.change.abs, 1);
assert.strictEqual(card.change.good, true);
assert.deepStrictEqual(card.rows.map(r => r.name), ['Seylan Bank', 'Bank of Ceylon']);
assert.strictEqual(cardData(banks, hist, 'EUR', now2), null);
assert.deepStrictEqual(resolve('usd', banks), { type: 'currency', code: 'USD' });
assert.deepStrictEqual(resolve('yen', banks), { type: 'currency', code: 'JPY' });
assert.strictEqual(resolve('/bank boc', banks).bank.id, 'boc');
assert.strictEqual(resolve('ceylon', banks).bank.id, 'boc');
assert.strictEqual(resolve('zzz', banks), null);
assert.match(views.currency(banks, 'USD').text, /Seylan Bank pays <b>Rs 329\.00<\/b>/);
assert.doesNotMatch(views.bank({ ...banks[0], error: '<oops>' }).text, /<oops>/); // escaped
assert.ok(!views.home(false).reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'm:usage'));
assert.ok(views.home(true).reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'm:usage'));
for (const v of [views.home(true), views.currencies(banks), views.currencies(banks, true), views.banks(banks), views.best(banks)]) {
  for (const b of v.reply_markup.inline_keyboard.flat()) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
}

for (let i = 0; i < 3; i++) assert.strictEqual(overLimit('1.1.1.1', 1000, 3), false);
assert.strictEqual(overLimit('1.1.1.1', 1000, 3), true);   // 4th request in the same minute
assert.strictEqual(overLimit('2.2.2.2', 1000, 3), false);  // other IPs unaffected
assert.strictEqual(overLimit('1.1.1.1', 62_000, 3), false); // new minute

// Every format the banks used on 2026-11-02.
assert.strictEqual(bankTime('2026-11-02'), '2026-11-02');
assert.strictEqual(bankTime('02.11.2026 11:30:05 AM'), '2026-11-02T11:30:00+05:30');
assert.strictEqual(bankTime('2026-11-02 11:38:02am'), '2026-11-02T11:38:00+05:30');
assert.strictEqual(bankTime('Monday, November 02 2026, 08:13:56 AM'), '2026-11-02T08:13:00+05:30');
assert.strictEqual(bankTime('02 Nov 2026 - 10:56AM'), '2026-11-02T10:56:00+05:30');
assert.strictEqual(bankTime('02 November 2026 11:10 PM'), '2026-11-02T23:10:00+05:30');
assert.strictEqual(bankTime('2 Nov 2026 12:05 AM'), '2026-11-02T00:05:00+05:30');
assert.strictEqual(bankTime(null), null);
assert.strictEqual(bankTime('no date here'), null);

// Real ComBank USD row: Currency notes, Cheques, TT. Seylan adds Import Bills (selling only) after TT.
assert.deepStrictEqual(ttColumns([
  { currency: 'USD', values: [326.58, 336.5, 326.72, 336.5, 328.5, 336.5] },
  { currency: 'GBP', values: [328.25, 337.5, 327.7381, 336, 329, 336, 336.5] },
  { currency: 'AED', values: [81.89, 95.37] }, // no TT column for this currency
], [4, 5]), [
  { currency: 'USD', buying: 328.5, selling: 336.5 },
  { currency: 'GBP', buying: 329, selling: 336 },
  { currency: 'AED', buying: undefined, selling: undefined },
]);
assert.deepStrictEqual(cleanRates(ttColumns([{ currency: 'AED', values: [81.89, 95.37] }], [4, 5])), []);
// DFCC: DD buy, note encashment, TT buy, DD/TT sell, note sell. NSB: buy TT, buy notes, sell TT, sell notes.
assert.deepStrictEqual(ttColumns([{ currency: 'USD', values: [326.6, 326.6, 327.85, 337.35, 338.6] }], [2, 3]),
  [{ currency: 'USD', buying: 327.85, selling: 337.35 }]);
assert.deepStrictEqual(ttColumns([{ currency: 'USD', values: [328.5, 325, 336.5, 337.5] }], [0, 2]),
  [{ currency: 'USD', buying: 328.5, selling: 336.5 }]);

const now = 10_000_000;
assert.deepStrictEqual(allowManual([], now), [now]);
assert.strictEqual(allowManual([now - 1000, now - 2000], now), null);                     // 2 in the last hour
assert.deepStrictEqual(allowManual([now - 3_700_000, now - 1000], now), [now - 1000, now]); // old one expired

assert.deepStrictEqual(cleanRates([
  { currency: 'usd', buying: '328.5', selling: 336.5 },
  { currency: 'GBP', buying: 450, selling: 440 },     // selling < buying: model mixed columns
  { currency: 'EUR', buying: 0, selling: 377 },        // missing rate
  { currency: 'LKR', buying: 1, selling: 1 },
  { currency: 'US Dollar', buying: 328, selling: 336 }, // not an ISO code
]), [{ currency: 'USD', buying: 328.5, selling: 336.5 }]);
assert.deepStrictEqual(cleanRates(null), []);

const text = pageText('<script>x</script><td>US DOLLARS</td><!--<td>235.66</td>--><td>328.50</td>');
assert.ok(text.includes('US DOLLARS 328.50') && !text.includes('x ') && !text.includes('235'));
console.log('ok');
