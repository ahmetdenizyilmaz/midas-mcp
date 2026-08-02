/**
 * Inflation-adjusted (real) VWAP.
 *
 * Mirrors the TradingView VWAP indicator — source `hlc3`, value `Σ(volume·src)/Σ(volume)`,
 * bands at N volume-weighted standard deviations — with one change: every bar's price is
 * first converted into today's lira via the TÜFE deflator.
 *
 * The nominal VWAP of a Turkish stock is close to meaningless over a multi-year window:
 * a lira paid in early 2025 bought ~35% more than a lira today, so nominal VWAP
 * systematically understates what holders really paid. Real VWAP answers the honest
 * question — "in today's money, what did the average traded lira pay for this share?"
 */
import type { Candle } from "./technicals.js";
import { cpiAt, currentCpi } from "./inflation.js";

export interface VwapResult {
  /** Bars actually used. */
  bars: number;
  from: string;
  to: string;
  /** Volume-weighted average of inflation-adjusted hlc3, in today's TRY. */
  realVwap: number;
  /** Same calculation without deflating — what TradingView would show. */
  nominalVwap: number;
  /** Volume-weighted standard deviation of the real series. */
  realStdev: number;
  bands: { upper1: number; lower1: number; upper2: number; lower2: number; upper3: number; lower3: number };
  /** Current price relative to real VWAP. Negative = trading below the real average cost. */
  premiumPct: number;
  /** How many volume-weighted σ the current price sits from real VWAP. */
  zScore: number;
  /** Share of total volume that traded ABOVE the current price, in real terms. */
  volumeAbovePricePct: number;
}

const hlc3 = (c: Candle) => (c.h + c.l + c.c) / 3;

/**
 * @param candles chronological daily bars
 * @param lookback how many trailing bars to anchor on (undefined = all history)
 * @param asOfMs value everything in the purchasing power of this date instead of today.
 *   Required for point-in-time backtesting — using today's CPI on a 2024 window would
 *   leak future inflation into a historical score.
 */
export function realVwap(
  candles: Candle[],
  lookback?: number,
  asOfMs?: number
): VwapResult | null {
  const bars = lookback ? candles.slice(-lookback) : candles;
  if (bars.length < 20) return null;
  const anchorCpi = asOfMs === undefined ? currentCpi() : cpiAt(asOfMs);
  const deflatorToToday = (t: number) => anchorCpi / cpiAt(t);

  let sumVol = 0;
  let sumRealPV = 0;
  let sumNomPV = 0;
  const realPrices: number[] = [];

  for (const c of bars) {
    const vol = c.v > 0 ? c.v : 0;
    const src = hlc3(c);
    const real = src * deflatorToToday(c.t);
    realPrices.push(real);
    sumVol += vol;
    sumRealPV += vol * real;
    sumNomPV += vol * src;
  }
  if (sumVol === 0) return null;

  const realVwapValue = sumRealPV / sumVol;
  const nominalVwapValue = sumNomPV / sumVol;

  // volume-weighted variance, matching ta.vwap's stdev band construction
  let weightedSqDev = 0;
  for (let i = 0; i < bars.length; i++) {
    const vol = bars[i].v > 0 ? bars[i].v : 0;
    weightedSqDev += vol * (realPrices[i] - realVwapValue) ** 2;
  }
  const stdev = Math.sqrt(weightedSqDev / sumVol);

  const price = bars[bars.length - 1].c;
  let volAbove = 0;
  for (let i = 0; i < bars.length; i++) {
    if (realPrices[i] > price) volAbove += bars[i].v > 0 ? bars[i].v : 0;
  }

  const r = (n: number) => Math.round(n * 10000) / 10000;
  return {
    bars: bars.length,
    from: new Date(bars[0].t).toISOString().slice(0, 10),
    to: new Date(bars[bars.length - 1].t).toISOString().slice(0, 10),
    realVwap: r(realVwapValue),
    nominalVwap: r(nominalVwapValue),
    realStdev: r(stdev),
    bands: {
      upper1: r(realVwapValue + stdev),
      lower1: r(realVwapValue - stdev),
      upper2: r(realVwapValue + 2 * stdev),
      lower2: r(realVwapValue - 2 * stdev),
      upper3: r(realVwapValue + 3 * stdev),
      lower3: r(realVwapValue - 3 * stdev),
    },
    premiumPct: r(((price - realVwapValue) / realVwapValue) * 100),
    zScore: r((price - realVwapValue) / stdev),
    volumeAbovePricePct: r((volAbove / sumVol) * 100),
  };
}

export interface RealVwapBundle {
  price: number;
  /** Anchored on the trailing year, two years, and all available history. */
  year1: VwapResult | null;
  year2: VwapResult | null;
  all: VwapResult | null;
  /** Real (today's-TRY) price one year ago, for a like-for-like comparison. */
  realPriceOneYearAgo: number | null;
  realChange1yPct: number | null;
  nominalChange1yPct: number | null;
}

export function realVwapBundle(candles: Candle[]): RealVwapBundle {
  const price = candles[candles.length - 1].c;
  const oneYearIdx = Math.max(0, candles.length - 252);
  const yearAgo = candles[oneYearIdx];
  const realYearAgo = yearAgo ? yearAgo.c * (currentCpi() / cpiAt(yearAgo.t)) : null;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    price,
    year1: realVwap(candles, 252),
    year2: realVwap(candles, 504),
    all: realVwap(candles),
    realPriceOneYearAgo: realYearAgo === null ? null : round2(realYearAgo),
    realChange1yPct: realYearAgo === null ? null : round2(((price - realYearAgo) / realYearAgo) * 100),
    nominalChange1yPct: yearAgo === null ? null : round2(((price - yearAgo.c) / yearAgo.c) * 100),
  };
}
