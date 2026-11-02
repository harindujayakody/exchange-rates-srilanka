import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle, ArrowDown, ArrowUp, Braces, Bug, ChartLine, History, Scale, Send, Download, ExternalLink, Landmark, Loader2, Moon, RefreshCw, Search, Share2, Sun, X,
} from "lucide-react"
import { Line, LineChart, Tooltip as ChartTooltip, YAxis } from "recharts"
import { toast } from "sonner"
import { ChartContainer } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { shareCard } from "@/share"
import HistoryPage from "@/HistoryPage"
import { Flag } from "@/flags"

const REPO = "https://github.com/harindujayakody/exchange-rates-srilanka"

type Rate = { currency: string; buying: number; selling: number }
export type Bank = {
  id: string; name: string; short?: string; url: string; rates: Rate[]
  bankUpdatedAt?: string | null; fetchedAt?: string; error?: string | null
}
type Status = {
  banks: Bank[]
  lastRefresh: { at: string; trigger: "scheduled" | "manual" } | null
  nextRefresh: string | null
  refreshing: boolean
  manual: { limit: number; remaining: number; resetsAt: string | null }
}
export type Snapshot = { at: string; rates: Record<string, [number, number]> }
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
export const clock = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })

// Server sends ISO in Sri Lanka time, or a bare date when the bank only publishes a date.
function bankClock(iso: string | null | undefined) {
  if (!iso) return "—"
  const dateOnly = iso.length === 10
  return new Date(dateOnly ? `${iso}T00:00:00Z` : iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Colombo" }),
  })
}

function relative(iso: string | null | undefined, now: number) {
  if (!iso) return "—"
  const mins = Math.round((new Date(iso).getTime() - now) / 60000)
  if (Math.abs(mins) < 1) return "just now"
  const [value, unit] = Math.abs(mins) < 60 ? [mins, "minute"] : Math.abs(mins) < 2880 ? [Math.round(mins / 60), "hour"] : [Math.round(mins / 1440), "day"]
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit as Intl.RelativeTimeFormatUnit)
}

// Shown in this order when offered; the first 10 offered make the rail and the list.
const TOP = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD", "CHF", "AED", "SAR", "INR", "CNY", "QAR", "KWD", "NZD"]
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" })
// CNH (offshore yuan) is not an ISO code, so browsers have no name for it.
export const currencyName = (code: string) => {
  if (code === "CNH") return "Chinese Yuan (offshore)"
  try { return currencyNames.of(code) ?? code } catch { return code }
}
const ratesFor = (banks: Bank[], code: string) => banks.map((bank) => ({ bank, rate: bank.rates.find((r) => r.currency === code) }))
export const shortName = (b: Bank) => b.short ?? b.name

type Pick = { banks: Bank[]; value: number }
function bestOf(rows: { bank: Bank; rate?: Rate }[]) {
  const offered = rows.flatMap(({ bank, rate }) => (rate ? [{ bank, rate, spread: rate.selling - rate.buying }] : []))
  if (!offered.length) return null
  const pick = (score: (o: (typeof offered)[number]) => number, better: "max" | "min"): Pick => {
    const scores = offered.map(score)
    const value = better === "max" ? Math.max(...scores) : Math.min(...scores)
    return { banks: offered.filter((o) => score(o) === value).map((o) => o.bank), value }
  }
  return { buying: pick((o) => o.rate.buying, "max"), selling: pick((o) => o.rate.selling, "min"), spread: pick((o) => o.spread, "min"), count: offered.length }
}

const RANGES = [
  { label: "1D", ms: 86_400_000 }, { label: "1W", ms: 7 * 86_400_000 }, { label: "1M", ms: 30 * 86_400_000 },
  { label: "6M", ms: 182 * 86_400_000 }, { label: "1Y", ms: 365 * 86_400_000 }, { label: "Max", ms: Infinity },
]

// One point per snapshot: a single bank's rate, or the best across banks with the bank that held it.
function seriesFrom(history: Snapshot[], bankId: string, side: "buying" | "selling", since: number) {
  const i = side === "buying" ? 0 : 1
  return history.flatMap((h) => {
    if (new Date(h.at).getTime() < since) return []
    const entries = Object.entries(h.rates).filter(([id]) => bankId === "best" || id === bankId)
    if (!entries.length) return []
    const [id, r] = entries.reduce((a, b) => ((side === "buying" ? b[1][i] > a[1][i] : b[1][i] < a[1][i]) ? b : a))
    return [{ at: h.at, value: r[i], bankId: id }]
  })
}

type Page = "rates" | "history"
const PATHS: Record<Page, string> = { rates: "/", history: "/history" }
const pageFromPath = (): Page => (location.pathname.startsWith("/history") ? "history" : "rates")

export default function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [history, setHistory] = useState<Snapshot[] | null>(null) // null while the history is loading
  const [loadError, setLoadError] = useState(false)
  const [manualRunning, setManualRunning] = useState(false)
  const [currency, setCurrency] = useState("USD")
  const [now, setNow] = useState(Date.now())
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [page, setPage] = useState<Page>(pageFromPath)

  useEffect(() => {
    const onPop = () => setPage(pageFromPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  useEffect(() => {
    document.title = page === "history" ? "Rate history · LKR Rates" : "LKR Rates · Sri Lanka bank exchange rates"
  }, [page])
  const go = (p: Page) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // let new-tab clicks through
    e.preventDefault()
    if (p !== page) window.history.pushState(null, "", PATHS[p])
    setPage(p)
    window.scrollTo({ top: 0 })
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status")
      if (!res.ok) throw new Error()
      setStatus(await res.json())
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
    setNow(Date.now())
  }, [])

  // Poll fast while a refresh is running so new rates show up as soon as they land.
  const busy = manualRunning || !!status?.refreshing
  useEffect(() => {
    load()
    const id = setInterval(load, busy ? 3000 : 30000)
    return () => clearInterval(id)
  }, [load, busy])

  const lastAt = status?.lastRefresh?.at
  useEffect(() => {
    setHistory(null)
    fetch(`/api/history?currency=${currency}`).then((r) => (r.ok ? r.json() : [])).then(setHistory).catch(() => setHistory([]))
  }, [currency, lastAt])

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallPrompt) }
    const onInstalled = () => { setInstall(null); toast.success("LKR Rates is installed") }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled) }
  }, [])

  async function installApp() {
    if (!install) return
    await install.prompt()
    if ((await install.userChoice).outcome === "accepted") setInstall(null)
  }

  function toggleTheme() {
    const next = !dark
    const apply = () => {
      setDark(next)
      document.documentElement.classList.toggle("dark", next)
    }
    // Cross-fade the whole page where supported; otherwise switch instantly.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply)
    else apply()
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch { /* private mode: theme just won't persist */ }
  }

  async function refresh() {
    setManualRunning(true)
    const id = toast.loading("Fetching the latest rates from all banks…")
    try {
      const res = await fetch("/api/refresh", { method: "POST" })
      const body = await res.json()
      if (res.ok) toast.success("Rates updated", { id })
      else toast.error(body.error ?? "Refresh failed", { id })
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.", { id })
    }
    setManualRunning(false)
    load()
  }

  const currencies = useMemo(() => {
    const all = new Set(status?.banks.flatMap((b) => b.rates.map((r) => r.currency)))
    return { top: TOP.filter((c) => all.has(c)).slice(0, 10), all: [...all].sort() }
  }, [status])
  const manualLeft = status?.manual.remaining ?? 0

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
            <a href="/" onClick={go("rates")} className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="LKR Rates home">
              <img src="/logo.png" alt="" width={28} height={28} className="size-7" />
              <span className="hidden font-heading text-lg font-bold tracking-tight min-[400px]:inline">LKR Rates</span>
            </a>
            <span className="hidden h-5 w-px bg-border lg:block" aria-hidden />
            <p className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex" aria-live="polite">
              <span className={`size-1.5 rounded-full bg-foreground ${busy ? "animate-pulse" : ""}`} aria-hidden />
              {busy ? "Updating rates…" : status?.lastRefresh ? `Updated ${relative(status.lastRefresh.at, now)}` : "Loading rates…"}
              <span className="text-border">/</span>
              {status?.banks.length ?? 9} banks
            </p>
            <nav className="flex items-center gap-1 md:ml-2" aria-label="Pages">
              {([["rates", "Rates", ChartLine], ["history", "History", History]] as const).map(([p, label, Icon]) => (
                <a key={p} href={PATHS[p]} onClick={go(p)} aria-current={page === p ? "page" : undefined} aria-label={label}
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-semibold transition-colors duration-300 ${page === p ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="size-4" aria-hidden /><span className="hidden sm:inline">{label}</span>
                </a>
              ))}
            </nav>
            <nav className="ml-auto flex items-center gap-1" aria-label="Site">
              {install && (
                <button onClick={installApp} className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-muted">
                  <Download className="size-4" aria-hidden /><span className="hidden sm:inline">Install</span><span className="sr-only sm:hidden">Install app</span>
                </button>
              )}
              <Tooltip>
                <TooltipTrigger render={<button onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} />}
                  className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-muted">
                  <span key={String(dark)} className="switch-in inline-flex">
                    {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{dark ? "Light theme" : "Dark theme"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<a href={REPO} target="_blank" rel="noreferrer" aria-label="Source code on GitHub" />}
                  className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-muted">
                  <GitHubIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Source on GitHub</TooltipContent>
              </Tooltip>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Tooltip>
                <TooltipTrigger render={<span />} className="inline-flex">
                  <button onClick={refresh} disabled={!status || busy || manualLeft === 0} aria-label={busy ? "Updating rates" : "Refresh rates"}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40">
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                    <span className="hidden sm:inline">Refresh</span>
                    <span className="font-mono text-xs opacity-70">{manualLeft}/{status?.manual.limit ?? 2}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {manualLeft === 0 && status?.manual.resetsAt
                    ? `Manual limit reached. Next refresh ${relative(status.manual.resetsAt, now)}.`
                    : `${manualLeft} of ${status?.manual.limit ?? 2} manual refreshes left this hour. Rates also update every 3 hours.`}
                </TooltipContent>
              </Tooltip>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-6 sm:px-6 sm:py-8">
          {loadError && (
            <div role="alert" className="flex items-center gap-2 rounded-md border-2 border-down px-4 py-3 text-sm font-medium">
              <AlertTriangle className="size-4 text-down" aria-hidden /> Can't reach the rates server. Retrying automatically.
            </div>
          )}

          {page === "history" ? (
            <HistoryPage banks={status?.banks ?? []} codes={currencies.all.length ? currencies.all : [currency]} currency={currency}
              history={history} onPick={setCurrency} now={now} />
          ) : (
            <>
              <div className="space-y-4">
                <CurrencyRail top={currencies.top} all={currencies.all} currency={currency} onPick={setCurrency} />
                <Slab status={status} history={history} currency={currency} now={now} />
              </div>

              <TopCurrencies status={status} codes={currencies.top} currency={currency} onPick={setCurrency} />

              <Explore status={status} currency={currency} onPick={setCurrency} now={now} />
            </>
          )}
        </main>

        <Footer banks={status?.banks ?? []} go={go} />
      </div>
      <Toaster theme={dark ? "dark" : "light"} position="bottom-center" />
    </TooltipProvider>
  )
}

function CurrencyRail({ top, all, currency, onPick }: { top: string[]; all: string[]; currency: string; onPick: (c: string) => void }) {
  const chip = (active: boolean) =>
    `h-9 shrink-0 rounded-md border-2 border-foreground px-2.5 font-mono text-sm font-semibold transition-colors ${active ? "bg-foreground text-background" : "hover:bg-muted"}`
  return (
    <nav aria-label="Currency" className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {(top.length ? top : ["USD"]).map((c) => (
        <button key={c} onClick={() => onPick(c)} aria-pressed={c === currency} className={`inline-flex items-center gap-2 ${chip(c === currency)}`} title={currencyName(c)}>
          <Flag code={c} />{c}
        </button>
      ))}
      <Select value={top.includes(currency) ? "" : currency} onValueChange={(v) => v && onPick(v)}>
        <SelectTrigger aria-label="More currencies"
          className={`h-9! shrink-0 rounded-md border-2 border-foreground font-mono text-sm font-semibold data-placeholder:text-foreground ${top.includes(currency) ? "" : "bg-foreground text-background"}`}>
          <SelectValue placeholder="More">{(v: string) => v || "More"}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false} className="w-72 max-w-[calc(100vw-2rem)]">
          {all.map((c) => <SelectItem key={c} value={c}><Flag code={c} /><span className="font-mono font-semibold">{c}</span> <span className="text-muted-foreground">{currencyName(c)}</span></SelectItem>)}
        </SelectContent>
      </Select>
    </nav>
  )
}

function Slab({ status, history, currency, now }: { status: Status | null; history: Snapshot[] | null; currency: string; now: number }) {
  const [bankId, setBankId] = useState("best")
  const [side, setSide] = useState<"buying" | "selling">("buying")
  const [range, setRange] = useState("1W")
  const [hover, setHover] = useState<number | null>(null)
  const [sharing, setSharing] = useState(false)

  const banks = status?.banks ?? []
  const rows = ratesFor(banks, currency)
  const top = bestOf(rows)
  // Window from the 30-second clock, not Date.now(), so the data (and the chart) stay put between ticks.
  const since = now - (RANGES.find((r) => r.label === range)?.ms ?? Infinity)
  const data = useMemo(() => seriesFrom(history ?? [], bankId, side, since), [history, bankId, side, since])

  // Live value from the latest rates; a hovered chart point replaces it.
  const liveBank = bankId === "best" ? top?.[side].banks[0] : banks.find((b) => b.id === bankId)
  const liveValue = bankId === "best" ? top?.[side].value : liveBank?.rates.find((r) => r.currency === currency)?.[side]
  const point = hover != null ? data[hover] : null
  const shownBank = liveBank
  const shownValue = point?.value ?? liveValue
  const shownAt = point?.at ?? shownBank?.fetchedAt ?? status?.lastRefresh?.at
  const first = data[0]
  const change = shownValue != null && first && data.length > 1 ? shownValue - first.value : null
  // For the customer, a higher buying rate or a lower selling rate is the good direction.
  const good = change != null && (side === "buying" ? change >= 0 : change <= 0)
  const name = shownBank?.name ?? "No bank"
  // The bank is the headline; what the number means sits under the rate.
  const meaning = bankId === "best"
    ? side === "buying" ? "Highest buying rate" : "Lowest selling rate"
    : side === "buying" ? "Buying rate" : "Selling rate"
  const [whole, decimals] = shownValue != null ? num(shownValue).split(".") : ["—", ""]
  const values = data.map((d) => d.value)

  async function share() {
    if (shownValue == null) return
    setSharing(true)
    try {
      const result = await shareCard({
        currency, currencyName: currencyName(currency), bank: name, meaning, value: shownValue,
        change: change != null && first ? { abs: change, pct: (change / first.value) * 100, good, range } : undefined,
        series: values,
        rows: rows.flatMap(({ bank, rate }) => (rate ? [{ name: bank.name, buying: rate.buying, selling: rate.selling }] : []))
          .sort((a, b) => b.buying - a.buying),
        at: shownAt ?? new Date().toISOString(),
      })
      if (result === "saved") toast.success("Image saved to your downloads")
    } catch {
      toast.error("Couldn't create the image. Try again.")
    }
    setSharing(false)
  }

  return (
    <section aria-label={`${currency} best rate`} className="grid grid-cols-1 overflow-hidden rounded-md bg-foreground text-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={bankId} onValueChange={(v) => v && setBankId(v)}>
            <SelectTrigger size="sm" aria-label="Bank" className="w-48 border-background/30 bg-transparent text-background dark:bg-transparent [&_svg]:text-background/70!">
              <SelectValue>{(v: string) => (v === "best" ? "Best across banks" : banks.find((b) => b.id === v)?.name ?? v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best across banks</SelectItem>
              {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Segmented label="Rate side" options={["Buying", "Selling"]} value={side === "buying" ? "Buying" : "Selling"}
            onChange={(v) => setSide(v === "Buying" ? "buying" : "selling")} className="w-40" />
        </div>

        {!status || shownValue == null ? (
          <div className="space-y-3" aria-label="Loading rates"><Skeleton className="h-9 w-4/5 bg-background/15" /><Skeleton className="h-20 w-3/5 bg-background/15" /><Skeleton className="h-4 w-2/3 bg-background/15" /></div>
        ) : (
          <div key={`${currency}-${bankId}-${side}`} className="switch-in" aria-live="polite">
            <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-[2.75rem]">{name}</h1>
            <p className="mt-4 flex items-baseline gap-2 font-mono leading-none">
              <span className="text-2xl font-medium text-background/60 sm:text-3xl">Rs</span>
              <span className="text-6xl font-bold tracking-[-0.04em] sm:text-7xl">{whole}{decimals && <span className="text-3xl font-semibold text-background/60 sm:text-4xl">.{decimals}</span>}</span>
            </p>
            <p className="mt-3 flex min-w-0 flex-col gap-1 text-sm text-background/70">
              {change != null && (
                <span className={`inline-flex w-fit items-center gap-1 font-mono font-semibold ${change === 0 ? "" : good ? "text-slab-up" : "text-slab-down"}`}>
                  {change > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : change < 0 ? <ArrowDown className="size-3.5" aria-hidden /> : null}
                  {change >= 0 ? "+" : ""}{num(change)} ({change >= 0 ? "+" : ""}{first ? ((change / first.value) * 100).toFixed(2) : "0.00"}%) {range}
                </span>
              )}
              <span><span className="font-semibold text-background">{meaning}</span> · for 1 {currency} · {shownAt ? clock(shownAt) : "no data yet"}</span>
            </p>
          </div>
        )}

        {top && (
          <dl className="divide-y divide-background/15 border-y border-background/15 text-sm">
            <SlabRow label={side === "buying" ? "Lowest selling" : "Highest buying"}
              value={num(side === "buying" ? top.selling.value : top.buying.value)}
              bank={shortName(side === "buying" ? top.selling.banks[0] : top.buying.banks[0])} />
            <SlabRow label="Smallest spread" value={num(top.spread.value)} bank={shortName(top.spread.banks[0])} />
            <SlabRow label={`Banks quoting ${currency}`} value={String(top.count)} />
          </dl>
        )}

        <p className="mt-auto text-xs text-background/60">
          Updated {relative(status?.lastRefresh?.at, now)} · next update {relative(status?.nextRefresh, now)} · TT rates, LKR per 1 unit
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t border-background/15 p-5 sm:p-8 lg:border-t-0 lg:border-l">
        {/* Fixed height: the chart never resizes when the text beside it changes. */}
        <div className="h-64 sm:h-80">
          {history === null ? (
            <Skeleton className="h-full w-full bg-background/10" />
          ) : data.length < 2 ? (
            <div className="switch-in flex h-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-background/25 px-6 text-center text-sm text-background/70">
              <p className="font-medium text-background">The history line starts here.</p>
              <p>A point is added every 3 hours. {data.length === 1 ? "One so far in this range." : "None in this range yet."}</p>
            </div>
          ) : (
            <ChartContainer key={`${currency}-${bankId}-${side}-${range}`} config={{ value: { label: side, color: "var(--background)" } }}
              className="switch-in aspect-auto h-full w-full [&_.recharts-cartesian-axis-tick_text]:fill-background/60">
              <LineChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}
                onMouseMove={(s) => setHover(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                onMouseLeave={() => setHover(null)}>
                <YAxis orientation="right" ticks={[Math.min(...values), Math.max(...values)]}
                  domain={[Math.min(...values) - (Math.max(...values) - Math.min(...values)) * 0.08 - 0.01, Math.max(...values) + (Math.max(...values) - Math.min(...values)) * 0.08 + 0.01]}
                  tickFormatter={(v: number) => num(v)} axisLine={false} tickLine={false} width={64}
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
                <ChartTooltip cursor={{ stroke: "var(--background)", strokeOpacity: 0.5, strokeWidth: 1 }}
                  isAnimationActive={false} offset={14} wrapperStyle={{ outline: "none" }}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
                    if (!p) return null
                    const b = banks.find((x) => x.id === p.bankId)
                    return (
                      <div className="rounded-md bg-background px-2.5 py-1.5 text-foreground">
                        <div className="font-mono text-sm font-bold">Rs {num(p.value)}</div>
                        <div className="text-[11px] text-muted-foreground">{clock(p.at)}{b ? ` · ${shortName(b)}` : ""}</div>
                      </div>
                    )
                  }} />
                <Line dataKey="value" type="monotone" stroke="var(--background)" strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: "var(--background)", stroke: "var(--foreground)", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2">
          <Segmented label="Chart range" options={RANGES.map((r) => r.label)} value={range} onChange={setRange} className="flex-1" mono />
          <button onClick={share} disabled={shownValue == null || sharing}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-background px-3.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-85 disabled:opacity-40">
            {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
            Share
          </button>
        </div>
      </div>
    </section>
  )
}

// One toggle style for every switch: equal segments and a sliding indicator on the shared ease.
// tone "slab" sits on the inverted slab; "page" sits on the page ground.
export function Segmented({ label, options, value, onChange, className = "", mono = false, tone = "slab" }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; className?: string; mono?: boolean; tone?: "slab" | "page"
}) {
  const i = Math.max(0, options.indexOf(value))
  const slab = tone === "slab"
  return (
    <div role="group" aria-label={label} className={`relative grid rounded-md border p-0.5 ${slab ? "border-background/30" : "border-2 border-foreground"} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span aria-hidden className={`ease-out-expo absolute top-0.5 bottom-0.5 left-0.5 rounded transition-transform duration-300 ${slab ? "bg-background" : "bg-foreground"}`}
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} aria-pressed={o === value}
          className={`relative z-10 py-1.5 text-xs font-semibold transition-colors duration-300 ${mono ? "font-mono" : ""} ${
            o === value ? (slab ? "text-foreground" : "text-background") : slab ? "text-background/70 hover:text-background" : "text-muted-foreground hover:text-foreground"}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

function SlabRow({ label, value, bank }: { label: string; value: string; bank?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-background/70">{label}</dt>
      <dd className="flex items-baseline gap-2">
        <span className="font-mono font-semibold">{value}</span>
        {bank && <span className="text-background/70">{bank}</span>}
      </dd>
    </div>
  )
}

export function SectionHead({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-3">
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function TopCurrencies({ status, codes, currency, onPick }: { status: Status | null; codes: string[]; currency: string; onPick: (c: string) => void }) {
  const banks = status?.banks ?? []
  return (
    <section aria-label="Top currencies">
      <SectionHead title="Top currencies" hint="The bank paying the most and charging the least for each. Tap one to show it at the top." />
      <div className="grid lg:grid-cols-2 lg:gap-x-10">
        {!status || !codes.length
          ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="my-2 h-12" />)
          : codes.map((code) => {
              const top = bestOf(ratesFor(banks, code))
              const active = code === currency
              return (
                <button key={code} onClick={() => { onPick(code); window.scrollTo({ top: 0, behavior: "smooth" }) }} aria-pressed={active}
                  className={`grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-2 py-3 text-left transition-colors ${active ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-mono text-lg leading-none font-bold"><Flag code={code} />{code}</span>
                    <span className={`mt-1 block truncate text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{currencyName(code)}</span>
                  </span>
                  {top && (
                    <span className={`truncate text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>
                      <span className={`font-medium ${active ? "text-background" : "text-foreground"}`}>{shortName(top.buying.banks[0])}</span> pays most
                      <span className="hidden sm:inline"> · <span className={`font-medium ${active ? "text-background" : "text-foreground"}`}>{shortName(top.selling.banks[0])}</span> charges least</span>
                    </span>
                  )}
                  {top && (
                    <span className="text-right font-mono leading-tight">
                      <span className="block font-bold">{num(top.buying.value)}</span>
                      <span className={`block text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{num(top.selling.value)}</span>
                    </span>
                  )}
                </button>
              )
            })}
      </div>
    </section>
  )
}

// Search runs on the rates already loaded in the page: no extra requests, no tokens.
function Explore({ status, currency, onPick, now }: { status: Status | null; currency: string; onPick: (c: string) => void; now: number }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const banks = status?.banks ?? []
  const allCodes = [...new Set(banks.flatMap((b) => b.rates.map((r) => r.currency)))].sort()
  const codeHits = q ? allCodes.filter((c) => c.toLowerCase().includes(q) || currencyName(c).toLowerCase().includes(q)) : []
  const bankHits = q ? banks.filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q)) : []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <section aria-label="Every bank" className="space-y-4">
      <SectionHead title={q ? "Search results" : `${currency} at every bank`}
        hint={q ? `${plural(codeHits.length, "currency", "currencies")} and ${plural(bankHits.length, "bank", "banks")} match` : "Buying: what the bank pays you. Selling: what you pay the bank."}>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a bank or currency"
            aria-label="Search banks and currencies" className="h-10 border-2 border-foreground pr-9 pl-9" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
      </SectionHead>

      {!q ? (
        <CompareTable status={status} currency={currency} />
      ) : !codeHits.length && !bankHits.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nothing matches “{query}”.</p>
          <p className="mt-1">Try a bank like “Seylan” or a currency like “AUD” or “yen”.</p>
        </div>
      ) : (
        <div key={q} className="switch-in space-y-8">
          {codeHits.length > 0 && (
            <Table>
              <TableHeader className="[&_tr]:border-b-2 [&_tr]:border-foreground">
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Pays most</TableHead>
                  <TableHead className="text-right">Charges least</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codeHits.map((code) => {
                  const top = bestOf(ratesFor(banks, code))
                  const pick = () => { onPick(code); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }) }
                  return (
                    <TableRow key={code} className="cursor-pointer" onClick={pick}>
                      <TableCell>
                        <button className="text-left" onClick={(e) => { e.stopPropagation(); pick() }}>
                          <span className="inline-flex items-center gap-2 font-mono font-bold"><Flag code={code} />{code}</span>
                          <span className="ml-2 text-muted-foreground">{currencyName(code)}</span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono font-semibold">{top ? num(top.buying.value) : "—"}</div>
                        <div className="text-xs text-muted-foreground">{top && shortName(top.buying.banks[0])}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono font-semibold">{top ? num(top.selling.value) : "—"}</div>
                        <div className="text-xs text-muted-foreground">{top && shortName(top.selling.banks[0])}</div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {bankHits.length > 0 && (
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
              {bankHits.map((bank) => <BankSheet key={bank.id} bank={bank} now={now} />)}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function CompareTable({ status, currency }: { status: Status | null; currency: string }) {
  const rows = ratesFor(status?.banks ?? [], currency).sort((a, b) => (b.rate?.buying ?? -1) - (a.rate?.buying ?? -1))
  const top = bestOf(rows)
  if (!status) return <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  return (
    <Table key={currency} className="switch-in">
      <TableHeader className="[&_tr]:border-b-2 [&_tr]:border-foreground">
        <TableRow>
          <TableHead>Bank</TableHead>
          <TableHead className="text-right">Buying</TableHead>
          <TableHead className="text-right">Selling</TableHead>
          <TableHead className="hidden text-right md:table-cell">Spread</TableHead>
          <TableHead className="hidden sm:table-cell">Bank updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ bank, rate }) => (
          <TableRow key={bank.id}>
            <TableCell>
              <div className="flex items-center gap-2.5 font-medium">
                <span className="hidden sm:contents"><BankLogo bank={bank} /></span>
                {bank.name}
                <BankState bank={bank} />
              </div>
            </TableCell>
            {rate ? (
              <>
                <RateCell value={rate.buying} best={rate.buying === top?.buying.value} label="Pays the most" />
                <RateCell value={rate.selling} best={rate.selling === top?.selling.value} label="Charges the least" />
                <TableCell className="hidden text-right font-mono text-muted-foreground md:table-cell">{num(rate.selling - rate.buying)}</TableCell>
              </>
            ) : (
              bank.fetchedAt || bank.error
                ? <TableCell colSpan={3} className="text-right text-muted-foreground">Not offered</TableCell>
                : <TableCell colSpan={3}><Skeleton className="ml-auto h-4 w-40" /></TableCell>
            )}
            <TableCell className="hidden text-muted-foreground sm:table-cell">{bankClock(bank.bankUpdatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BankSheet({ bank, now }: { bank: Bank; now: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b-2 border-foreground pb-3">
        <div className="flex items-center gap-3">
          <BankLogo bank={bank} />
          <div>
            <h3 className="font-heading text-lg font-bold">{bank.name} <BankState bank={bank} /></h3>
            <p className="text-xs text-muted-foreground">Bank updated {bankClock(bank.bankUpdatedAt)} · fetched {relative(bank.fetchedAt, now)}</p>
          </div>
        </div>
        <a href={bank.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open ${bank.name} rates page`}>
          <ExternalLink className="size-4" />
        </a>
      </div>
      {bank.rates.length === 0 ? (
        bank.error ? <p className="py-4 text-sm text-muted-foreground">{bank.error}</p>
          : <div className="space-y-2 py-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      ) : (
        <Table>
          <TableHeader className="[&_tr]:border-b-2 [&_tr]:border-foreground">
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Buying</TableHead>
              <TableHead className="text-right">Selling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bank.rates.map((r) => (
              <TableRow key={r.currency}>
                <TableCell className="font-mono font-semibold" title={currencyName(r.currency)}><span className="inline-flex items-center gap-2"><Flag code={r.currency} />{r.currency}</span></TableCell>
                <TableCell className="text-right font-mono">{num(r.buying)}</TableCell>
                <TableCell className="text-right font-mono">{num(r.selling)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function Footer({ banks, go }: { banks: Bank[]; go: (p: Page) => (e: React.MouseEvent) => void }) {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone
  const link = "text-muted-foreground transition-colors hover:text-foreground"
  return (
    <footer className="mt-20 border-t-2 border-foreground">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" width={24} height={24} className="size-6" />
              <span className="font-heading font-bold tracking-tight">LKR Rates</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Telegraphic transfer rates from {banks.length || 9} Sri Lankan banks, read from their own websites every 3 hours.
              {ios && " On iPhone, tap Share then “Add to Home Screen” to install."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:flex sm:gap-x-12">
            <nav aria-label="Pages" className="flex flex-col gap-2">
              <a href={PATHS.rates} onClick={go("rates")} className={`inline-flex items-center gap-2 ${link}`}><ChartLine className="size-3.5" aria-hidden /> Rates</a>
              <a href={PATHS.history} onClick={go("history")} className={`inline-flex items-center gap-2 ${link}`}><History className="size-3.5" aria-hidden /> History</a>
            </nav>
            <nav aria-label="Project" className="flex flex-col gap-2">
              <a href={REPO} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${link}`}><GitHubIcon className="size-3.5" /> GitHub</a>
              <a href={`${REPO}#api`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${link}`}><Braces className="size-3.5" aria-hidden /> API</a>
              <a href={`${REPO}#telegram-bot`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${link}`}><Send className="size-3.5" aria-hidden /> Telegram bot</a>
            </nav>
            <nav aria-label="Help" className="flex flex-col gap-2">
              <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${link}`}><Bug className="size-3.5" aria-hidden /> Report an issue</a>
              <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 ${link}`}><Scale className="size-3.5" aria-hidden /> MIT License</a>
            </nav>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Sources: </span>
          {banks.map((b, i) => (
            <span key={b.id}>{i > 0 && " · "}<a href={b.url} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">{b.name}</a></span>
          ))}
        </p>
        <div className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()}{" "}
            <a href="https://github.com/harindujayakody" target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">Harindu Jayakody</a>
            {" · "}
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">exchange-rates-srilanka</a>
          </p>
          <p>Indicative rates. Confirm with your bank before you transact.</p>
        </div>
      </div>
    </footer>
  )
}

// Lucide dropped brand icons, so the GitHub mark is inlined.
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function RateCell({ value, best, label }: { value: number; best: boolean; label: string }) {
  return (
    <TableCell className="text-right font-mono">
      {best ? (
        <span className="inline-flex items-center gap-1.5 rounded bg-foreground px-2 py-0.5 font-bold text-background" title={label}>
          {num(value)}<span className="sr-only"> ({label.toLowerCase()})</span>
        </span>
      ) : num(value)}
    </TableCell>
  )
}

// Files in web/public/logos.
const LOGOS: Record<string, string> = {
  boc: "boc.svg", combank: "combank.svg", ndb: "ndb.svg", sampath: "sampath.jpg", ntb: "ntb.svg",
  dfcc: "dfcc.png", nsb: "nsb.png", peoples: "peoples.png", seylan: "seylan.png",
}

function BankLogo({ bank }: { bank: Bank }) {
  const [failed, setFailed] = useState(false)
  const box = "flex h-7 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-white p-0.5 ring-1 ring-border"
  if (failed || !LOGOS[bank.id]) return <span className={box}><Landmark className="size-3.5 text-neutral-500" aria-hidden /></span>
  return (
    <span className={box}>
      <img src={`/logos/${LOGOS[bank.id]}`} alt="" className="max-h-full max-w-full object-contain" loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

function BankState({ bank }: { bank: Bank }) {
  if (!bank.error) return null
  const stale = bank.rates.length > 0
  return (
    <Tooltip>
      <TooltipTrigger render={<span />} className="inline-flex align-middle">
        <span className="inline-flex items-center gap-1 rounded border border-down px-1.5 py-0.5 text-[11px] font-semibold text-down">
          <AlertTriangle className="size-3" aria-hidden /> {stale ? "Stale" : "Unavailable"}
        </span>
      </TooltipTrigger>
      <TooltipContent>{stale ? `Last update failed: ${bank.error}` : bank.error}</TooltipContent>
    </Tooltip>
  )
}
