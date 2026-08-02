#!/usr/bin/env node
/**
 * Re-score completed v3.1 scans under v3.2 by adding the real-VWAP positioning term.
 *
 * The term is a bounded post-blend adjustment, so a full re-scan is unnecessary: the
 * stored Q, P and R reproduce FINAL_raw exactly, and only the additive part changes.
 * Writes scans/_RESCORE.md and scans/_rescored.json.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_ROOT } from "./config.js";

const JOURNAL = process.argv[2];
if (!JOURNAL || !fs.existsSync(JOURNAL)) throw new Error("pass the workflow journal.jsonl path");

const positioning = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "scans", "_positioning.json"), "utf8")
) as Record<string, any>;

interface Row {
  symbol: string;
  company?: string;
  price?: number;
  q: number;
  p: number;
  r: number;
  tape: number;
  final31: number;
  stance31: string;
  ceiling_applied?: boolean;
  confidence?: string;
  one_line?: string;
}

const rows = new Map<string, Row>();
for (const line of fs.readFileSync(JOURNAL, "utf8").split("\n").filter(Boolean)) {
  let j: any;
  try {
    j = JSON.parse(line);
  } catch {
    continue;
  }
  const res = j?.result;
  if (j.type === "result" && res?.symbol && res.status === "ok") {
    rows.set(res.symbol, {
      symbol: res.symbol,
      company: res.company,
      price: res.price,
      q: res.q,
      p: res.p,
      r: res.r,
      tape: res.tape ?? 0,
      final31: res.final,
      stance31: res.stance,
      ceiling_applied: res.ceiling_applied,
      confidence: res.confidence,
      one_line: res.one_line,
    });
  }
}

function stanceFor(final: number): string {
  if (final >= 75) return "Strong Buy";
  if (final >= 60) return "Buy / Accumulate";
  if (final >= 45) return "Hold / Neutral";
  if (final >= 32) return "Speculative / Weak Hold";
  return "Unattractive / Reduce-into-strength";
}

const out: any[] = [];
for (const r of rows.values()) {
  const pos = positioning[r.symbol];
  const term: number = pos && typeof pos.term === "number" ? pos.term : 0;
  const blend = 100 * (r.q / 100) ** 0.45 * (r.p / 100) ** 0.55;
  const raw = blend * r.r + r.tape + term;
  // the speculative ceiling still binds after the additive terms
  const ceiling = r.q < 45 ? 55 : 100;
  const final32 = Math.max(0, Math.min(raw, ceiling));
  out.push({
    ...r,
    z: pos?.z ?? null,
    stabilizing: pos?.stabilizing ?? false,
    bucket: pos?.bucket ?? "n/a",
    reasons: pos?.stabilizingReasons ?? [],
    term,
    final32: Math.round(final32 * 10) / 10,
    stance32: stanceFor(final32),
    delta: Math.round((final32 - r.final31) * 10) / 10,
    changed: stanceFor(final32) !== r.stance31.split(" (")[0].trim(),
  });
}

out.sort((a, b) => b.final32 - a.final32);
fs.writeFileSync(path.join(PROJECT_ROOT, "scans", "_rescored.json"), JSON.stringify(out, null, 2));

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const lines: string[] = [];
lines.push("# BIST-100 scan — v3.2 re-score (real-VWAP positioning term added)");
lines.push("");
lines.push(
  `Re-scored ${out.length} completed scans. The positioning term is a bounded post-blend ` +
    "adjustment, so Q, P and R are unchanged from each stock's v3.1 scorecard — only the " +
    "additive part moves. Term shape and evidence: see `CLAUDE.md` §PositioningTerm."
);
lines.push("");
lines.push("| # | Symbol | v3.2 | v3.1 | Δ | Term | z | Bucket | Stance (v3.2) |");
lines.push("|---|---|---|---|---|---|---|---|---|");
out.forEach((r, i) => {
  lines.push(
    `| ${i + 1} | ${r.symbol} | **${r.final32}** | ${r.final31} | ${fmt(r.delta)} | ${fmt(
      r.term
    )} | ${r.z === null ? "–" : r.z.toFixed(2)} | ${r.bucket} | ${r.stance32} |`
  );
});

const stab = out.filter((r) => r.term === 10);
lines.push("");
lines.push("## Confirmed capitulation screen (term +10)");
lines.push("");
lines.push(
  "Deep below real VWAP **and** stabilizing — the backtest's sharpest discriminator " +
    "(+4 points of 63-day excess return versus the same cheapness still falling)."
);
lines.push("");
if (stab.length) {
  for (const r of stab) {
    lines.push(`- **${r.symbol}** — z ${r.z.toFixed(2)}, ${r.reasons.join("; ")} → ${r.final32} (${r.stance32})`);
  }
} else {
  lines.push("- None in the completed set.");
}

const danger = out.filter((r) => r.term === -5);
lines.push("");
lines.push(`## Danger zone (term −5): ${danger.length} names`);
lines.push("");
lines.push(
  "z between −2 and −0.5: cheap enough to look tempting, not cheap enough to have " +
    "capitulated. Historically the worst cohort (−3.15% excess over 63 days, n=1139)."
);
lines.push("");
lines.push(danger.map((r) => r.symbol).join(" · ") || "None.");

const moved = out.filter((r) => r.changed);
lines.push("");
lines.push(`## Stance changes: ${moved.length}`);
lines.push("");
for (const r of moved) {
  lines.push(`- ${r.symbol}: ${r.stance31} → **${r.stance32}** (${r.final31} → ${r.final32})`);
}

fs.writeFileSync(path.join(PROJECT_ROOT, "scans", "_RESCORE.md"), lines.join("\n") + "\n");
console.log(
  JSON.stringify({
    rescored: out.length,
    stanceChanges: moved.length,
    plus10: stab.length,
    minus5: danger.length,
  })
);
