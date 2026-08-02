import { gql } from "./api.js";
import { resolveSymbol } from "./midas.js";
import { realVwapBundle, type RealVwapBundle } from "./vwap.js";

/** One OHLCV bar as returned by the Midas chart endpoint. */
export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

const CHART_QUERY = /* GraphQL */ `
  query getChart($request: CandleRequest!) {
    chart(request: $request) {
      interval
      candles {
        o
        h
        l
        c
        v
        t
      }
    }
  }
`;

export async function getCandles(
  uid: string,
  interval = "1d",
  limit = 400
): Promise<Candle[]> {
  const data = await gql("getChart", CHART_QUERY, {
    request: { uid, interval, before: nowMs(), limit, ethIncluded: true },
  });
  return (data.chart?.candles ?? []) as Candle[];
}

// Date.now() is fine here (the server is not a resumable workflow); isolated for clarity.
function nowMs(): number {
  return Date.now();
}

// ---- indicator math -------------------------------------------------------

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  // seed with the SMA of the first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}

/** Wilder's RSI over `period` (default 14). Returns 0-100, or null if too few bars. */
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD(12,26,9): line, signal and histogram from the closing series. */
function macd(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 26 + 9) return null;
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  // align the two EMA series on their common tail
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalSeries = emaSeries(macdLine, 9);
  if (!signalSeries.length) return null;
  const line = macdLine[macdLine.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd: round(line), signal: round(signal), histogram: round(line - signal) };
}

/** Average True Range over `period` — an absolute (currency) volatility measure. */
function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { h, l } = candles[i];
    const prevClose = candles[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose)));
  }
  return sma(trs, period);
}

/** Annualized volatility from daily log returns (≈252 trading days). */
function annualizedVolatility(closes: number[], lookback = 30): number | null {
  if (closes.length < lookback + 1) return null;
  const returns: number[] = [];
  for (let i = closes.length - lookback; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100, 2);
}

function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  if (mid === null) return null;
  const slice = closes.slice(-period);
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: round(mid), upper: round(mid + mult * sd), lower: round(mid - mult * sd) };
}

/**
 * Support/resistance from fractal swing pivots: a bar is a swing high if its high
 * exceeds `span` bars on each side (mirror for swing low). Levels are clustered so
 * near-equal touches collapse into one, and ranked by how often price respected them.
 */
function supportResistance(candles: Candle[], last: number, span = 3) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = span; i < candles.length - span; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j === i) continue;
      if (candles[j].h >= candles[i].h) isHigh = false;
      if (candles[j].l <= candles[i].l) isLow = false;
    }
    if (isHigh) highs.push(candles[i].h);
    if (isLow) lows.push(candles[i].l);
  }

  const tol = last * 0.02; // cluster pivots within 2% of each other
  const cluster = (points: number[]) => {
    const sorted = [...points].sort((a, b) => a - b);
    const groups: { level: number; touches: number }[] = [];
    for (const p of sorted) {
      const g = groups.find((x) => Math.abs(x.level - p) <= tol);
      if (g) {
        g.level = (g.level * g.touches + p) / (g.touches + 1);
        g.touches += 1;
      } else {
        groups.push({ level: p, touches: 1 });
      }
    }
    return groups.map((g) => ({ level: round(g.level), touches: g.touches }));
  };

  const resistance = cluster(highs)
    .filter((g) => g.level > last)
    .sort((a, b) => a.level - b.level);
  const support = cluster(lows)
    .filter((g) => g.level < last)
    .sort((a, b) => b.level - a.level);

  return {
    nearestSupport: support[0] ?? null,
    nearestResistance: resistance[0] ?? null,
    supports: support.slice(0, 4),
    resistances: resistance.slice(0, 4),
  };
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function pct(a: number, b: number): number {
  return round(((a - b) / b) * 100, 2);
}

export interface Technicals {
  symbol: string;
  asOf: string;
  bars: number;
  interval: string;
  price: number;
  trend: {
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    ema20: number | null;
    priceVsSma50Pct: number | null;
    priceVsSma200Pct: number | null;
    goldenCross: boolean | null;
  };
  momentum: {
    rsi14: number | null;
    rsiZone: "oversold" | "neutral" | "overbought" | null;
    macd: { macd: number; signal: number; histogram: number } | null;
    macdCrossover: "bullish" | "bearish" | null;
    roc20Pct: number | null;
  };
  volatility: {
    atr14: number | null;
    atrPctOfPrice: number | null;
    annualizedPct: number | null;
    bollinger: { middle: number; upper: number; lower: number } | null;
    bollingerPosition: "above_upper" | "upper_half" | "lower_half" | "below_lower" | null;
  };
  levels: {
    high52w: number;
    low52w: number;
    pctFrom52wHigh: number;
    pctFrom52wLow: number;
    nearestSupport: { level: number; touches: number } | null;
    nearestResistance: { level: number; touches: number } | null;
    supports: { level: number; touches: number }[];
    resistances: { level: number; touches: number }[];
  };
  volume: {
    latest: number;
    avg20: number | null;
    avg20RelativePct: number | null;
  };
  /**
   * Inflation-adjusted VWAP: what the average traded lira actually paid, in today's
   * money. `premiumPct` negative means the current price is below the real average
   * cost of everyone who traded over the window.
   */
  realVwap: RealVwapBundle;
}

/** Compute the full technical snapshot for a resolved instrument's candles. */
export function computeTechnicals(
  symbol: string,
  candles: Candle[],
  interval: string
): Technicals {
  if (candles.length < 30) {
    throw new Error(`Not enough price history for ${symbol} (${candles.length} bars) to compute technicals`);
  }
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const volumes = candles.map((c) => c.v);
  const price = closes[closes.length - 1];

  const window = candles.slice(-252);
  const high52w = Math.max(...window.map((c) => c.h));
  const low52w = Math.min(...window.map((c) => c.l));

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);
  const macdVal = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const atr14 = atr(candles, 14);
  const roc20 = closes.length >= 21 ? pct(price, closes[closes.length - 21]) : null;
  const avg20Vol = sma(volumes, 20);

  let bollingerPosition: Technicals["volatility"]["bollingerPosition"] = null;
  if (bb) {
    if (price > bb.upper) bollingerPosition = "above_upper";
    else if (price >= bb.middle) bollingerPosition = "upper_half";
    else if (price >= bb.lower) bollingerPosition = "lower_half";
    else bollingerPosition = "below_lower";
  }

  let rsiZone: Technicals["momentum"]["rsiZone"] = null;
  if (rsi14 !== null) rsiZone = rsi14 < 30 ? "oversold" : rsi14 > 70 ? "overbought" : "neutral";

  const levels = supportResistance(candles, price, 3);

  return {
    symbol,
    asOf: new Date(candles[candles.length - 1].t).toISOString(),
    bars: candles.length,
    interval,
    price: round(price),
    trend: {
      sma20: sma20 === null ? null : round(sma20),
      sma50: sma50 === null ? null : round(sma50),
      sma200: sma200 === null ? null : round(sma200),
      ema20: (() => {
        const e = ema(closes, 20);
        return e === null ? null : round(e);
      })(),
      priceVsSma50Pct: sma50 === null ? null : pct(price, sma50),
      priceVsSma200Pct: sma200 === null ? null : pct(price, sma200),
      goldenCross: sma50 === null || sma200 === null ? null : sma50 > sma200,
    },
    momentum: {
      rsi14: rsi14 === null ? null : round(rsi14, 2),
      rsiZone,
      macd: macdVal,
      macdCrossover: macdVal ? (macdVal.histogram >= 0 ? "bullish" : "bearish") : null,
      roc20Pct: roc20,
    },
    volatility: {
      atr14: atr14 === null ? null : round(atr14),
      atrPctOfPrice: atr14 === null ? null : round((atr14 / price) * 100, 2),
      annualizedPct: annualizedVolatility(closes, 30),
      bollinger: bb,
      bollingerPosition,
    },
    levels: {
      high52w: round(high52w),
      low52w: round(low52w),
      pctFrom52wHigh: pct(price, high52w),
      pctFrom52wLow: pct(price, low52w),
      nearestSupport: levels.nearestSupport,
      nearestResistance: levels.nearestResistance,
      supports: levels.supports,
      resistances: levels.resistances,
    },
    volume: {
      latest: volumes[volumes.length - 1],
      avg20: avg20Vol === null ? null : Math.round(avg20Vol),
      avg20RelativePct: avg20Vol ? pct(volumes[volumes.length - 1], avg20Vol) : null,
    },
    realVwap: realVwapBundle(candles),
  };
}

/** Resolve a symbol, fetch its candles and compute the technical snapshot. */
export async function getTechnicals(
  symbol: string,
  interval = "1d",
  limit = 400
): Promise<Technicals> {
  const asset = await resolveSymbol(symbol);
  const candles = await getCandles(asset.uid, interval, limit);
  return computeTechnicals(asset.symbol, candles, interval);
}
