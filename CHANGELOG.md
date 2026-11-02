# Changelog

All notable changes to LKR Rates. Dates are in Sri Lanka time.

## 1.5.0 — 2026-11-02

### Added
- **Docker:** a multi-stage `Dockerfile` (builds the web app, non-root user, bot image fonts included, health check) and `docker-compose.yml` with a persistent `lkr-data` volume.
- **Portainer CE and Dozzle:** `docker-compose.monitoring.yml` runs Portainer (container management, port 9443) and Dozzle (live logs, port 8080), both bound to `127.0.0.1`.
- **Coolify deployment guide** in the README.
- `GET /healthz` for Docker, Coolify and uptime monitors, plus one log line per refresh (banks ok, AI requests, failures).

### Changed
- The repository is now `harindujayakody/exchange-rates-srilanka`.

## 1.4.0 — 2026-11-02

### Added
- **History page** (`/history`) for every currency the banks quote: one row per day (Sri Lanka time) with the best and worst buying rate and the best and worst selling rate, each with its bank, plus the extremes over 1W, 1M, 6M, 1Y or all saved history. Built from the snapshots the server already saves every 3 hours, so it costs no extra requests or tokens.
- **Daily USD rate on Telegram at 9:00 AM** (Sri Lanka time): the bot posts the USD rate image to every subscribed chat and deletes the previous day's post first, so the chat keeps only today's. Admins are subscribed by default; anyone can switch it with `/daily`. Subscribers are saved in `data/bot.json`. Set `DAILY_CURRENCY` and `DAILY_TIME` to change it.
- **Page links in the header and footer** (Rates, History) with Lucide icons; every footer link now has an icon.

## 1.3.0 — 2026-11-02

### Added
- **The bot replies with the share image.** Asking for a currency sends the rate card with the comparison table as its caption. The card is drawn by the same `web/src/card.js` as the web page, using `@napi-rs/canvas` (optional; without it the bot sends text). Telegram's file id is cached per set of rates, so repeat requests don't redraw or re-upload.
- **Chart hover label:** an inverted chip with the rate, date and bank follows the cursor.
- **Skeleton loading** for the slab figures, the chart, table rows and bank sheets while their data is still being fetched.
- `PUBLIC_URL` setting, shown on the bot's share images.

### Changed
- **Header redesign:** smaller wordmark, a live status line ("Updated 12 minutes ago / 9 banks"), compact icon buttons and the Refresh button, on an opaque ground with no blur.
- **Footer redesign:** minimal, on the page background: a product line, one row of links, the bank sources and the credit.
- **One motion for every switch:** toggles share a sliding indicator, switched content fades and rises in on the same ease, and the theme cross-fades.

### Fixed
- The chart no longer shakes on hover. It now has a fixed height, its time window no longer changes on every render, and the tooltip no longer animates.
- Four-digit rates such as KWD fit the slab on desktop again.

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
