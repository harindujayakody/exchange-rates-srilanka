// The 1080x1350 rate card. Plain JavaScript on the Canvas 2D API, shared by the web page (browser canvas)
// and the Telegram bot (@napi-rs/canvas in Node), so both draw exactly the same image.
//
// d: { currency, currencyName, bank, meaning, value, change?: { abs, pct, good, range }, series: number[],
//      rows: [{ name, buying, selling }], at: ISO string }
// opts: { logo?: drawable image, host: string, fonts: { head, sans, mono } (CSS family lists) }

export const CARD_W = 1080
export const CARD_H = 1350
const PAD = 80
const INK = "#fafafa"
const DIM = "#a6a6a6"
const num = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

// Shrinks the font until the text fits the width, so long bank names never run off the card.
function fitFont(ctx, text, weight, family, size, maxWidth) {
  let s = size
  do ctx.font = `${weight} ${s}px ${family}`
  while (ctx.measureText(text).width > maxWidth && (s -= 4) > 24)
}

export function drawCard(ctx, d, { logo, host, fonts }) {
  const { head: HEAD, sans: SANS, mono: MONO } = fonts
  const W = CARD_W, H = CARD_H

  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  // Brand row
  if (logo) ctx.drawImage(logo, PAD, 72, 64, 64)
  ctx.fillStyle = INK
  ctx.font = `700 40px ${HEAD}`
  ctx.fillText("LKR Rates", PAD + 84, 118)
  ctx.fillStyle = DIM
  ctx.font = `400 28px ${SANS}`
  ctx.textAlign = "right"
  ctx.fillText(new Date(d.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }), W - PAD, 116)
  ctx.textAlign = "left"
  ctx.fillStyle = INK
  ctx.fillRect(PAD, 176, W - PAD * 2, 3)

  // Currency
  ctx.font = `700 40px ${MONO}`
  ctx.fillText(`${d.currency} → LKR`, PAD, 262)
  ctx.fillStyle = DIM
  ctx.font = `400 30px ${SANS}`
  ctx.fillText(`${d.currencyName} · telegraphic transfer`, PAD, 310)

  // Bank, what the number means, and the rate
  ctx.fillStyle = INK
  fitFont(ctx, d.bank, "800", HEAD, 72, W - PAD * 2)
  ctx.fillText(d.bank, PAD, 410)
  ctx.fillStyle = DIM
  ctx.font = `600 30px ${SANS}`
  ctx.fillText(d.meaning, PAD, 460)
  ctx.font = `500 56px ${MONO}`
  ctx.fillText("Rs", PAD, 610)
  ctx.fillStyle = INK
  const rate = num(d.value)
  fitFont(ctx, rate, "700", MONO, 150, W - PAD * 2 - 110)
  ctx.fillText(rate, PAD + 100, 610)
  if (d.change) {
    ctx.fillStyle = d.change.good ? "#4ade80" : "#ff7b6b"
    ctx.strokeStyle = ctx.fillStyle
    ctx.font = `600 34px ${MONO}`
    const sign = d.change.abs >= 0 ? "+" : ""
    // Drawn arrow (shaft and head), the same shape as the page's Lucide arrows.
    const up = d.change.abs >= 0, cx = PAD + 14, top = up ? 644 : 676, bottom = up ? 676 : 644
    ctx.lineWidth = 4
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(cx, bottom); ctx.lineTo(cx, top)
    ctx.moveTo(cx - 12, top + (up ? 12 : -12)); ctx.lineTo(cx, top); ctx.lineTo(cx + 12, top + (up ? 12 : -12))
    ctx.stroke()
    ctx.fillText(`${sign}${num(d.change.abs)} (${sign}${d.change.pct.toFixed(2)}%) · ${d.change.range}`, PAD + 42, 672)
  }

  // History line
  if (d.series.length > 1) {
    const top = 720, bottom = 880, min = Math.min(...d.series), max = Math.max(...d.series)
    const y = (v) => (max === min ? (top + bottom) / 2 : bottom - ((v - min) / (max - min)) * (bottom - top))
    ctx.strokeStyle = INK
    ctx.lineWidth = 5
    ctx.lineJoin = "round"
    ctx.beginPath()
    d.series.forEach((v, i) => {
      const x = PAD + (i / (d.series.length - 1)) * (W - PAD * 2)
      if (i) ctx.lineTo(x, y(v)); else ctx.moveTo(x, y(v))
    })
    ctx.stroke()
  }

  // Top banks
  let rowY = 950
  ctx.fillStyle = DIM
  ctx.font = `500 26px ${SANS}`
  ctx.fillText("Bank", PAD, rowY)
  ctx.textAlign = "right"
  ctx.fillText("Buying", W - PAD - 230, rowY)
  ctx.fillText("Selling", W - PAD, rowY)
  for (const r of d.rows.slice(0, 5)) {
    rowY += 50
    ctx.textAlign = "left"
    ctx.fillStyle = INK
    ctx.font = `500 30px ${SANS}`
    ctx.fillText(r.name, PAD, rowY)
    ctx.textAlign = "right"
    ctx.font = `600 30px ${MONO}`
    ctx.fillText(num(r.buying), W - PAD - 230, rowY)
    ctx.fillText(num(r.selling), W - PAD, rowY)
  }
  ctx.textAlign = "left"

  // Footer
  ctx.fillStyle = INK
  ctx.fillRect(PAD, H - 100, W - PAD * 2, 3)
  ctx.fillStyle = DIM
  ctx.font = `400 24px ${SANS}`
  ctx.fillText("Indicative rates. Confirm with your bank before you transact.", PAD, H - 48)
  ctx.textAlign = "right"
  ctx.fillStyle = INK
  ctx.fillText(host, W - PAD, H - 48)
  ctx.textAlign = "left"
}
