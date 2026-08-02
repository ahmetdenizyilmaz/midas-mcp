#!/usr/bin/env node
/**
 * Backtest of the CLAUDE.md v3 TechnicalTiming sub-score (the mechanical part of the
 * Price axis). For each symbol and each historical date (weekly steps), the score is
 * computed using ONLY data up to that date, then compared with the realized forward
 * return 5/21/63 trading days later.
 *
 * What this validates: the technical rules (trend filters, RSI handling, freefall
 * penalty, support proximity, volume). What it cannot validate: Quality/News/Macro,
 * which need point-in-time fundamentals that cannot be reconstructed without
 * look-ahead bias.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { gql } from "./api.js";
import { session } from "./session.js";
import { resolveSymbol } from "./midas.js";
import { computeTechnicals, type Candle } from "./technicals.js";
import { realVwap } from "./vwap.js";
import { PROJECT_ROOT } from "./config.js";

const SYMBOLS = [
  // liquid large caps
  "THYAO", "ASELS", "TUPRS", "GARAN", "AKBNK", "ISCTR", "YKBNK", "EREGL", "SISE",
  "BIMAS", "FROTO", "TOASO", "TCELL", "PGSUS", "SAHOL", "KCHOL", "ARCLK", "PETKM",
  "ENKAI", "HEKTS", "ASTOR",
  // the user's small/mid caps
  "KONTR", "SASA", "TUCLK", "TSKB", "TKNSA", "CANTE", "BEGYO", "ETILR", "UCAYM",
];

const CHART_QUERY = /* GraphQL */ `
  query getChart($request: CandleRequest!) {
    chart(request: $request) {
      candles { o h l c v t }
    }
  }
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHistory(uid: string, targetBars: number): Promise<Candle[]> {
  let all: Candle[] = [];
  let before = Date.now();
  for (let page = 0; page < 4 && all.length < targetBars; page++) {
    const data = await gql("getChart", CHART_QUERY, {
      request: { uid, interval: "1d", before, limit: 500, ethIncluded: true },
    });
    const batch = (data.chart?.candles ?? []) as Candle[];
    if (!batch.length) break;
    all = [...batch, ...all];
    before = batch[0].t - 1;
    if (batch.length < 100) break;
    await sleep(1500); // the chart endpoint rate-limits aggressive paging
  }
  // de-dup on timestamp, keep chronological
  const seen = new Set<number>();
  return all.filter((c) => (seen.has(c.t) ? false : (seen.add(c.t), true)));
}

// ---- codified TechnicalTiming score (reference implementation of CLAUDE.md v3) ----

function localRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  let ag = g / period, al = l / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

interface ScoredPoint {
  score: number;
  freefall: boolean;
  oversoldRecovery: boolean;
  rsi: number | null;
  /** Point-in-time z-score of price vs the trailing-year inflation-adjusted VWAP. */
  vwapZ: number | null;
  vwapPremium: number | null;
  /** Deep-below-VWAP AND showing signs of basing (support/volume/RSI turning). */
  stabilizing: boolean;
}

function technicalTimingScore(window: Candle[]): ScoredPoint {
  const t = computeTechnicals("X", window, "1d");
  const closes = window.map((c) => c.c);
  const vols = window.map((c) => c.v);
  const price = t.price;
  let s = 50;

  // trend
  if (t.trend.sma200 !== null) s += price > t.trend.sma200 ? 10 : -10;
  if (t.trend.sma50 !== null) s += price > t.trend.sma50 ? 8 : -8;
  if (t.trend.goldenCross !== null) s += t.trend.goldenCross ? 7 : -7;

  // momentum
  if (t.momentum.macd) s += t.momentum.macd.histogram >= 0 ? 6 : -6;
  const rsi = t.momentum.rsi14;
  if (rsi !== null) {
    if (rsi > 75) s -= 10;
    else if (rsi > 65) s -= 3;
    else if (rsi >= 40) s += 5;
    // backtest finding: plain RSI<30 was mildly POSITIVE on BIST (60% 21d hit rate,
    // +0.4% excess) — the danger is the freefall pattern, not oversold alone. No penalty.
  }
  const rsiPrev = localRsi(closes.slice(0, -5));
  const oversoldRecovery =
    rsi !== null && rsiPrev !== null && rsiPrev < 32 && rsi > rsiPrev + 3;
  if (oversoldRecovery) s += 8;

  // volume
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const avg5 = avg(vols.slice(-5));
  const avg20 = avg(vols.slice(-20));
  const avg60 = vols.length >= 60 ? avg(vols.slice(-60)) : avg20;
  if (avg20 > avg60) s += 5;
  const lastUp = closes[closes.length - 1] > closes[closes.length - 2];
  if (vols[vols.length - 1] > 1.5 * avg20 && lastUp) s += 4;

  // structure
  const sup = t.levels.nearestSupport;
  if (sup && sup.touches >= 2 && price <= sup.level * 1.03) s += 6;
  const res = t.levels.nearestResistance;
  if (res && price >= res.level * 0.97) s -= 4;
  if (t.levels.pctFrom52wHigh > -5) s += 4;
  if (t.levels.pctFrom52wLow < 5) s -= 4;

  // parabolic-extension penalty (backtest finding: score-86+ blowoffs on TUCLK
  // May-2024 and CANTE Nov-2025 preceded −17%..−31% 63d moves — price far above
  // SMA50 with a hot RSI marks small-cap tops, momentum points must not chase it)
  if (t.trend.sma50 !== null && price > t.trend.sma50 * 1.35 && rsi !== null && rsi > 60) {
    s -= 10;
  }

  // freefall penalty: price < SMA50 < SMA200, 20d low made in the last 5 bars,
  // and volume not improving
  const lows20 = window.slice(-20).map((c) => c.l);
  const minIdx = lows20.indexOf(Math.min(...lows20));
  const newLow = minIdx >= 15;
  const freefall =
    t.trend.sma50 !== null &&
    t.trend.sma200 !== null &&
    price < t.trend.sma50 &&
    t.trend.sma50 < t.trend.sma200 &&
    newLow &&
    avg5 <= avg20;
  if (freefall) s -= 13;

  // real-VWAP positioning, valued in the purchasing power of the evaluation date
  const asOf = window[window.length - 1].t;
  const rv = realVwap(window, 252, asOf);
  const vwapZ = rv ? rv.zScore : null;
  const vwapPremium = rv ? rv.premiumPct : null;

  // "stabilizing" = deep below real VWAP but no longer in free descent:
  // sitting on a multi-touch support, or volume picking up, or RSI turning off the low
  const nearSupport = !!(sup && sup.touches >= 2 && price <= sup.level * 1.05);
  const volumeImproving = avg5 > avg20;
  const stabilizing =
    vwapZ !== null && vwapZ <= -1.5 && (nearSupport || volumeImproving || oversoldRecovery);

  return {
    score: Math.max(0, Math.min(100, s)),
    freefall,
    oversoldRecovery,
    rsi,
    vwapZ,
    vwapPremium,
    stabilizing,
  };
}

// ---- run ------------------------------------------------------------------------

interface Obs {
  symbol: string;
  t: number;
  score: number;
  freefall: boolean;
  oversoldRecovery: boolean;
  rsi: number | null;
  vwapZ: number | null;
  vwapPremium: number | null;
  stabilizing: boolean;
  f5: number;
  f21: number;
  f63: number;
}

const observations: Obs[] = [];
const WINDOW = 320; // bars of history each score sees
const STEP = 5; // weekly sampling

const CANDLE_CACHE = path.join(PROJECT_ROOT, "scans", "_bt_candles");
fs.mkdirSync(CANDLE_CACHE, { recursive: true });

for (const symbol of SYMBOLS) {
  try {
    const cacheFile = path.join(CANDLE_CACHE, `${symbol}.json`);
    let candles: Candle[];
    if (fs.existsSync(cacheFile)) {
      candles = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } else {
      const asset = await resolveSymbol(symbol);
      candles = await fetchHistory(asset.uid, 900);
      fs.writeFileSync(cacheFile, JSON.stringify(candles));
      await sleep(2500);
    }
    if (candles.length < WINDOW + 70) {
      console.error(`${symbol}: only ${candles.length} bars — skipped`);
      continue;
    }
    let n = 0;
    for (let i = WINDOW; i < candles.length - 63; i += STEP) {
      const window = candles.slice(i - WINDOW, i + 1);
      const point = technicalTimingScore(window);
      const c0 = candles[i].c;
      observations.push({
        symbol,
        t: candles[i].t,
        ...point,
        f5: (candles[i + 5].c / c0 - 1) * 100,
        f21: (candles[i + 21].c / c0 - 1) * 100,
        f63: (candles[i + 63].c / c0 - 1) * 100,
      });
      n++;
    }
    console.error(`${symbol}: ${candles.length} bars → ${n} observations`);
  } catch (e) {
    console.error(`${symbol}: FAILED — ${e instanceof Error ? e.message : e}`);
  }
}

// cross-sectional demeaning: excess return vs the average of all names on that date
const byDate = new Map<number, Obs[]>();
for (const o of observations) {
  if (!byDate.has(o.t)) byDate.set(o.t, []);
  byDate.get(o.t)!.push(o);
}
const excess = (o: Obs, k: "f5" | "f21" | "f63") => {
  const peers = byDate.get(o.t)!;
  const mean = peers.reduce((a, b) => a + b[k], 0) / peers.length;
  return o[k] - mean;
};

function bucketStats(filter: (o: Obs) => boolean, label: string) {
  const rows = observations.filter(filter);
  if (!rows.length) return { label, n: 0 };
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    label,
    n: rows.length,
    avgF21: +mean(rows.map((o) => o.f21)).toFixed(2),
    avgExcess21: +mean(rows.map((o) => excess(o, "f21"))).toFixed(2),
    avgExcess63: +mean(rows.map((o) => excess(o, "f63"))).toFixed(2),
    hitRate21: +((rows.filter((o) => o.f21 > 0).length / rows.length) * 100).toFixed(1),
  };
}

function spearman(pairs: [number, number][]): number {
  const rank = (vals: number[]) => {
    const idx = vals.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const r = new Array(vals.length);
    idx.forEach(([, orig], pos) => (r[orig] = pos));
    return r;
  };
  const xs = rank(pairs.map((p) => p[0]));
  const ys = rank(pairs.map((p) => p[1]));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

// mean cross-sectional information coefficient (score vs 21d forward, per date)
const ics: number[] = [];
const vwapIcs: number[] = [];
for (const [, rows] of byDate) {
  if (rows.length >= 10) {
    ics.push(spearman(rows.map((o) => [o.score, o.f21] as [number, number])));
    const withZ = rows.filter((o) => o.vwapZ !== null);
    if (withZ.length >= 10) {
      // negated: hypothesis is that a LOWER z (cheaper vs real VWAP) predicts HIGHER returns
      vwapIcs.push(spearman(withZ.map((o) => [-o.vwapZ!, o.f63] as [number, number])));
    }
  }
}
const meanIC = ics.reduce((a, b) => a + b, 0) / ics.length;
const meanVwapIC = vwapIcs.reduce((a, b) => a + b, 0) / (vwapIcs.length || 1);

const summary = {
  totalObservations: observations.length,
  symbols: [...new Set(observations.map((o) => o.symbol))].length,
  dateRange: [
    new Date(Math.min(...observations.map((o) => o.t))).toISOString().slice(0, 10),
    new Date(Math.max(...observations.map((o) => o.t))).toISOString().slice(0, 10),
  ],
  scoreBuckets: [
    bucketStats((o) => o.score < 35, "score <35 (weak/destructive)"),
    bucketStats((o) => o.score >= 35 && o.score < 45, "score 35-45"),
    bucketStats((o) => o.score >= 45 && o.score < 55, "score 45-55 (neutral)"),
    bucketStats((o) => o.score >= 55 && o.score < 65, "score 55-65"),
    bucketStats((o) => o.score >= 65, "score ≥65 (constructive)"),
  ],
  rules: [
    bucketStats((o) => o.freefall, "FREEFALL flagged"),
    bucketStats((o) => !o.freefall && o.score < 45, "score<45 but no freefall"),
    bucketStats((o) => o.rsi !== null && o.rsi < 30 && !o.oversoldRecovery, "RSI<30 alone (knife?)"),
    bucketStats((o) => o.oversoldRecovery, "oversold RECOVERY (RSI turning up)"),
    bucketStats((o) => o.rsi !== null && o.rsi > 70, "RSI>70 overbought"),
  ],
  realVwapBuckets: [
    bucketStats((o) => o.vwapZ !== null && o.vwapZ <= -2, "vwap z <= -2 (deep capitulation)"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ > -2 && o.vwapZ <= -1, "vwap z -2..-1"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ > -1 && o.vwapZ <= 0, "vwap z -1..0"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ > 0 && o.vwapZ <= 1, "vwap z 0..+1"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ > 1 && o.vwapZ <= 2, "vwap z +1..+2"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ > 2, "vwap z > +2 (extended)"),
  ],
  capitulationSplit: [
    bucketStats((o) => o.vwapZ !== null && o.vwapZ <= -1.5 && o.stabilizing, "deep + STABILIZING"),
    bucketStats((o) => o.vwapZ !== null && o.vwapZ <= -1.5 && !o.stabilizing, "deep + still falling"),
  ],
  meanCrossSectionalIC_f21: +meanIC.toFixed(4),
  icDates: ics.length,
  /** Positive = cheaper-vs-real-VWAP predicted higher 63d returns (mean reversion wins). */
  meanIC_negVwapZ_vs_f63: +meanVwapIC.toFixed(4),
};

console.log(JSON.stringify(summary, null, 2));

// per-symbol trace for case studies
const csv = ["symbol,date,score,freefall,rsi,f5,f21,f63"];
for (const o of observations) {
  csv.push(
    `${o.symbol},${new Date(o.t).toISOString().slice(0, 10)},${o.score},${o.freefall ? 1 : 0},${o.rsi?.toFixed(1) ?? ""},${o.f5.toFixed(2)},${o.f21.toFixed(2)},${o.f63.toFixed(2)}`
  );
}
fs.writeFileSync(path.join(PROJECT_ROOT, "discovery", "backtest.csv"), csv.join("\n"));
console.error(`\nwrote discovery/backtest.csv (${observations.length} rows)`);

await session.close();
