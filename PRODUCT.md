# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sri Lankans working or living abroad, and their families, checking which Sri Lankan bank gives the most rupees for their foreign currency before they send money home. They usually check on a phone, often in a short break, and want one answer fast: which bank, what rate, how fresh. Secondary: anyone in Sri Lanka comparing where to sell or buy foreign currency.

## Product Purpose

LKR Rates puts every major Sri Lankan bank's telegraphic transfer (TT) buying and selling rate on one screen and in a Telegram bot, so a sender can pick the best bank without opening nine bank websites. Success: the visitor knows the best bank for their currency within seconds and trusts the number enough to act on it.

## Positioning

Rates are read directly from each bank's own public page every 3 hours (not a third-party feed), normalised to one format and time standard, ranked, and kept as history. It is free and open source (MIT) and runs on free AI models.

## Operating Context

- Web dashboard, installable as an app on phones and desktops.
- Telegram bot with currency and bank menus, intended to also be used from agent tools such as Hermes via the JSON API.
- Rates refresh automatically every 3 hours; manual refresh on the web is limited to 2 per hour. The bot serves saved rates and refreshes one bank on request only when its data is more than 10 minutes old.
- Users share a rate snapshot image to WhatsApp and other apps.

## Capabilities and Constraints

- Banks: Commercial Bank, Bank of Ceylon, People's Bank, Sampath, NDB, Seylan, Nations Trust, DFCC, NSB. HNB and Pan Asia are not supported (JavaScript-only or bot-checked pages).
- Rate type: telegraphic transfer only, in LKR per 1 unit of foreign currency. "Buying" = what the bank pays the customer; "Selling" = what the customer pays the bank.
- Bank update times are shown in Sri Lanka time; some banks publish only a date.
- Token usage is private to the admin (shown in the Telegram bot only, never on the public web page).
- English only for now.
- Rates are indicative; the product must always tell people to confirm with their bank before transacting.

## Brand Commitments

- Name: LKR Rates. Repository: github.com/harindujayakody/exchnage-rates-srilanka. Built by Harindu Jayakody; credit must stay visible.
- Logo: web/public/logo.png (wallet icon by designhub, Flaticon; credit required).
- Bank logos in web/public/logos belong to their banks.
- User-set constraints: bold, modern, black and white (light and dark themes, following the device with a toggle); Poppins for headings, Inter for body text, JetBrains Mono for numbers; no "AI bloat" design; the headline is the bank name only, no "pays the most for" sentence; inline country flags before currency codes.

## Evidence on Hand

- Live rates and history from the running server (data/). No testimonials, user counts, press or partnerships exist; do not invent any.

## Product Principles

1. The answer first: best bank and rate for the chosen currency is visible without scrolling or reading.
2. Trust is earned with provenance: every number shows its bank and how fresh it is.
3. Fast on a phone on a weak connection.
4. Free and honest: no ads, no fabricated claims, clear "indicative rates" disclaimer.
5. Never spend AI quota the user didn't ask for.

## Accessibility & Inclusion

Readable on small phones and for less technical users; numbers must stay legible (tabular, high contrast); colour is never the only signal for up/down or best.
