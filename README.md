<div align="center">

<img src="web/public/logo.png" alt="LKR Rates logo" width="88" />

# LKR Rates

**Every Sri Lankan bank's TT rate on one dark, fast screen.**

Buying and selling rates from 9 banks, read straight from their websites every 3 hours,<br/>
charted over time and ranked so you can see who pays the most for your dollars today.

[![MIT License](https://img.shields.io/badge/license-MIT-34d399?style=flat-square)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%E2%89%A520.6-0a0a0a?style=flat-square&logo=nodedotjs)
![Zero runtime deps](https://img.shields.io/badge/server%20deps-0-0a0a0a?style=flat-square)
![Free AI](https://img.shields.io/badge/AI-free%20OpenRouter%20models-0a0a0a?style=flat-square)

</div>

---

## Why this exists

Sending money home or selling dollars in Sri Lanka means opening nine bank websites, each with its own table layout, column order and date format. LKR Rates does that for you and answers three questions at a glance:

| Card | Question it answers |
|---|---|
| **Best to sell** | Which bank pays me the most rupees for 1 USD? (highest buying rate) |
| **Best to buy** | Which bank charges me the least for 1 USD? (lowest selling rate) |
| **Overall best** | Which bank is the fairest both ways? (smallest spread) |

## Features

- **Stock-app style chart.** One big number, change over the range in green or red, a crosshair to scrub through history, and 1D, 1W, 1M, 6M, 1Y and Max ranges. Chart the best rate across banks or any single bank, buying or selling.
- **9 banks:** Commercial Bank, Bank of Ceylon, People's Bank, Sampath, NDB, Seylan, Nations Trust, DFCC and NSB.
- **One time standard.** Every bank writes dates its own way (`02.11.2026 11:30 AM`, `Monday, November 02 2026`, `02 Nov 2026 - 10:56AM`…). They are all converted to ISO in Sri Lanka time.
- **Runs on free AI.** A free OpenRouter model copies each rate table, so the API cost is $0. Token usage is one click away in the header.
- **Refreshes itself.** Rates refresh every 3 hours, and manual refresh is capped at 2 per hour so the free quota lasts. Rates and history survive restarts.
- **Dark, responsive UI** built with React, shadcn/ui and Lucide. Poppins for headings, Inter for text, JetBrains Mono for every number.
- **Zero-dependency server.** One `server.mjs` file using only Node's standard library.

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
npm run build                 # builds the web UI
npm run dev                   # http://localhost:3000
```

Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys). On a host that sets environment variables for you, run `npm start` instead of `npm run dev`.

## API

All endpoints return JSON. They are same-origin only (no CORS) and limited to 120 requests a minute per IP.

| Endpoint | Returns |
|---|---|
| `GET /rates` | Every bank with its rates |
| `GET /rates/:bank` | One bank, e.g. `/rates/boc` |
| `GET /rates?currency=USD` | One currency across every bank |
| `GET /banks` | Bank ids |
| `GET /api/status` | Everything the dashboard shows: banks, refresh times, token usage, manual limit |
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

- The OpenRouter key lives only in `.env` on the server. It is never sent to the browser, logged or returned by any endpoint, and `.env` is git-ignored.
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

## Add a bank

1. Add an entry to `BANKS` in [`server.mjs`](server.mjs). `tt` gives the positions of the TT buying and selling numbers in a table row, counting from 0.
2. Drop its logo in `web/public/logos/` and add it to `LOGOS` in [`web/src/App.tsx`](web/src/App.tsx).
3. Run `npm test`, start the server, and compare the result with the bank's own page.

HNB and Pan Asia aren't included yet. Their pages only show rates after running JavaScript or passing a bot check.

## Project layout

```
server.mjs        API, scheduler, AI extraction, security (no dependencies)
test.mjs          checks for parsing, dates, limits (npm test)
web/              React + Vite + shadcn/ui dashboard
web/public/logos  bank logos
data/             runtime state and history (git-ignored)
```

## Disclaimer

Rates are indicative and are read automatically from public bank websites. They can be wrong or out of date, so always confirm with your bank before you transact. This project is not affiliated with any bank. Bank names and logos belong to their owners.

## Credits

Built by **[Harindu Jayakody](https://github.com/harindujayakody)**.

<a href="https://www.flaticon.com/free-icons/sri-lanka" title="sri lanka icons">Sri lanka icons created by designhub - Flaticon</a>

## License

[MIT](LICENSE). Use it, fork it or ship it commercially. Just keep the copyright notice and credit the original project:

> Based on [LKR Rates](https://github.com/harindujayakody/exchnage-rates-srilanka) by Harindu Jayakody.
