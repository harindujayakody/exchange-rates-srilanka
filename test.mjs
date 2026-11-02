// node test.mjs  (no API key needed)
import assert from 'node:assert';
import { pageText, cleanRates, allowManual, ttColumns, bankTime, overLimit } from './server.mjs';

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
