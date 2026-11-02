// Inline SVG flags for the currencies Sri Lankan banks quote. The 25 files in assets/flags come from
// country-flag-icons (MIT, see assets/flags/LICENSE); vendoring them ships only these instead of every flag.
const svgs = import.meta.glob("./assets/flags/*.svg", { eager: true, query: "?raw", import: "default" }) as Record<string, string>
const byCountry = Object.fromEntries(Object.entries(svgs).map(([path, svg]) => [path.slice(-6, -4), svg]))

// Most ISO 4217 codes start with the country code; these are the exceptions.
const COUNTRY: Record<string, string> = { EUR: "EU", CNH: "CN" }

// A currency with no flag gets an empty frame of the same size, so rows stay aligned.
export function Flag({ code, className = "h-3.5 w-[1.3125rem]" }: { code: string; className?: string }) {
  const svg = byCountry[COUNTRY[code] ?? code.slice(0, 2)]
  const frame = `inline-block shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/15 dark:ring-white/20 [&>svg]:block [&>svg]:size-full ${className}`
  // The markup is our own vendored files, never user input.
  return svg ? <span className={frame} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} /> : <span className={`${frame} bg-muted`} aria-hidden />
}
