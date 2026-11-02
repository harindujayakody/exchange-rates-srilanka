import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, Clock, ExternalLink, Hand, Landmark, Loader2, RefreshCw, Timer,
  TrendingDown, TrendingUp, Trophy,
} from "lucide-react"
import { Line, LineChart, Tooltip as ChartTooltip, YAxis } from "recharts"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const REPO = "https://github.com/harindujayakody/exchnage-rates-srilanka"

type Rate = { currency: string; buying: number; selling: number }
type Bank = {
  id: string; name: string; url: string; rates: Rate[]
  model?: string; tokens?: number; bankUpdatedAt?: string | null; fetchedAt?: string; error?: string | null
}
type Status = {
  banks: Bank[]
  lastRefresh: { at: string; trigger: "scheduled" | "manual" } | null
  nextRefresh: string | null
  refreshing: boolean
  models: string[]
  usage: { requests: number; promptTokens: number; completionTokens: number; totalTokens: number; cost: number; since: string }
  manual: { limit: number; remaining: number; resetsAt: string | null }
}
type Snapshot = { at: string; rates: Record<string, [number, number]> }

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
const clock = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })

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

type Pick = { banks: Bank[]; value: number; note: string }
function bestOf(rows: { bank: Bank; rate?: Rate }[]) {
  const offered = rows.flatMap(({ bank, rate }) => (rate ? [{ bank, rate, spread: rate.selling - rate.buying }] : []))
  if (!offered.length) return null
  const pick = (score: (o: (typeof offered)[number]) => number, better: "max" | "min") => {
    const scores = offered.map(score)
    const value = better === "max" ? Math.max(...scores) : Math.min(...scores)
    const worst = better === "max" ? Math.min(...scores) : Math.max(...scores)
    return { banks: offered.filter((o) => score(o) === value).map((o) => o.bank), value, worst }
  }
  const buy = pick((o) => o.rate.buying, "max")
  const sell = pick((o) => o.rate.selling, "min")
  const spread = pick((o) => o.spread, "min")
  return {
    buying: { ...buy, note: `${num(buy.value - buy.worst)} more than the lowest` },
    selling: { ...sell, note: `${num(sell.worst - sell.value)} less than the highest` },
    spread: { ...spread, note: "Selling minus buying" },
  }
}

const RANGES = [
  { label: "1D", ms: 86_400_000 }, { label: "1W", ms: 7 * 86_400_000 }, { label: "1M", ms: 30 * 86_400_000 },
  { label: "6M", ms: 182 * 86_400_000 }, { label: "1Y", ms: 365 * 86_400_000 }, { label: "Max", ms: Infinity },
]

// One value per snapshot: a single bank's rate, or the best across banks (highest buying, lowest selling).
function seriesFrom(history: Snapshot[], bankId: string, side: "buying" | "selling", since: number) {
  const i = side === "buying" ? 0 : 1
  return history.flatMap((h) => {
    if (new Date(h.at).getTime() < since) return []
    const values = bankId === "best" ? Object.values(h.rates).map((r) => r[i]) : h.rates[bankId] ? [h.rates[bankId][i]] : []
    if (!values.length) return []
    return [{ at: h.at, value: side === "buying" ? Math.max(...values) : Math.min(...values) }]
  })
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loadError, setLoadError] = useState(false)
  const [manualRunning, setManualRunning] = useState(false)
  const [currency, setCurrency] = useState("USD")
  const [now, setNow] = useState(Date.now())

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
    fetch(`/api/history?currency=${currency}`).then((r) => (r.ok ? r.json() : [])).then(setHistory).catch(() => setHistory([]))
  }, [currency, lastAt])

  async function refresh() {
    setManualRunning(true)
    const id = toast.loading("Fetching the latest rates from all banks…")
    try {
      const res = await fetch("/api/refresh", { method: "POST" })
      const body = await res.json()
      if (res.ok) toast.success("Rates updated", { id })
      else toast.error(body.error ?? "Refresh failed", { id })
    } catch {
      toast.error("Could not reach the server", { id })
    }
    setManualRunning(false)
    load()
  }

  const currencies = useMemo(() => {
    const all = new Set(status?.banks.flatMap((b) => b.rates.map((r) => r.currency)))
    return ["USD", "EUR", "GBP", ...[...all].sort()].filter((c, i, a) => all.has(c) && a.indexOf(c) === i)
  }, [status])

  const rows = useMemo(
    () => (status?.banks ?? []).map((bank) => ({ bank, rate: bank.rates.find((r) => r.currency === currency) })),
    [status, currency],
  )
  const top = useMemo(() => bestOf(rows), [rows])
  const best = { buying: top?.buying.value, selling: top?.selling.value }
  const manualLeft = status?.manual.remaining ?? 0

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <a href="/" className="flex items-center gap-2.5" aria-label="LKR Rates home">
              <Mark />
              <span className="font-heading text-lg font-semibold tracking-tight">LKR Rates</span>
              <Badge variant="outline" className="hidden font-mono text-[10px] sm:inline-flex">TT</Badge>
            </a>
            <div className="flex items-center gap-1.5">
              <UsageButton status={status} />
              <Tooltip>
                <TooltipTrigger render={<a href={REPO} target="_blank" rel="noreferrer" aria-label="Source code on GitHub" />}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <GitHubIcon className="size-[18px]" />
                </TooltipTrigger>
                <TooltipContent>Source on GitHub</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<span />} className="ml-1 inline-flex">
                  <Button onClick={refresh} disabled={!status || busy || manualLeft === 0} size="sm">
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                    <span className="hidden sm:inline">{busy ? "Updating…" : "Refresh"}</span>
                    <span className="font-mono text-xs opacity-60">{manualLeft}/{status?.manual.limit ?? 2}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {manualLeft === 0 && status?.manual.resetsAt
                    ? `Manual limit reached. Next refresh ${relative(status.manual.resetsAt, now)}.`
                    : `${manualLeft} of ${status?.manual.limit ?? 2} manual refreshes left this hour`}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {loadError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-down/40 bg-down/10 px-4 py-3 text-sm">
              <AlertTriangle className="size-4 text-down" aria-hidden /> Can't reach the rates server. Retrying automatically.
            </div>
          )}

          <RateChart status={status} history={history} currency={currency} currencies={currencies} onCurrency={setCurrency} />

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Update status">
            <Stat icon={Clock} label="Last update" loading={!status}
              value={status?.lastRefresh ? relative(status.lastRefresh.at, now) : status?.refreshing ? "Running…" : "—"}
              hint={status?.lastRefresh ? `${clock(status.lastRefresh.at)} · ${status.lastRefresh.trigger === "manual" ? "Manual" : "Auto"}` : "First fetch in progress"} />
            <Stat icon={Timer} label="Next auto update" loading={!status}
              value={relative(status?.nextRefresh, now)}
              hint={status?.nextRefresh ? `${clock(status.nextRefresh)} · every 3 hours` : "Every 3 hours"} />
            <Stat icon={Hand} label="Manual refreshes" loading={!status}
              value={`${manualLeft} of ${status?.manual.limit ?? 2} left`}
              hint={status?.manual.resetsAt ? `Next slot ${relative(status.manual.resetsAt, now)}` : "Limit 2 per hour"} />
          </section>

          <section className="space-y-3" aria-label={`Best ${currency} rates today`}>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Best {currency} rates today</h2>
              <p className="text-sm text-muted-foreground">Telegraphic transfer rates across {status?.banks.length ?? 9} banks</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <BestCard icon={TrendingUp} label={`Best to sell ${currency}`} help="Highest buying rate. The bank pays you the most." pick={top?.buying} loading={!status} />
              <BestCard icon={TrendingDown} label={`Best to buy ${currency}`} help="Lowest selling rate. You pay the bank the least." pick={top?.selling} loading={!status} />
              <BestCard icon={Trophy} label="Overall best" help="The smallest spread is the fairest rate both ways." pick={top?.spread} loading={!status} highlight />
            </div>
          </section>

          <Tabs defaultValue="compare" className="gap-4">
            <TabsList>
              <TabsTrigger value="compare">Compare banks</TabsTrigger>
              <TabsTrigger value="banks">By bank</TabsTrigger>
            </TabsList>

            <TabsContent value="compare">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">{currency} to LKR</CardTitle>
                  <CardDescription>Buying: what the bank pays you. Selling: what you pay the bank.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!status ? <TableSkeleton /> : (
                    <Table>
                      <TableHeader>
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
                                <RateCell value={rate.buying} best={rate.buying === best.buying} />
                                <RateCell value={rate.selling} best={rate.selling === best.selling} />
                                <TableCell className="hidden text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                                  {num(rate.selling - rate.buying)}
                                </TableCell>
                              </>
                            ) : (
                              <TableCell colSpan={3} className="text-right text-muted-foreground">
                                {bank.fetchedAt || bank.error ? "Not offered" : "Loading…"}
                              </TableCell>
                            )}
                            <TableCell className="hidden text-muted-foreground sm:table-cell">{bankClock(bank.bankUpdatedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="banks">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(status?.banks ?? []).map((bank) => (
                  <Card key={bank.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2.5 font-heading"><BankLogo bank={bank} /> {bank.name} <BankState bank={bank} /></CardTitle>
                        <a href={bank.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${bank.name} rates page`}>
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                      <CardDescription className="space-y-0.5">
                        <span className="block">Bank updated: {bankClock(bank.bankUpdatedAt)}</span>
                        <span className="block">Fetched {relative(bank.fetchedAt, now)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {bank.rates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{bank.error ?? "Loading…"}</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Currency</TableHead>
                              <TableHead className="text-right">Buying</TableHead>
                              <TableHead className="text-right">Selling</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bank.rates.map((r) => (
                              <TableRow key={r.currency}>
                                <TableCell className="font-mono font-medium">{r.currency}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{num(r.buying)}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{num(r.selling)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <Footer banks={status?.banks ?? []} />
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </TooltipProvider>
  )
}

function RateChart({ status, history, currency, currencies, onCurrency }: {
  status: Status | null; history: Snapshot[]; currency: string; currencies: string[]; onCurrency: (c: string) => void
}) {
  const [bankId, setBankId] = useState("best")
  const [side, setSide] = useState<"buying" | "selling">("buying")
  const [range, setRange] = useState("1W")
  const [hover, setHover] = useState<number | null>(null)

  const since = Date.now() - (RANGES.find((r) => r.label === range)?.ms ?? Infinity)
  const data = useMemo(() => seriesFrom(history, bankId, side, since), [history, bankId, side, since])
  const shown = data[hover ?? data.length - 1]
  const first = data[0]
  const change = shown && first ? shown.value - first.value : 0
  // For the customer, a higher buying rate or a lower selling rate is the good direction.
  const good = side === "buying" ? change >= 0 : change <= 0
  const tone = change === 0 ? "text-muted-foreground" : good ? "text-up" : "text-down"
  const stroke = change === 0 ? "var(--muted-foreground)" : good ? "var(--up)" : "var(--down)"
  const values = data.map((d) => d.value)
  const [whole, decimals] = shown ? num(shown.value).split(".") : ["—", ""]
  const bankName = bankId === "best" ? "Best across banks" : status?.banks.find((b) => b.id === bankId)?.name

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currency} onValueChange={(v) => v && onCurrency(v)}>
            <SelectTrigger size="sm" className="w-24 font-mono" aria-label="Currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(currencies.length ? currencies : ["USD"]).map((c) => <SelectItem key={c} value={c} className="font-mono">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={bankId} onValueChange={(v) => v && setBankId(v)}>
            <SelectTrigger size="sm" className="w-48" aria-label="Bank">
              <SelectValue>{(v: string) => (v === "best" ? "Best across banks" : status?.banks.find((b) => b.id === v)?.name ?? v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best across banks</SelectItem>
              {(status?.banks ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Rate side">
            {(["buying", "selling"] as const).map((s) => (
              <button key={s} onClick={() => setSide(s)} aria-pressed={side === s}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${side === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          {!status ? <Skeleton className="h-12 w-56" /> : (
            <div className="flex items-baseline gap-1 font-mono tracking-tight" aria-live="polite">
              <span className="text-2xl text-muted-foreground sm:text-3xl">Rs</span>
              <span className="text-4xl font-semibold sm:text-5xl">{whole}</span>
              {decimals && <span className="text-xl font-medium text-muted-foreground sm:text-2xl">.{decimals}</span>}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {data.length > 1 && (
              <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${tone}`}>
                {change > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : change < 0 ? <ArrowDown className="size-3.5" aria-hidden /> : null}
                {change >= 0 ? "+" : ""}{num(change)} ({first ? ((change / first.value) * 100).toFixed(2) : "0.00"}%)
              </span>
            )}
            <span className="text-muted-foreground">
              {currency} {side} · {bankName} · {shown ? clock(shown.at) : "no data yet"}
            </span>
          </div>
        </div>

        <div className="relative">
          {data.length < 2 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground sm:h-72">
              <Activity className="size-5" aria-hidden />
              <p>History builds up as rates refresh every 3 hours.</p>
              <p className="text-xs">{data.length === 1 ? "One snapshot so far in this range." : "No snapshots in this range yet."}</p>
            </div>
          ) : (
            <ChartContainer config={{ value: { label: side, color: stroke } }} className="aspect-auto h-56 w-full sm:h-72">
              <LineChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}
                onMouseMove={(s) => setHover(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                onMouseLeave={() => setHover(null)}>
                <YAxis orientation="right" ticks={[Math.min(...values), Math.max(...values)]}
                  domain={[(min: number) => min - (Math.max(...values) - min) * 0.08 - 0.01, (max: number) => max + (max - Math.min(...values)) * 0.08 + 0.01]}
                  tickFormatter={(v: number) => num(v)} axisLine={false} tickLine={false} width={64}
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
                <ChartTooltip cursor={{ stroke: "var(--foreground)", strokeWidth: 1 }} content={() => null} />
                <Line dataKey="value" type="monotone" stroke={stroke} strokeWidth={2.25} dot={false}
                  activeDot={{ r: 4, fill: stroke, stroke: "var(--background)", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => setRange(r.label)} aria-pressed={range === r.label}
              className={`flex-1 rounded-lg py-1.5 font-mono text-xs font-medium transition-colors ${range === r.label ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function UsageButton({ status }: { status: Status | null }) {
  const u = status?.usage
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<button aria-label="OpenRouter token usage" />} />}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Activity className="size-[18px]" aria-hidden />
          {u && <span className="hidden font-mono text-xs sm:inline">{compact(u.totalTokens)}</span>}
        </TooltipTrigger>
        <TooltipContent>Token usage</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div>
            <p className="font-heading text-sm font-semibold">OpenRouter usage</p>
            <p className="text-xs text-muted-foreground">Since {u ? clock(u.since) : "—"}. Free models allow about 50 requests a day.</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight">{(u?.totalTokens ?? 0).toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">tokens</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <Item label="Requests" value={u?.requests ?? 0} />
            <Item label="Cost" value={`$${(u?.cost ?? 0).toFixed(4)}`} />
            <Item label="Input tokens" value={(u?.promptTokens ?? 0).toLocaleString()} />
            <Item label="Output tokens" value={(u?.completionTokens ?? 0).toLocaleString()} />
            <Item label="Models" value={status?.models.join(", ") ?? "—"} wide />
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Footer({ banks }: { banks: Bank[] }) {
  return (
    <footer className="mt-12 border-t bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-heading text-lg font-semibold tracking-tight">LKR Rates</span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Telegraphic transfer buying and selling rates from Sri Lankan banks, refreshed every 3 hours and compared side by side.
          </p>
          <a href={REPO} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
            <GitHubIcon className="size-4" /> Star on GitHub
          </a>
        </div>
        <nav aria-label="Bank sources">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sources</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-1">
            {banks.map((b) => (
              <li key={b.id}>
                <a href={b.url} target="_blank" rel="noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">{b.name}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Project">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</h3>
          <ul className="space-y-2 text-sm">
            <li><a href={REPO} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Source code</a></li>
            <li><a href={`${REPO}#api`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">API docs</a></li>
            <li><a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Report an issue</a></li>
            <li><a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">MIT License</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} Built by{" "}
            <a href="https://github.com/harindujayakody" target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">Harindu Jayakody</a>
            {" · "}
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">exchnage-rates-srilanka</a>
          </p>
          <p>Indicative rates read from public bank websites. Confirm with your bank before you transact.</p>
        </div>
      </div>
    </footer>
  )
}

// Icon by designhub on Flaticon (credited in the README).
function Mark() {
  return <img src="/logo.png" alt="" width={32} height={32} className="size-8" />
}

// Lucide dropped brand icons, so the GitHub mark is inlined.
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function RateCell({ value, best }: { value: number; best: boolean }) {
  return (
    <TableCell className="text-right font-mono tabular-nums">
      <div className="flex items-center justify-end gap-2">
        {best && <Badge className="hidden bg-up/15 text-up sm:inline-flex">Best</Badge>}
        <span className={best ? "font-semibold text-up" : ""}>{num(value)}</span>
      </div>
    </TableCell>
  )
}

function Stat({ icon: Icon, label, value, hint, loading }: {
  icon: typeof Clock; label: string; value: string; hint: string; loading: boolean
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" aria-hidden /> {label}
        </div>
        {loading ? <Skeleton className="h-7 w-24" /> : <div className="font-heading text-xl font-semibold tracking-tight">{value}</div>}
        <p className="truncate font-mono text-xs text-muted-foreground" title={hint}>{hint}</p>
      </CardContent>
    </Card>
  )
}

// Files in web/public/logos.
const LOGOS: Record<string, string> = {
  boc: "boc.svg", combank: "combank.svg", ndb: "ndb.svg", sampath: "sampath.jpg", ntb: "ntb.svg",
  dfcc: "dfcc.png", nsb: "nsb.png", peoples: "peoples.png", seylan: "seylan.png",
}

function BankLogo({ bank }: { bank: Bank }) {
  const [failed, setFailed] = useState(false)
  const box = "flex h-7 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5"
  if (failed || !LOGOS[bank.id]) return <span className={box}><Landmark className="size-3.5 text-neutral-500" aria-hidden /></span>
  return (
    <span className={box}>
      <img src={`/logos/${LOGOS[bank.id]}`} alt="" className="max-h-full max-w-full object-contain" loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

function BestCard({ icon: Icon, label, help, pick, loading, highlight }: {
  icon: typeof Clock; label: string; help: string; pick?: Pick; loading: boolean; highlight?: boolean
}) {
  return (
    <Card size="sm" className={highlight ? "bg-gradient-to-br from-up/20 to-card ring-up/30" : ""}>
      <CardContent className="space-y-3">
        <div className={`flex items-center gap-2 text-xs font-medium ${highlight ? "text-up" : "text-muted-foreground"}`}>
          <Icon className="size-3.5" aria-hidden /> {label}
        </div>
        {loading ? <Skeleton className="h-12 w-full" /> : !pick ? (
          <p className="text-sm text-muted-foreground">No bank offers this currency right now.</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-1">
                {pick.banks.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 truncate font-semibold">
                    <BankLogo bank={b} /> <span className="truncate">{b.name}</span>
                  </div>
                ))}
              </div>
              <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{num(pick.value)}</div>
            </div>
            <p className="text-xs text-muted-foreground">{pick.note}. {help}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BankState({ bank }: { bank: Bank }) {
  if (!bank.error) return null
  const stale = bank.rates.length > 0
  return (
    <Tooltip>
      <TooltipTrigger render={<span />} className="inline-flex">
        <Badge variant="outline" className="gap-1 border-down/40 text-down">
          <AlertTriangle className="size-3" aria-hidden />
          {stale ? "Stale" : "Unavailable"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{stale ? `Last update failed: ${bank.error}` : bank.error}</TooltipContent>
    </Tooltip>
  )
}

function Item({ label, value, wide }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  )
}
