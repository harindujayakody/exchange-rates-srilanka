---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# Front page (dashboard)

Mode: Operate. Audience: Sri Lankans abroad checking which bank pays the most before sending money home, mostly on a phone. Task: see the best bank and rate for one currency in a glance, trust its freshness, compare every bank, search, share, install.

## Direction contract

THESIS: The answer is a solid slab. One inverted block (black on the white theme, white on the black theme) states which bank pays the most and the rate at monumental size; everything around it is crisp ruled monochrome. Refuses the category default: a soft dark fintech dashboard of rounded cards, green glows and gradient tiles.

OWN-WORLD: Pure white and near-black fields, 1px and 2px solid rules, no shadows, no gradients, no glass, corners 4px or square. Poppins 700/800 for headings and the slab's bank name, Inter for text, JetBrains Mono for every number and code. Colour appears only for movement: green up, red down, always with an arrow and a sign.

STORY: The visitor reads "Seylan Bank pays Rs 329.00 for 1 USD", sees it was updated minutes ago, switches currency from the rail, scans every bank in a ruled table, searches a bank or currency, then shares the rate as an image or installs the app.

FIRST VIEWPORT: Sticky top bar (logo, LKR Rates, theme toggle, GitHub, Refresh with count). Under it a horizontal currency rail; the current currency is an inverted chip. Then the slab across the full content width: left column the bank name alone in Poppins 800 as the headline (no sentence, no kicker), the rate monumental in JetBrains Mono with its decimals attached, the change line with arrow and signs, what the number means ("Highest buying rate · for 1 USD · date"), then three ruled lines (lowest selling or highest buying, smallest spread, banks quoting) and a status line (updated, next update); the manual refresh count lives on the header Refresh button; right column the history chart inside the slab with range buttons and a Share button. Bank/side selectors sit on the slab's top edge.

FORM: user-pinned bold modern black and white (supersedes the rolled direction); seed:7beba78b5ecadca2. Signature move: switching currency, bank or side re-sets the slab's figures with a short fade-and-rise from 0.35 opacity (420ms, exponential ease-out), the only authored motion on the page. It starts visible on purpose: a clip-path wipe left the figures hidden wherever animations are paused.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
