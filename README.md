<div align="center">

<img src="web/public/logo.png" alt="LKR Rates logo" width="88" />

# LKR Rates

**Which Sri Lankan bank pays the most for your money today. One bold screen, one Telegram bot.**

Buying and selling rates from 9 banks, read straight from their websites every 3 hours,<br/>
ranked, charted over time, shareable as an image, installable as an app, and on Telegram.

[![MIT License](https://img.shields.io/badge/license-MIT-34d399?style=flat-square)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%E2%89%A520.6-0a0a0a?style=flat-square&logo=nodedotjs)
![Zero runtime deps](https://img.shields.io/badge/server%20deps-0-0a0a0a?style=flat-square)
![Free AI](https://img.shields.io/badge/AI-free%20OpenRouter%20models-0a0a0a?style=flat-square)

</div>

---

## Why this exists

Sending money home or selling dollars in Sri Lanka means opening nine bank websites, each with its own table layout, column order and date format. LKR Rates does that for you and answers three questions at a glance:

| Question | Where you see it |
|---|---|
| Which bank pays me the most rupees for 1 USD? | The slab headline: highest buying rate |
| Which bank charges me the least for 1 USD? | Slab, "Lowest selling", or switch the slab to Selling |
| Which bank is the fairest both ways? | Slab, "Smallest spread" |

## Features

- **The answer first.** A solid black slab (white in dark mode) names the bank paying the most for your currency, the rate at full size, how it moved, and the history line. Scrub the chart to see any past point; switch to selling or to a single bank.
- **9 banks:** Commercial Bank, Bank of Ceylon, People's Bank, Sampath, NDB, Seylan, Nations Trust, DFCC and NSB.
- **Top currencies and search.** The ten most-used currencies with the best bank for each, and search by bank or currency ("sampath", "eur", "yen"). Runs on the rates already loaded, so no extra requests or tokens.
- **Flags** in front of every currency, from inline SVGs.
- **Share like an exchange app.** One tap makes a 1080×1350 rate card and opens your phone's share sheet for WhatsApp, Telegram, Instagram and others. On desktop it saves the PNG.
- **Install it as an app** on Windows, macOS, Android or iPhone. The last rates stay readable offline.
- **Telegram bot** that answers a currency with the share image, plus bank menus, best rates today, and per-bank refresh on request. Admins also see token usage for today and all time.
- **API for agents** such as Hermes, with an OpenAPI description and optional bearer tokens.
- **One time standard.** Every bank writes dates its own way (`02.11.2026 11:30 AM`, `Monday, November 02 2026`, `02 Nov 2026 - 10:56AM`…). They are all converted to ISO in Sri Lanka time.
- **Runs on free AI.** A free OpenRouter model copies each rate table, so the API cost is $0.
- **Refreshes itself.** Every 3 hours. Manual refresh on the web is capped at 2 per hour so the free quota lasts. Rates and history survive restarts.
- **Bold, modern, black and white.** Light and dark themes that follow your device. Poppins for headings, Inter for text, JetBrains Mono for every number. See [DESIGN.md](DESIGN.md).
- **Zero-dependency server.** `server.mjs` and `bot.mjs` use only Node's standard library.

## How it reads the banks (and why it's accurate)

Letting an AI "find the TT rate" in a table sounds simple, but it isn't reliable. In testing, the model regularly took the cheques column instead, because pages label the first column group just "Currency". So the work is split:

```
bank page ──► strip HTML ──► free AI model copies every number in each row, in order
                                     │
                                     ▼
              code picks the TT columns by position (fixed per bank, checked by hand)
                                     │
                                     ▼
              sanity checks: 3-letter ISO code, selling ≥ buying, spread < 50%
```

The model only transcribes, which it does reliably, and the code does the reasoning. Sampath publishes JSON, so it skips the model entirely.

## Quick start

```bash
git clone https://github.com/harindujayakody/exchnage-rates-srilanka.git
cd exchnage-rates-srilanka
cp .env.example .env          # then paste your OpenRouter key
npm install                   # optional: lets the Telegram bot send rate images
npm run build                 # builds the web UI
npm run dev                   # http://localhost:3000
```

Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys). On a host that sets environment variables for you, run `npm start` instead of `npm run dev`.

### Install as an app

Open the site in Chrome or Edge (Windows, macOS, Android) and choose **Install app** in the footer or the address bar. On iPhone, tap **Share**, then **Add to Home Screen**. Installing needs HTTPS (or `localhost`).

## Telegram bot

1. Message [@BotFather](https://t.me/BotFather), send `/newbot`, and copy the token.
2. Add it to `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC-your-bot-token
   ```
3. Restart the server. It uses long polling, so it works without a public URL.
4. Send `/myid` to your bot, then put that number in `TELEGRAM_ADMIN_IDS` to unlock usage.

| Command or input | What you get |
|---|---|
| `/start` | Main menu: Currencies, Banks, Best today, About (and Usage for admins) |
| `/best` | Best buying and selling bank for each top currency |
| `/currencies`, `/banks` | Pick from a menu |
| `usd`, `yen`, `dollar` | The rate image for that currency, with every bank in the caption |
| `seylan`, `boc` | Every rate that bank publishes, with a Refresh button |
| `/usage` | Admin only: requests, tokens and cost for today and all time |

Rate images need the optional `@napi-rs/canvas` package (`npm install` in the project root installs it; without it the bot sends text). Set `PUBLIC_URL` to print your site address on them.

The bot reads the saved rates, so browsing costs no tokens. **Refresh** fetches only that one bank, and only when its data is more than 10 minutes old.

## API

All endpoints return JSON and are limited to 120 requests a minute per IP. There is no CORS header, so other websites can't read them from a visitor's browser. Servers, scripts and agents can.

**Use it from Hermes or another agent:** point it at `https://your-host/openapi.json`. If you set `API_TOKENS`, give the agent one of them as a bearer token:

```bash
curl -H "Authorization: Bearer $TOKEN" "https://your-host/rates?currency=USD"
```

| Endpoint | Returns |
|---|---|
| `GET /rates` | Every bank with its rates |
| `GET /rates/:bank` | One bank, e.g. `/rates/boc` |
| `GET /rates?currency=USD` | One currency across every bank |
| `GET /banks` | Bank ids |
| `GET /openapi.json` | OpenAPI 3.1 description of these endpoints |
| `GET /api/status` | What the dashboard shows: banks, refresh times, manual limit (no token usage) |
| `GET /api/history?currency=USD` | Every saved snapshot: `[{ at, rates: { boc: [buying, selling] } }]` |
| `POST /api/refresh` | Manual refresh. Only accepted from the app's own page, 2 per hour |

```jsonc
// GET /rates/seylan?currency=USD
{
  "id": "seylan",
  "name": "Seylan Bank",
  "bankUpdatedAt": "2026-11-02T10:56:00+05:30",
  "rates": [{ "currency": "USD", "buying": 329, "selling": 336 }]
}
```

## Security

- The OpenRouter key and the Telegram token live only in `.env` on the server. They are never sent to the browser, logged or returned by any endpoint, and `.env` is git-ignored.
- Token usage is not public: it was removed from the web page and the API, and the bot shows it only to admin ids.
- Optional `API_TOKENS` lock the data endpoints to callers with a bearer token (compared in constant time); the web app itself still works without one.
- There is no CORS header, so other websites can't read the API from a visitor's browser.
- Manual refresh only works from the app itself, and the server checks `Sec-Fetch-Site` and `Origin`.
- Every API route has a per-IP rate limit. Behind a reverse proxy, set `TRUST_PROXY=1` so it sees real visitor IPs.
- Responses carry a strict Content-Security-Policy plus `nosniff`, `DENY` framing and a referrer policy.
- Static file serving can't escape `web/dist`, and server errors never reach the client.

## Configuration

| Variable | Default | |
|---|---|---|
| `OPENROUTER_API_KEY` | required | Your OpenRouter key |
| `PORT` | `3000` | |
| `HOST` | all interfaces | Set `127.0.0.1` to keep it local |
| `REFRESH_HOURS` | `3` | Free models allow about 50 requests a day. One refresh uses about 8 |
| `OPENROUTER_MODELS` | Nemotron 3.5 Super, Gemma 4 31B (both `:free`) | Tried in order |
| `DATA_DIR` | `data` | Where `state.json` and `history.jsonl` are written |
| `TRUST_PROXY` | off | Trust `X-Forwarded-For` |
| `TELEGRAM_BOT_TOKEN` | off | Starts the Telegram bot |
| `TELEGRAM_ADMIN_IDS` | none | Telegram user ids that can see usage |
| `API_TOKENS` | open | Comma-separated bearer tokens for the data API |
| `PUBLIC_URL` | none | Your site address, printed on the bot's share images |

## Add a bank

1. Add an entry to `BANKS` in [`server.mjs`](server.mjs). `tt` gives the positions of the TT buying and selling numbers in a table row, counting from 0.
2. Drop its logo in `web/public/logos/` and add it to `LOGOS` in [`web/src/App.tsx`](web/src/App.tsx).
3. Run `npm test`, start the server, and compare the result with the bank's own page.

HNB and Pan Asia aren't included yet. Their pages only show rates after running JavaScript or passing a bot check.

## Project layout

```
server.mjs        API, scheduler, AI extraction, security (no dependencies)
bot.mjs           Telegram bot (no dependencies)
cardimage.mjs     draws the share image in Node for the bot (optional @napi-rs/canvas)
test.mjs          checks for parsing, dates, limits, usage, tokens, bot (npm test)
PRODUCT.md        who it is for and what it must do
DESIGN.md         the design system
CHANGELOG.md      release notes
web/              React + Vite + shadcn/ui dashboard
web/public/logos  bank logos
web/src/card.js   the share image, drawn the same way in the browser and the bot
web/src/share.ts  sharing it from the web page
web/src/assets/flags  currency flags (country-flag-icons, MIT)
data/             runtime state and history (git-ignored)
```

## Disclaimer

Rates are indicative and are read automatically from public bank websites. They can be wrong or out of date, so always confirm with your bank before you transact. This project is not affiliated with any bank. Bank names and logos belong to their owners.

## Credits

Built by **[Harindu Jayakody](https://github.com/harindujayakody)**.

<a href="https://www.flaticon.com/free-icons/sri-lanka" title="sri lanka icons">Sri lanka icons created by designhub - Flaticon</a>

Flags from [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) by catamphetamine (MIT).

## License

[MIT](LICENSE). Use it, fork it or ship it commercially. Just keep the copyright notice and credit the original project:

> Based on [LKR Rates](https://github.com/harindujayakody/exchnage-rates-srilanka) by Harindu Jayakody.
