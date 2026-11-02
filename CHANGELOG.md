# Changelog

All notable changes to LKR Rates. Dates are in Sri Lanka time.

## 1.2.0 — 2026-11-02

### Added
- **Telegram bot** (`bot.mjs`, no dependencies, long polling). Menus for currencies (with flags), banks, best rates today and an About page. Type `usd`, `yen` or `seylan` to jump straight to a currency or bank.
- **Per-bank refresh in the bot.** The Refresh button re-fetches only that bank, and only when its data is more than 10 minutes old, so repeated taps never spend AI quota.
- **Token usage in the bot, admin only:** totals for today (Sri Lanka date) and all time. Set `TELEGRAM_ADMIN_IDS`; `/myid` shows your id.
- **API for agents such as Hermes:** OpenAPI 3.1 description at `/openapi.json`, plus optional bearer tokens (`API_TOKENS`) for `/rates`, `/banks` and `/api/history`.
- **Installable web app** on Windows, macOS, Android and iPhone: web manifest, app icons, and a service worker that keeps the last rates readable offline.
- **Share a rate image:** a 1080×1350 card (bank, rate, change, history line, top banks) opens the phone's share sheet for WhatsApp and other apps, or saves as a PNG on desktop.
- **Inline country flags** before currency codes on the web (vendored SVGs from country-flag-icons, MIT) and emoji flags in the bot.
- **Light and dark themes** that follow the device, with a toggle in the header.
- `PRODUCT.md` (product record) and `DESIGN.md` (design system).

### Changed
- **Front page redesign: bold, modern, black and white.** The best rate for the chosen currency now sits in one inverted slab: bank name, monumental rate, change, lowest selling, smallest spread and the history chart. Status cards and best-rate cards were folded into it. Top currencies became a ruled list, and the search now heads the comparison table.
- Currency rail with flags at the top of the page, plus a wider "More" list showing full currency names.
- CNH is shown as "Chinese Yuan (offshore)".

### Removed
- Token usage from the web page and from `/api/status`. It now lives only in the bot, for admins.

## 1.1.0 — 2026-11-02

### Added
- Top currencies grid and search by bank or currency, both running on the rates already loaded (no extra requests or tokens).

### Removed
- The tabs on the front page.

## 1.0.0 — 2026-11-02

### Added
- First release: TT buying and selling rates from Commercial Bank, BOC, People's, Sampath, NDB, Seylan, Nations Trust, DFCC and NSB, read by a free OpenRouter model every 3 hours.
- Dark dashboard with a rate history chart, best-rate cards and a comparison table; JSON API; same-origin protection, per-IP rate limits and security headers; MIT license.
