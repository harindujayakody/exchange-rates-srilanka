// Types for card.js (kept as plain JavaScript so Node can run it for the Telegram bot).
export const CARD_W: number
export const CARD_H: number
export function drawCard(
  ctx: CanvasRenderingContext2D,
  d: {
    currency: string; currencyName: string; bank: string; meaning: string; value: number
    change?: { abs: number; pct: number; good: boolean; range: string }
    series: number[]; rows: { name: string; buying: number; selling: number }[]; at: string
  },
  opts: { logo?: CanvasImageSource; host: string; fonts: { head: string; sans: string; mono: string } },
): void
