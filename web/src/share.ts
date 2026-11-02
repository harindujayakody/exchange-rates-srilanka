// Renders a shareable rate card (1080x1350 PNG) and hands it to the system share sheet, or saves it.
export type ShareCard = {
  currency: string
  currencyName: string
  bank: string // e.g. "Seylan Bank"
  meaning: string // e.g. "Highest buying rate"
  value: number
  change?: { abs: number; pct: number; good: boolean; range: string }
  series: number[]
  rows: { name: string; buying: number; selling: number }[]
  at: string // ISO of the shown value
}

const W = 1080
const H = 1350
const PAD = 80
const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Shrinks the font until the text fits the width, so long bank names never run off the card.
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, size: number, maxWidth: number) {
  let s = size
  do ctx.font = `${weight} ${s}px ${family}`
  while (ctx.measureText(text).width > maxWidth && (s -= 4) > 24)
  return s
}

export async function renderCard(d: ShareCard): Promise<Blob> {
  await Promise.all([
    document.fonts.load('800 72px "Poppins"'), document.fonts.load('700 40px "Poppins"'),
    document.fonts.load('700 150px "JetBrains Mono Variable"'), document.fonts.load('400 30px "Inter Variable"'),
  ]).catch(() => {})
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  const INK = "#fafafa"
  const DIM = "#a6a6a6"
  const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'
  const SANS = '"Inter Variable", system-ui, sans-serif'
  const HEAD = '"Poppins", "Inter Variable", sans-serif'

  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = "alphabetic"

  // Brand row
  try { ctx.drawImage(await loadImage("/logo.png"), PAD, 72, 64, 64) } catch { /* card still works without the logo */ }
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

  // Headline and the rate
  ctx.fillStyle = INK
  fitFont(ctx, d.bank, "800", HEAD, 72, W - PAD * 2)
  ctx.fillText(d.bank, PAD, 410)
  ctx.fillStyle = DIM
  ctx.font = `600 30px ${SANS}`
  ctx.fillText(d.meaning, PAD, 460)
  ctx.fillStyle = DIM
  ctx.font = `500 56px ${MONO}`
  ctx.fillText("Rs", PAD, 610)
  ctx.fillStyle = INK
  const rate = num(d.value)
  fitFont(ctx, rate, "700", MONO, 150, W - PAD * 2 - 110)
  ctx.fillText(rate, PAD + 100, 610)
  if (d.change) {
    ctx.fillStyle = d.change.good ? "#4ade80" : "#ff7b6b"
    ctx.font = `600 34px ${MONO}`
    const sign = d.change.abs >= 0 ? "+" : ""
    // Drawn arrow (shaft and head), the same shape as the page's Lucide arrows.
    const up = d.change.abs >= 0, cx = PAD + 14, top = up ? 644 : 676, bottom = up ? 676 : 644
    ctx.strokeStyle = ctx.fillStyle as string
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
    const y = (v: number) => (max === min ? (top + bottom) / 2 : bottom - ((v - min) / (max - min)) * (bottom - top))
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
  ctx.fillText(location.host, W - PAD, H - 48)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the image"))), "image/png"))
}

// "shared" via the system sheet, "saved" as a download, or "cancelled" when the user closed the sheet.
export async function shareCard(d: ShareCard): Promise<"shared" | "saved" | "cancelled"> {
  const blob = await renderCard(d)
  const file = new File([blob], `lkr-rates-${d.currency.toLowerCase()}-${d.at.slice(0, 10)}.png`, { type: "image/png" })
  const text = `${d.bank}: ${d.meaning.toLowerCase()} for ${d.currency}, Rs ${num(d.value)}. Compare every bank: ${location.origin}`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "LKR Rates", text })
      return "shared"
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled"
    }
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return "saved"
}
