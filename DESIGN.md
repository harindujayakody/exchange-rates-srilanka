---
name: LKR Rates
description: Which Sri Lankan bank pays the most for your money today, stated as one inverted slab in ruled black and white.
colors:
  paper: "#ffffff"
  ink: "#0a0a0a"
  snow: "#fafafa"
  wash: "#f2f2f2"
  wash-dark: "#1a1a1a"
  wash-dark-raised: "#1f1f1f"
  popover-dark: "#141414"
  graphite: "#595959"
  graphite-dark: "#a6a6a6"
  hairline: "#dcdcdc"
  hairline-dark: "#2a2a2a"
  field-edge: "#cfcfcf"
  field-edge-dark: "#333333"
  up: "#0b7a3b"
  down: "#c42b1c"
  up-dark: "#4ade80"
  down-dark: "#ff7b6b"
  slab-up: "#4ade80"
  slab-down: "#ff7b6b"
  slab-up-dark: "#0b7a3b"
  slab-down-dark: "#c42b1c"
typography:
  display:
    fontFamily: "Poppins, Inter Variable, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  rate:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "6rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\", \"zero\""
  headline:
    fontFamily: "Poppins, Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Poppins, Inter Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  numeral:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
    fontFeature: "\"tnum\", \"zero\""
  code:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"zero\""
rounded:
  flag: "2px"
  sm: "3px"
  md: "4px"
  lg: "5px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "40px"
  button-on-slab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-icon:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "40px"
  button-icon-hover:
    backgroundColor: "{colors.wash}"
  chip-currency:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  chip-currency-hover:
    backgroundColor: "{colors.wash}"
  chip-currency-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  best-value-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.numeral}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-stale:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.down}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 36px"
    height: "40px"
  slab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "32px"
  list-row-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "12px 8px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: LKR Rates

## Overview

**Creative North Star: "The Rate Board"**

LKR Rates reads like a bank's own rate board, rebuilt in print: pure white paper, near-black ink, and one answer set solid. The page is organised around a single inverted block, the slab, that names the bank paying the most and its rate at monumental size. Everything else is crisp ruled monochrome: 2px ink rules under the header and every section head, 1px hairlines between rows, and tight 3-5px corners. Depth comes from inversion (ink on paper becomes paper on ink), never from shadow.

The system is dense but calm. Numbers do the talking in JetBrains Mono with tabular, slashed-zero figures so columns align and 0 never reads as O. Poppins carries the bank name and section heads; Inter carries everything a person reads as a sentence. Colour is reserved for movement only, green up and red down, and always travels with an arrow and a sign. Both themes are first-class: the dark theme is the exact inversion of the light one, and the slab inverts with it.

The world explicitly refuses the category default: a soft dark fintech dashboard of rounded cards, green glows and gradient tiles.

**Key Characteristics:**
- One inverted slab per screen carries the answer; nothing else competes with it.
- Solid rules (2px ink for structure, 1px hairline for rows) instead of boxes and cards.
- Every number in JetBrains Mono, tabular and slashed-zero.
- Colour only for movement, always paired with an arrow and a +/- sign.
- Selection and "best" are shown by inversion, not by tint.
- Flat: no shadows, no gradients, no glows, no glass.

## Colors

A strict two-ink system, paper and ink, with a single pair of movement colours that swap with the theme.

### Primary
- **Ink** (#0a0a0a): text, 2px structural rules, the primary button, the active currency chip, the best-value chip, tooltips, and the slab and footer field on the light theme. In the dark theme it becomes the page ground.
- **Paper** (#ffffff): the light theme ground and the text on every inverted surface. In the dark theme, **Snow** (#fafafa) takes its place as text, rules and slab field.

### Secondary
- **Ledger Green** (`up` #0b7a3b light, `up-dark` #4ade80 dark): a rate moved in the customer's favour. Higher buying or lower selling is "good", so the colour follows the customer, not the raw sign.
- **Signal Red** (`down` #c42b1c light, `down-dark` #ff7b6b dark): a rate moved against the customer; also the offline banner border and the Stale/Unavailable badge. It doubles as `destructive`.
- **Slab movement** (`slab-up` / `slab-down`): the slab is inverted, so it borrows the opposite theme's pair (#4ade80 / #ff7b6b inside the ink slab on light; #0b7a3b / #c42b1c inside the snow slab on dark). Never use `up`/`down` inside the slab.

### Neutral
- **Wash** (#f2f2f2 light, `wash-dark` #1a1a1a dark): hover fill for chips, icon buttons and list rows; skeleton fill; muted surfaces. `wash-dark-raised` (#1f1f1f) is the dark accent fill.
- **Graphite** (#595959 light, `graphite-dark` #a6a6a6 dark): secondary text: hints under section heads, currency names, the second figure in a row, bank-updated times. Passes 7:1 on paper.
- **Hairline** (#dcdcdc light, `hairline-dark` #2a2a2a dark): 1px row dividers and table borders.
- **Field Edge** (#cfcfcf light, `field-edge-dark` #333333 dark): stock input stroke (overridden to a 2px ink edge on the search field).
- **Popover Dark** (#141414): menu and listbox ground in the dark theme only.
- On inverted surfaces, secondary text is the ground colour at reduced opacity (paper at 60-70%), and internal rules are paper at 15%.

### Named Rules
**The Movement-Only Rule.** Colour appears only to mark a rate moving, and a broken state. Selection, rank, emphasis and brand are all ink and paper.

**The Borrowed Pair Rule.** Inside the slab, movement uses `slab-up`/`slab-down`, the other theme's pair, so green and red keep their contrast on the inverted field.

**The Inversion Rule.** "Selected" and "best" are expressed by swapping ink and paper (active chip, active row, best-value chip), never by a tint, outline glow or colour.

## Typography

**Display Font:** Poppins (with Inter Variable, sans-serif)
**Body Font:** Inter Variable (with sans-serif)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, monospace)

**Character:** Poppins is geometric and heavy, used only where a name must land: the bank in the slab, section heads, the wordmark. Inter is the quiet reading voice. JetBrains Mono gives every rate, code and count the fixed-width, slashed-zero look of a terminal rate board.

### Hierarchy
- **Display** (Poppins 800, 1.875rem mobile to 2.75rem from 640px, line-height 1.25, -0.025em, balanced wrap): the bank name in the slab, and only that. The headline is the bank name alone, no sentence around it.
- **Rate** (JetBrains Mono 700, 3.75rem mobile, 4.5rem from 640px, 6rem from 1024px, line-height 1, -0.04em): the slab's whole-number rate. The "Rs" prefix (500, 1.5-1.875rem) sits beside it with an 8px gap; the decimals (600, 1.875-2.25rem) are attached to the whole number with no gap, both at 60% opacity on one baseline.
- **Headline** (Poppins 700, 1.5rem, -0.025em): section heads ("Top currencies", "USD at every bank", "Search results").
- **Title** (Poppins 700, 1.25rem wordmark, 1.125rem bank sheet heading): the "LKR Rates" wordmark and bank names over per-bank tables.
- **Body** (Inter 400, 0.875rem, line-height 1.43): hints, table text, slab meta lines, footer copy (relaxed 1.625 leading, max ~24rem).
- **Label** (Inter 600, 0.75rem to 0.875rem): button text, segmented controls, the status line under the slab, footer column heads.
- **Numeral** (JetBrains Mono 600, 0.875rem): every rate, spread, count and change figure in rows, tables and controls.
- **Code** (JetBrains Mono 700, 1.125rem in list rows, 0.875rem 600 in chips): currency codes, always preceded by a flag.

### Named Rules
**The Tabular Rule.** Every number is JetBrains Mono with `font-variant-numeric: tabular-nums slashed-zero` (applied to every `.font-mono`). No proportional figures anywhere a rate appears, including the share card.

**The Bank-Is-The-Headline Rule.** The largest words on the page are a bank's name; the largest figure is that bank's rate. What the figure means ("Highest buying rate · for 1 USD") sits beneath in body text.

## Layout

A single centred column, max width 72rem (1152px), with 16px side padding on mobile and 24px from 640px. A sticky 64px header sits on a 2px ink rule. The main column stacks with 40px between sections: currency rail and slab together (16px apart), then Top currencies, then the comparison table.

The slab is one column on mobile and splits 5:7 from 1024px (figures left, history chart right, divided by a paper-at-15% rule). Slab padding is 20px mobile, 32px from 640px, with 24px between its blocks. Top currencies is a ruled list that becomes two columns from 1024px with a 40px gutter; bank search results become two columns from 768px. The currency rail scrolls horizontally, bleeding to the screen edge on mobile with its scrollbar hidden.

Tables shed columns as width drops: Spread hides below 768px, Bank updated and bank logos below 640px. The ink footer runs full width at the bottom with a 1.5fr/1fr/1fr grid from 768px.

Spacing rhythm is 4px-based: 4 and 8px inside controls, 12px row padding, 16px between related blocks, 24-32px inside the slab, 40px between sections.

## Elevation & Depth

The system is flat. There are no shadows, gradients, glows or translucent glass on any page surface. Depth and hierarchy come from three things only: inversion (the slab, active chips and rows, best-value chips, tooltips and the footer are ink fields on paper, or snow on ink in dark), rule weight (2px ink for structure, 1px hairline for rows), and type weight.

### Named Rules
**The Flat Ink Rule.** If something needs to stand forward, invert it or rule it. Never lift it with a shadow.

## Shapes

Corners are tight and nearly square: 4px (`md`) on the slab, buttons, chips, segmented controls, the search field, the listbox, the offline banner and skeletons; 3-4px on the best-value chip, status badge and small icon buttons; 5px (`lg`) is the ceiling. Flags are 3:2 frames (14 x 21px) with 2px corners and a 1px ring at 15% black (20% white in dark), so white-field flags still read on paper. Bank logos sit in a 28 x 56px white tile with a 1px hairline ring in both themes, because the logos belong to the banks and are drawn for white.

Rules are the main shape language: 2px ink under the header, under every section head and under each bank sheet title; 2px ink outlines on currency chips, the More select and the search field; 1px hairlines between rows; 1px paper-at-30% outlines on controls inside the slab.

## Components

### Buttons
Solid, square-shouldered, and inverted rather than coloured.
- **Shape:** tight corners (4px), 40px tall in the header, 36px elsewhere, 14px horizontal padding, Inter 600 at 0.875rem with a 16px icon.
- **Primary (Refresh):** ink field, paper text, with the remaining manual-refresh count in mono at 70% opacity ("2/2"). The label hides below 640px; the icon and count stay.
- **On-slab / on-footer (Share, Install app):** paper field, ink text, the inversion of primary.
- **Outline on ink (Star on GitHub):** transparent with a 1px paper-at-30% outline; hover fills paper at 10%.
- **Icon buttons (theme, GitHub):** 40px square, no fill at rest, wash fill on hover, 18px icons, each with a tooltip and an aria-label.
- **Hover / Focus / Disabled:** filled buttons fade to 85% opacity on hover; disabled drops to 40% with a not-allowed cursor; busy swaps the icon for a spinning loader and the label to "Updating". Focus is a global 2px ring-colour outline offset 2px.

### Chips (currency rail)
- **Style:** 36px tall, 2px ink outline, 4px corners, flag then code in JetBrains Mono 600 at 0.875rem, 8px between flag and code, 6px between chips.
- **State:** the current currency is inverted (ink field, paper text) and carries `aria-pressed`; others take the wash on hover. The trailing "More" select uses the same chip and inverts when the chosen currency is not in the rail.

### The Slab (signature)
The answer as one solid block: ink on the light theme, snow on the dark.
- **Top edge:** the bank select (192px, paper-at-30% outline, transparent) and a Buying/Selling segmented control. Segments are 0.75rem Inter 600; the active one is a paper chip with ink text, inactive ones are paper at 70%.
- **Figures:** bank name in Display, then "Rs", the whole rate and decimals on one mono baseline, then a change line (arrow + signed change + percent + range, in `slab-up`/`slab-down`) followed by the meaning and timestamp.
- **Ruled facts:** a definition list between paper-at-15% rules: the opposite side's best, smallest spread, banks quoting. Label at 70% left, mono value and short bank name right.
- **Status line:** "Updated … · next update … · TT rates, LKR per 1 unit", 0.75rem at 60%, pinned to the bottom.
- **Chart side:** a 2.5px paper line with no fill, no grid, only min and max ticks on the right axis in 11px mono at 60%. Hovering a point replaces the slab's figures with that point's bank and value. Range buttons (1D to Max) are mono segments; Share sits beside them. Fewer than two points shows a dashed paper-at-25% frame: "The history line starts here."

### Ruled list rows (Top currencies)
- **Style:** full-width buttons on a 1px hairline bottom rule, 12px vertical and 8px horizontal padding, three columns (code + currency name, who pays most · who charges least, buying over selling in mono, right-aligned).
- **State:** hover takes the wash; the current currency inverts to an ink row with paper text and secondary text at 70%. Selecting a row scrolls back to the slab.

### Tables
- **Style:** stock rows with 1px hairline rules, 40px header cells in Inter 500, wash-at-50% row hover. Numeric columns are right-aligned mono.
- **Best value:** the highest buying and lowest selling figure in each column is an inverted chip (ink field, paper text, mono 700, 4px corners, 2px 8px padding), with a title and a screen-reader suffix "(pays the most)" / "(charges the least)".
- **Missing data:** "Not offered" or "Loading…" in graphite across the rate columns; missing bank times render as an em dash.

### Inputs / Fields
- **Style:** the search field is 40px tall with a 2px ink outline, 4px corners, a 16px search icon inset 12px left and a clear button right.
- **Focus:** the global 2px ring outline, offset 2px.

### Navigation
- **Header:** sticky, paper ground, 2px ink bottom rule; logo (32px) and "LKR Rates" in Poppins 700 at 1.25rem left; theme, GitHub and Refresh right.
- **Footer:** a full-width ink field (snow in dark) holding the wordmark, product line, Install and GitHub buttons, Sources and Project link columns (paper at 70%, full paper and underline on hover), and a bottom bar over a paper-at-15% rule with the builder credit and the indicative-rates disclaimer.

### Share card
A 1080 x 1350 PNG drawn on canvas, always on the dark palette regardless of theme: #0a0a0a ground, #fafafa ink, #a6a6a6 secondary, 80px margins. Order: logo and wordmark with the Colombo-time timestamp, a 3px ink rule, "USD → LKR" in mono 700 with the currency name, the bank name in Poppins 800 at up to 72px (shrinks to fit), the meaning, "Rs" plus the rate in mono 700 at up to 150px (shrinks to fit), the change line in #4ade80 / #ff7b6b, a 5px history line, the top five banks with mono buying and selling columns, then a 3px rule, the disclaimer and the host. It goes to the system share sheet or downloads.

### States
- **Loading:** skeleton blocks in the wash colour with a pulse (paper at 15% inside the slab); ten 48px skeletons for the top list, six 40px for the table.
- **Stale / Unavailable:** a small badge beside the bank name: 1px `down` outline, `down` text, 11px Inter 600, warning icon and the word "Stale" (has old rates) or "Unavailable" (none); the error sits in a tooltip.
- **Empty search:** centred text, "Nothing matches “query”." in ink with a suggestion line in graphite.
- **Offline:** a `role="alert"` banner with a 2px `down` outline, warning icon and "Can't reach the rates server. Retrying automatically."
- **Toasts:** bottom-centre, theme-matched, for refresh progress, share saves and install.

### Motion
One authored motion: the **slab wipe**. When the currency, bank or side changes, the slab's figures fade and rise in over 420ms (`cubic-bezier(0.16, 1, 0.3, 1)`) from 35% opacity and 6px down. It starts visible so the figures are readable if the animation never runs, and it is removed under `prefers-reduced-motion`. Everything else is colour or opacity transitions on hover.

## Do's and Don'ts

### Do:
- **Do** put the answer in the slab: bank name in Poppins 800, the rate in JetBrains Mono 700, inverted against the page.
- **Do** set every number in JetBrains Mono with tabular, slashed-zero figures.
- **Do** mark selection and "best" by inverting ink and paper, and add an aria-pressed state or a screen-reader label so it is never visual-only.
- **Do** pair every movement colour with an arrow icon and a +/- sign; inside the slab use `slab-up`/`slab-down`.
- **Do** separate sections with a 2px ink rule under the heading and rows with 1px hairlines.
- **Do** put a flag before every currency code, in the same 14 x 21px frame, with an empty frame when no flag exists so rows stay aligned.
- **Do** show provenance next to every figure: which bank, and how fresh.
- **Do** keep the slab wipe as the only authored motion, and honour reduced motion.

### Don't:
- **Don't** use colour as the only signal for up, down, best, selected or broken.
- **Don't** use colour for brand, emphasis or decoration; it belongs to movement and failure only.
- **Don't** use gradients, glows, drop shadows or glass on any page surface.
- **Don't** build card grids or rounded tiles; use ruled rows, ruled tables and the one slab.
- **Don't** round corners past 5px.
- **Don't** wrap the bank name in a sentence or put a label line above it; the headline is the bank name only.
- **Don't** set display type in a system face or numbers in a proportional face.
