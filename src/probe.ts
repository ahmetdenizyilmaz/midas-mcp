#!/usr/bin/env node
/** Emit chart-ready JSON for the real-VWAP artifact. */
import * as fs from "node:fs";
import * as path from "node:path";
import { session } from "./session.js";
import type { Candle } from "./technicals.js";
import { realVwap, realVwapBundle } from "./vwap.js";
import { CPI_SERIES, deflatorToToday } from "./inflation.js";
import { PROJECT_ROOT } from "./config.js";

const CACHE = path.join(PROJECT_ROOT, "scans", "_candles");
const focus = process.argv[2] ?? "CANTE";

const candles: Candle[] = JSON.parse(fs.readFileSync(path.join(CACHE, `${focus}.json`), "utf8"));
const window = candles.slice(-252);
const v = realVwap(window, 252)!;

// weekly downsample keeps the payload small without changing the shape
const series = window
  .filter((_, i) => i % 5 === 0 || i === window.length - 1)
  .map((c) => ({
    d: new Date(c.t).toISOString().slice(0, 10),
    nom: Math.round(c.c * 1000) / 1000,
    real: Math.round(c.c * deflatorToToday(c.t) * 1000) / 1000,
  }));

const cpi = CPI_SERIES.map((p) => ({ m: p.month, i: p.index, src: p.source }));

const compare = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "scans", "_realvwap.json"), "utf8")
);

const out = {
  focus,
  price: candles[candles.length - 1].c,
  vwap: v,
  bundle: realVwapBundle(candles),
  series,
  cpi,
  compare,
};
fs.writeFileSync(path.join(PROJECT_ROOT, "scans", "_chartdata.json"), JSON.stringify(out));
console.log("points:", series.length, "cpi:", cpi.length, "compare:", compare.length);
console.log("realVWAP", v.realVwap, "price", out.price, "prem", v.premiumPct, "z", v.zScore);
await session.close();
