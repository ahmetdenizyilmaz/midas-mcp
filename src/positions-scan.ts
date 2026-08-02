#!/usr/bin/env node
/**
 * Compute the v3.2 positioning term for every symbol in the BIST-100 batch.
 * Reuses any cached candles; fetches the rest with throttling.
 * Writes scans/_positioning.json.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { session } from "./session.js";
import { resolveSymbol } from "./midas.js";
import { getCandles, type Candle } from "./technicals.js";
import { computePositioning } from "./positioning.js";
import { PROJECT_ROOT } from "./config.js";

const symbols = (process.argv[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const CACHES = [
  path.join(PROJECT_ROOT, "scans", "_candles"),
  path.join(PROJECT_ROOT, "scans", "_bt_candles"),
];
const PRIMARY = CACHES[0];
fs.mkdirSync(PRIMARY, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cached(sym: string): Candle[] | null {
  for (const dir of CACHES) {
    const f = path.join(dir, `${sym}.json`);
    if (fs.existsSync(f)) {
      const c = JSON.parse(fs.readFileSync(f, "utf8")) as Candle[];
      if (c.length >= 260) return c;
    }
  }
  return null;
}

const out: Record<string, unknown> = {};
let fetched = 0;
for (const sym of symbols) {
  let candles = cached(sym);
  if (!candles) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const asset = await resolveSymbol(sym);
        candles = await getCandles(asset.uid, "1d", 400);
        fs.writeFileSync(path.join(PRIMARY, `${sym}.json`), JSON.stringify(candles));
        ok = true;
        fetched++;
        await sleep(2500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("429") && attempt < 2) {
          console.error(`${sym} rate-limited, waiting ${(attempt + 1) * 45}s`);
          await sleep((attempt + 1) * 45_000);
        } else {
          console.error(`${sym} FAILED: ${msg}`);
          break;
        }
      }
    }
  }
  if (!candles || candles.length < 260) {
    out[sym] = { error: "insufficient history", term: 0 };
    continue;
  }
  const p = computePositioning(candles);
  out[sym] = {
    z: p.z,
    premiumPct: p.premiumPct,
    volumeAbovePricePct: p.volumeAbovePricePct,
    realVwap: p.vwap?.realVwap ?? null,
    nominalVwap: p.vwap?.nominalVwap ?? null,
    stabilizing: p.stabilizing,
    stabilizingReasons: p.stabilizingReasons,
    term: p.term,
    bucket: p.bucket,
    rationale: p.rationale,
  };
  console.error(`${sym}: z=${p.z?.toFixed(2)} term=${p.term >= 0 ? "+" : ""}${p.term} (${p.bucket})`);
}

fs.writeFileSync(
  path.join(PROJECT_ROOT, "scans", "_positioning.json"),
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify({ symbols: symbols.length, fetched, done: Object.keys(out).length }));
await session.close();
