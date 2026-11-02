// Renders the shareable rate card in the browser and hands it to the system share sheet, or saves it.
// The drawing itself lives in card.js, shared with the Telegram bot.
import { CARD_H, CARD_W, drawCard } from "./card.js"

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

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function renderCard(d: ShareCard): Promise<Blob> {
  await Promise.all([
    document.fonts.load('800 72px "Poppins"'), document.fonts.load('700 40px "Poppins"'),
    document.fonts.load('700 150px "JetBrains Mono Variable"'), document.fonts.load('400 30px "Inter Variable"'),
  ]).catch(() => {})
  const canvas = document.createElement("canvas")
  canvas.width = CARD_W
  canvas.height = CARD_H
  const logo = await loadImage("/logo.png").catch(() => undefined) // the card still works without it
  drawCard(canvas.getContext("2d")!, d, {
    logo, host: location.host,
    fonts: {
      head: '"Poppins", "Inter Variable", sans-serif',
      sans: '"Inter Variable", system-ui, sans-serif',
      mono: '"JetBrains Mono Variable", ui-monospace, monospace',
    },
  })
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
