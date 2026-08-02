/**
 * Turkish CPI (TÜFE) deflator.
 *
 * Converts a nominal TRY amount observed on some past date into today's purchasing
 * power, so that prices across a high-inflation period can be compared honestly.
 *
 * The series is a monthly index (arbitrary base — only ratios matter). Values marked
 * `source: "reported"` are anchored on published TÜİK/TradingEconomics figures; the
 * `"interpolated"` months are filled geometrically between anchors, which is safe here
 * because the deflator is used cumulatively — a small misallocation between two adjacent
 * months barely moves a multi-hundred-day weighted average.
 *
 * Refresh monthly: add the new print to CPI_SERIES and mark it "reported".
 */

export interface CpiPoint {
  /** First day of the month, YYYY-MM. */
  month: string;
  index: number;
  source: "reported" | "interpolated" | "estimated";
  note?: string;
}

export const CPI_SERIES: CpiPoint[] = [
  { month: "2024-12", index: 84.34, source: "estimated", note: "back-cast from Jan-25 MoM +5.03%" },
  { month: "2025-01", index: 88.58, source: "estimated", note: "TÜİK MoM +5.03%" },
  { month: "2025-02", index: 90.59, source: "estimated", note: "TÜİK MoM +2.27%" },
  { month: "2025-03", index: 92.82, source: "reported", note: "= Mar-26 index / (1+30.87% YoY)" },
  { month: "2025-04", index: 95.60, source: "reported", note: "= Apr-26 index / (1+32.37% YoY)" },
  { month: "2025-05", index: 97.07, source: "reported", note: "= May-26 128.72 / 1.3261" },
  { month: "2025-06", index: 98.39, source: "reported", note: "= Jun-26 129.99 / 1.3211" },
  { month: "2025-07", index: 100.77, source: "interpolated" },
  { month: "2025-08", index: 103.21, source: "interpolated" },
  { month: "2025-09", index: 105.71, source: "interpolated" },
  { month: "2025-10", index: 108.27, source: "interpolated" },
  { month: "2025-11", index: 110.89, source: "interpolated" },
  { month: "2025-12", index: 113.57, source: "interpolated" },
  { month: "2026-01", index: 116.32, source: "interpolated" },
  { month: "2026-02", index: 119.16, source: "reported", note: "= Mar-26 121.47 / 1.0194" },
  { month: "2026-03", index: 121.47, source: "reported", note: "= Apr-26 126.55 / 1.0418" },
  { month: "2026-04", index: 126.55, source: "reported", note: "= May-26 128.72 / 1.0171" },
  { month: "2026-05", index: 128.72, source: "reported", note: "TradingEconomics CPI level, YoY 32.61%" },
  { month: "2026-06", index: 129.99, source: "reported", note: "TradingEconomics CPI level, YoY 32.11%, MoM +0.99%" },
  { month: "2026-07", index: 132.59, source: "estimated", note: "TCMB flagged a temporary July uptick; assumed MoM +2.0%" },
  { month: "2026-08", index: 134.31, source: "estimated", note: "assumed MoM +1.3%" },
];

/** Average MoM inflation over the last 6 known months — used to extrapolate off the ends. */
function tailMonthlyRate(): number {
  const n = CPI_SERIES.length;
  const a = CPI_SERIES[n - 7].index;
  const b = CPI_SERIES[n - 1].index;
  return (b / a) ** (1 / 6);
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * CPI index for a timestamp. Months inside the series interpolate linearly between the
 * bracketing month-start values (so intra-month drift is smooth); months outside are
 * extrapolated at the recent average rate.
 */
export function cpiAt(timestampMs: number): number {
  const key = monthKey(timestampMs);
  const first = CPI_SERIES[0];
  const last = CPI_SERIES[CPI_SERIES.length - 1];
  const rate = tailMonthlyRate();

  if (key < first.month) return first.index * rate ** monthsBetween(first.month, key);
  if (key >= last.month) return last.index * rate ** monthsBetween(last.month, key);

  const i = CPI_SERIES.findIndex((p) => p.month === key);
  if (i === -1) {
    // month missing from the table entirely — bracket it
    const before = [...CPI_SERIES].reverse().find((p) => p.month < key)!;
    return before.index * rate ** monthsBetween(before.month, key);
  }

  // linear within the month, toward the next month's level
  const next = CPI_SERIES[i + 1] ?? { index: CPI_SERIES[i].index * rate };
  const d = new Date(timestampMs);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const frac = (d.getUTCDate() - 1) / daysInMonth;
  return CPI_SERIES[i].index + (next.index - CPI_SERIES[i].index) * frac;
}

/** The index level used as "today" — the last entry in the series. */
export function currentCpi(): number {
  return CPI_SERIES[CPI_SERIES.length - 1].index;
}

/**
 * Multiplier that converts a nominal TRY amount from `timestampMs` into today's TRY.
 * A price from a year ago gets multiplied up by roughly (1 + yearly inflation).
 */
export function deflatorToToday(timestampMs: number): number {
  return currentCpi() / cpiAt(timestampMs);
}
