/**
 * Real-VWAP positioning term (CLAUDE.md v3.2).
 *
 * A bounded adjustment applied AFTER the Q/P blend, like the tape term. It asks where
 * price sits relative to what holders actually paid in today's lira — a flow/positioning
 * question, deliberately kept out of the Valuation sub-score because real VWAP is derived
 * from price and using it as a fair-value anchor would be circular.
 *
 * The shape is non-monotonic and comes straight from the backtest (29 BIST names,
 * Nov 2023 – Apr 2026, 3,478 point-in-time observations, returns vs the same-date peer
 * average):
 *
 *   z ≤ −2 (deep capitulation)  n=189    excess 63d  +0.58%
 *   z −2..−1                    n=1139   excess 63d  −3.15%   ← worst cohort in the study
 *   z −1..0                     n=871    excess 63d  −2.10%
 *   z 0..+1                     n=536    excess 63d  +1.47%
 *   z +1..+2                    n=520    excess 63d  +6.59%   ← best cohort
 *   z > +2                      n=223    excess 63d  +4.90%
 *
 * and the split that carries the real signal, on identical cheapness:
 *   deep + stabilizing          n=529    excess 63d  +0.08%
 *   deep + still falling        n=158    excess 63d  −3.97%
 *
 * Hence: reward the extreme tail only when it is confirmed, penalise mild weakness
 * (which is where money was actually lost), and reward confirmed strength.
 *
 * Mean IC of −z vs 63d return was −0.159, i.e. across the whole range momentum beat
 * mean reversion. That is why "cheaper is always better" is NOT the shape used here.
 */
import type { Candle } from "./technicals.js";
import { realVwap, type VwapResult } from "./vwap.js";

export interface Positioning {
  vwap: VwapResult | null;
  z: number | null;
  premiumPct: number | null;
  /** Volume share of the window that traded above the current price, in real terms. */
  volumeAbovePricePct: number | null;
  /** Deep below real VWAP AND showing basing behaviour rather than free descent. */
  stabilizing: boolean;
  stabilizingReasons: string[];
  /** Bounded adjustment, −5 … +10, added to FINAL after the risk overlay. */
  term: number;
  bucket: string;
  rationale: string;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  let ag = g / period;
  let al = l / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

/** Swing-low support with at least `minTouches` touches, nearest below price. */
function nearestSupport(candles: Candle[], price: number, span = 3) {
  const lows: number[] = [];
  for (let i = span; i < candles.length - span; i++) {
    let isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j !== i && candles[j].l <= candles[i].l) isLow = false;
    }
    if (isLow) lows.push(candles[i].l);
  }
  const tol = price * 0.02;
  const groups: { level: number; touches: number }[] = [];
  for (const p of [...lows].sort((a, b) => a - b)) {
    const g = groups.find((x) => Math.abs(x.level - p) <= tol);
    if (g) {
      g.level = (g.level * g.touches + p) / (g.touches + 1);
      g.touches += 1;
    } else {
      groups.push({ level: p, touches: 1 });
    }
  }
  return groups.filter((g) => g.level < price).sort((a, b) => b.level - a.level)[0] ?? null;
}

export function computePositioning(candles: Candle[], asOfMs?: number): Positioning {
  const v = realVwap(candles, 252, asOfMs);
  const price = candles[candles.length - 1].c;
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v);

  if (!v) {
    return {
      vwap: null,
      z: null,
      premiumPct: null,
      volumeAbovePricePct: null,
      stabilizing: false,
      stabilizingReasons: [],
      term: 0,
      bucket: "insufficient history",
      rationale: "fewer than 20 bars — positioning term skipped",
    };
  }

  const z = v.zScore;
  const reasons: string[] = [];

  const sup = nearestSupport(candles, price);
  if (sup && sup.touches >= 2 && price <= sup.level * 1.05) {
    reasons.push(`holding ${sup.touches}-touch support ₺${sup.level.toFixed(2)}`);
  }
  const avg5 = mean(vols.slice(-5));
  const avg20 = mean(vols.slice(-20));
  if (avg5 > avg20) {
    reasons.push(`volume improving (5d ${(avg5 / avg20 - 1) * 100 >= 0 ? "+" : ""}${((avg5 / avg20 - 1) * 100).toFixed(0)}% vs 20d)`);
  }
  const rsiNow = rsi(closes);
  const rsiPrev = rsi(closes.slice(0, -5));
  if (rsiNow !== null && rsiPrev !== null && rsiPrev < 32 && rsiNow > rsiPrev + 3) {
    reasons.push(`RSI turning up off ${rsiPrev.toFixed(0)}`);
  }

  const stabilizing = z <= -1.5 && reasons.length > 0;

  let term: number;
  let bucket: string;
  let rationale: string;

  if (z <= -2 && stabilizing) {
    term = 10;
    bucket = "deep capitulation, confirmed";
    rationale = `${z.toFixed(2)}σ below real VWAP with ${reasons.join(" + ")} — the backtest's best cheap-side cohort`;
  } else if (z <= -2) {
    term = 2;
    bucket = "deep capitulation, unconfirmed";
    rationale = `${z.toFixed(2)}σ below real VWAP but still falling (no support hold, no volume pickup, no RSI turn) — historically −3.97% excess over 63d`;
  } else if (z <= -0.5) {
    term = -5;
    bucket = "mild weakness (the danger zone)";
    rationale = `${z.toFixed(2)}σ below real VWAP — the worst-performing cohort in the backtest (−3.15% excess over 63d, n=1139): cheap enough to look tempting, not cheap enough to have capitulated`;
  } else if (z <= 1) {
    term = 0;
    bucket = "near real VWAP";
    rationale = `${z.toFixed(2)}σ from real VWAP — no positioning edge either way`;
  } else if (z <= 2) {
    term = 5;
    bucket = "confirmed strength";
    rationale = `${z.toFixed(2)}σ above real VWAP — the backtest's best cohort (+6.59% excess over 63d)`;
  } else {
    term = 0;
    bucket = "extended";
    rationale = `${z.toFixed(2)}σ above real VWAP — still positive historically but decaying; the parabolic-extension penalty already covers blowoff risk`;
  }

  return {
    vwap: v,
    z,
    premiumPct: v.premiumPct,
    volumeAbovePricePct: v.volumeAbovePricePct,
    stabilizing,
    stabilizingReasons: reasons,
    term,
    bucket,
    rationale,
  };
}
