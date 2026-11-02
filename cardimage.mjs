// Draws the share card as a PNG in Node for the Telegram bot, using the same card.js as the web page.
// Optional: needs @napi-rs/canvas (an optionalDependency). Without it the bot just sends text.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = import.meta.dirname;
const FONT_DIRS = [
  'web/node_modules/@fontsource-variable/inter/files',
  'web/node_modules/@fontsource-variable/jetbrains-mono/files',
  'web/node_modules/@fontsource/poppins/files',
];

// Returns render(card, host) -> PNG Buffer, or null when the canvas library isn't installed.
export async function createCardRenderer(log = console) {
  let canvas;
  try { canvas = await import('@napi-rs/canvas'); } catch {
    log.log('Telegram bot: install @napi-rs/canvas to send rate images (text only for now)');
    return null;
  }
  const { createCanvas, GlobalFonts, loadImage } = canvas;
  // Latin subsets of the web fonts (installed by `npm run build`); system fonts are the fallback.
  for (const dir of FONT_DIRS.map(d => path.join(ROOT, d)).filter(existsSync)) {
    for (const f of readdirSync(dir).filter(f => /latin-(wght|700|800)-normal\.woff2$/.test(f))) {
      GlobalFonts.registerFromPath(path.join(dir, f), f.startsWith('poppins') ? 'Poppins' : undefined);
    }
  }
  const { drawCard, CARD_W, CARD_H } = await import('./web/src/card.js');
  const logo = await loadImage(path.join(ROOT, 'web/public/logo.png')).catch(() => undefined);
  return (card, host) => {
    const c = createCanvas(CARD_W, CARD_H);
    drawCard(c.getContext('2d'), card, {
      logo, host,
      fonts: { head: 'Poppins, Inter, sans-serif', sans: 'Inter, sans-serif', mono: '"JetBrains Mono", monospace' },
    });
    return c.encode('png');
  };
}
