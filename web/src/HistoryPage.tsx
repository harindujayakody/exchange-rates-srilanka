import { useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpToLine, History } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Flag } from "@/flags"
import { type Bank, type Snapshot, Segmented, clock, currencyName, num, shortName } from "./App"

const RANGES = [
  { label: "1W", days: 7 }, { label: "1M", days: 30 }, { label: "6M", days: 182 }, { label: "1Y", days: 365 }, { label: "Max", days: Infinity },
]
const colomboDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

type Pick = { value: number; bankId: string; at: string }
type DayStat = { day: string; at: string; count: number; bestBuy: Pick; worstBuy: Pick; bestSell: Pick; worstSell: Pick }

// Best and worst of one snapshot. Buying: higher is better for the customer. Selling: lower is better.
export function snapshotStats(h: Snapshot): Omit<DayStat, "day"> | null {
  const entries = Object.entries(h.rates)
  if (!entries.length) return null
  const pick = (i: 0 | 1, better: (a: number, b: number) => boolean) => {
    const [bankId, r] = entries.reduce((a, b) => (better(b[1][i], a[1][i]) ? b : a))
    return { value: r[i], bankId, at: h.at }
  }
  return {
    at: h.at, count: entries.length,
    bestBuy: pick(0, (a, b) => a > b), worstBuy: pick(0, (a, b) => a < b),
    bestSell: pick(1, (a, b) => a < b), worstSell: pick(1, (a, b) => a > b),
  }
}

export default function HistoryPage({ banks, codes, currency, history, onPick, now }: {
  banks: Bank[]; codes: string[]; currency: string; history: Snapshot[] | null; onPick: (c: string) => void; now: number
}) {
  const [range, setRange] = useState("1M")
  const days = RANGES.find((r) => r.label === range)?.days ?? Infinity

  // One row per Sri Lanka day: the last snapshot saved that day. Extremes cover every snapshot in the range.
  const { rows, extremes, since } = useMemo(() => {
    const inRange = (history ?? []).filter((h) => now - new Date(h.at).getTime() < days * 86_400_000)
    const stats = inRange.flatMap((h) => { const s = snapshotStats(h); return s ? [s] : [] })
    const byDay = new Map<string, DayStat>()
    for (const s of stats) byDay.set(colomboDay(s.at), { ...s, day: colomboDay(s.at) })
    const ext = stats.length ? {
      bestBuy: stats.map((s) => s.bestBuy).reduce((a, b) => (b.value > a.value ? b : a)),
      worstBuy: stats.map((s) => s.worstBuy).reduce((a, b) => (b.value < a.value ? b : a)),
      bestSell: stats.map((s) => s.bestSell).reduce((a, b) => (b.value < a.value ? b : a)),
      worstSell: stats.map((s) => s.worstSell).reduce((a, b) => (b.value > a.value ? b : a)),
    } : null
    return { rows: [...byDay.values()].reverse(), extremes: ext, since: inRange[0]?.at }
  }, [history, days, now])

  const bankName = (id: string) => { const b = banks.find((x) => x.id === id); return b ? shortName(b) : id }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <h1 className="flex items-center gap-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            <History className="size-7 sm:size-8" aria-hidden /> Rate history
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The best and worst telegraphic transfer rates for {currencyName(currency)}, one row per day in Sri Lanka time.
            A snapshot of every bank is saved every 3 hours{since ? `; this range starts ${clock(since)}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currency} onValueChange={(v) => v && onPick(v)}>
            <SelectTrigger aria-label="Currency" className="h-9! w-36 rounded-md border-2 border-foreground font-mono text-sm font-semibold">
              <SelectValue>{(v: string) => <span className="inline-flex items-center gap-2"><Flag code={v} />{v}</span>}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="w-72 max-w-[calc(100vw-2rem)]">
              {codes.map((c) => <SelectItem key={c} value={c}><Flag code={c} /><span className="font-mono font-semibold">{c}</span> <span className="text-muted-foreground">{currencyName(c)}</span></SelectItem>)}
            </SelectContent>
          </Select>
          <Segmented label="History range" options={RANGES.map((r) => r.label)} value={range} onChange={setRange} tone="page" mono className="w-64" />
        </div>
      </div>

      {history === null ? (
        <div className="space-y-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !rows.length || !extremes ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No saved {currency} rates in this range yet.</p>
          <p className="mt-1">A snapshot of every bank is saved every 3 hours. Try a longer range.</p>
        </div>
      ) : (
        <div key={`${currency}-${range}`} className="switch-in space-y-8">
          <section aria-label={`${currency} extremes in range`}>
            <dl className="grid grid-cols-2 border-y-2 border-foreground lg:grid-cols-4">
              <Extreme label="Best buying" hint="highest the banks paid" pick={extremes.bestBuy} up bankName={bankName} />
              <Extreme label="Worst buying" hint="lowest the banks paid" pick={extremes.worstBuy} bankName={bankName} />
              <Extreme label="Best selling" hint="lowest the banks charged" pick={extremes.bestSell} bankName={bankName} />
              <Extreme label="Worst selling" hint="highest the banks charged" pick={extremes.worstSell} up bankName={bankName} />
            </dl>
          </section>

          <section aria-label={`${currency} daily history`}>
            <Table>
              <TableHeader className="[&_tr]:border-b-2 [&_tr]:border-foreground">
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Best buying</TableHead>
                  <TableHead className="text-right">Worst buying</TableHead>
                  <TableHead className="text-right">Best selling</TableHead>
                  <TableHead className="text-right">Worst selling</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Banks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.day}>
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{dayLabel(r.day)}</div>
                      <div className="text-xs text-muted-foreground">as at {new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}</div>
                    </TableCell>
                    <RateAt pick={r.bestBuy} strong bankName={bankName} />
                    <RateAt pick={r.worstBuy} bankName={bankName} />
                    <RateAt pick={r.bestSell} strong bankName={bankName} />
                    <RateAt pick={r.worstSell} bankName={bankName} />
                    <TableCell className="hidden text-right font-mono text-muted-foreground md:table-cell">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}
    </div>
  )
}

function Extreme({ label, hint, pick, up = false, bankName }: { label: string; hint: string; pick: Pick; up?: boolean; bankName: (id: string) => string }) {
  const Icon = up ? ArrowUpToLine : ArrowDownToLine
  return (
    <div className="border-foreground/15 p-4 sm:p-5 max-lg:odd:border-r max-lg:nth-[-n+2]:border-b lg:not-last:border-r">
      <dt className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4" aria-hidden /> {label}
      </dt>
      <dd className="mt-2">
        <div className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">{num(pick.value)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{bankName(pick.bankId)} · {clock(pick.at)}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </dd>
    </div>
  )
}

function RateAt({ pick, strong = false, bankName }: { pick: Pick; strong?: boolean; bankName: (id: string) => string }) {
  return (
    <TableCell className="text-right">
      <div className={`font-mono ${strong ? "font-bold" : ""}`}>{num(pick.value)}</div>
      <div className="text-xs text-muted-foreground">{bankName(pick.bankId)}</div>
    </TableCell>
  )
}
