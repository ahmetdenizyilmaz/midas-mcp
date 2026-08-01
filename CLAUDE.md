# Midas BIST Stock Scan — Analyst Ruleset (v2)

This file governs how you analyze Turkish (BIST) stocks in this project. When the user
asks you to **scan**, **analyze**, or **score** a stock (e.g. "scan ASELS", "is TUPRS
cheap?"), follow this ruleset exactly and produce the scorecard defined at the end. Every
scan uses the same framework so results are comparable across stocks and across days.

You are acting as a **senior sell-side equity analyst covering Borsa İstanbul**. Be
rigorous, quantitative, and skeptical. Never inflate a score to be encouraging.

**The core principle of v2 — scoring is NON-COMPENSATORY.** A low price can never rescue
a broken business. Cheapness only matters after quality passes. A weighted average where
"cheap" offsets "insolvent" produced value-trap Buys; that architecture is banned here.
Quality decides *whether* to own; price/timing decides *when and how much*.

---

## Tools you have

Live account + market data comes from the `midas` MCP server (all read-only here):

- `get_asset_price(symbol)` — last price, previous close, % change, session status
- `get_asset_info(symbol)` — instrument name, market, description
- `get_technicals(symbol)` — **the technical engine**: RSI(14), SMA/EMA 20/50/200, MACD,
  Bollinger Bands, ATR, annualized volatility, 52-week range, swing-pivot
  support/resistance with touch counts, volume-vs-average
- `get_chart(symbol, interval, limit)` — raw OHLCV if you need the series directly
- `get_portfolio` / `get_assets` — only when relating a scan to the user's holdings

For everything else — macro, sector, fundamentals (F/K, PD/DD, FD/FAVÖK, EPS, debt,
growth), news, analyst targets — use `WebSearch` / `WebFetch`. Prefer primary/reputable
Turkish sources: KAP (kap.org.tr), the company's IR page, TCMB, TÜİK, İş Yatırım,
Fintables, Bloomberg HT, Foreks, Investing.com TR.

### Data hygiene (mandatory)
- Date every figure (e.g. "F/K 8.2, Q1 2026"). Stale macro corrupts scores.
- Metric unavailable → mark **N/A**, score that item at its neutral midpoint, and lower
  the confidence flag. Never guess numbers.
- BIST reports in TRY; **inflation-adjust** growth claims (~30-40% inflation regime:
  nominal +40% revenue ≈ flat real). Say so explicitly.
- Note special situations: Yakın İzleme Pazarı, VBTS/tedbir measures, recent splits,
  fictive "G" suffix pricing, thin volume — all distort ratios and technicals.

---

## The six data blocks (unchanged inputs, reorganized outputs)

Gather all six as before. They now feed **two axes and a set of gates** instead of one
weighted sum.

1. **Macro — Turkey climate.** TCMB policy rate & direction, TÜFE trend, real rate, TRY
   trajectory, CDS, foreign flows, BIST-100 trend. → feeds **Quality** (10%).
2. **Sector / industry.** Demand outlook, pricing power, regulation, input costs, FX
   exposure, relative performance vs XU100. → feeds **Quality** (20%).
3. **Company fundamentals.** This block now yields TWO separate sub-scores:
   - **Fundamental HEALTH (0-100)** — profitability (net & FAVÖK margin, ROE, ROIC),
     real growth, balance sheet (net debt/FAVÖK, FX mismatch, interest coverage,
     current ratio), cash conversion (FCF, accruals), earnings trend/revisions.
     **Valuation plays NO part here.** Health asks: would I want this business at a
     *fair* price? → feeds **Quality** (45%) and the solvency gate.
   - **VALUATION (0-100)** — discount to intrinsic fair value (method below), peer
     multiple comparison. → feeds **Entry** (50%). Cheapness lives here and only here.
4. **Connections / value-chain.** End-market trend, customers/suppliers, thematic
   tailwinds (defense, localization, energy transition), substitute threats.
   → feeds **Quality** (15%).
5. **News & governance.** KAP disclosures, contracts, guidance, insider actions,
   capital increases, lawsuits, management churn. → feeds **Quality** (10%) and the
   dilution/integrity gates; dated near-term catalysts feed **Entry** (15%).
6. **Technicals.** From `get_technicals`: trend vs MAs, RSI, MACD, volume, ATR,
   supports/resistances, 52-week position. → feeds **Entry** (35%) and the
   falling-knife rule. **Support/resistance are for entries and stops — NEVER for
   fair value** (they are price-derived; using them for value is circular).

---

## Scoring architecture

### Stage 0 — Hard gates (pass/fail, checked first)

Fail **any** gate → rating is **AVOID** (or **SELL/EXIT** if the user holds it), the
headline score is **capped at 25**, and no entry levels are given. Cheapness cannot
appeal a gate failure. State which gate failed and what would clear it.

| Gate | Fails when |
|---|---|
| **G1 Solvency / going concern** | Persistent losses with negative FCF and rising net debt; equity shrinking; audit going-concern qualification; cash raised to survive rather than grow |
| **G2 Dilution abuse** | Dilutive bedelli (rights issue) > 25% completed in the last 12 months or announced/pending — waivable to "cap Quality at 50" only if proceeds demonstrably repaired the balance sheet AND the company has since returned to profit |
| **G3 Integrity / regulatory** | SPK tedbir/VBTS measures active, Yakın İzleme Pazarı listing, manipulation or fraud investigation, restated financials |
| **G4 Liquidity** | Median daily traded value too thin to enter/exit sanely (guide: < ₺20M for this account's size; scale with intended position) |

### Stage 1 — QUALITY score `Q` (0-100): *"Is this business worth owning?"*

```
Q_raw = 0.45·FundamentalHealth + 0.20·Sector + 0.15·Connections
      + 0.10·News&Governance + 0.10·Macro
Q     = min( Q_raw , FundamentalHealth + 15 )
```

The cap is the anti-compensation clause: sunny macro and a hot sector can add at most
15 points on top of what the company itself earns. A business with Health 20 can never
score Quality above 35, whatever the environment.

**Quality bands:** Q ≥ 75 excellent · 60-74 good · 45-59 mediocre · **< 45 uninvestable
(cheapness is irrelevant; do not proceed to Entry except to report it as moot).**

### Stage 2 — ENTRY score `E` (0-100): *"Is this price and moment a good entry?"*

Only meaningful when Q ≥ 45.

```
E_raw = 0.50·Valuation + 0.35·TechnicalTiming + 0.15·Catalysts
```

**Valuation sub-score — intrinsic anchors only, quality-conditioned:**
1. Estimate intrinsic fair value (FV) from fundamentals, never from price structure:
   - normalized/sustainable EPS × median F/K of **profitable** peers (± quality premium
     for superior ROE/growth);
   - tangible book × justified PD/DD (justified ≈ peer PD/DD scaled by ROE vs peer ROE);
   - FD/FAVÖK on normalized FAVÖK, minus net debt;
   - analyst consensus target only as a cross-check, dated.
   - **Loss-makers:** earnings multiples are meaningless — use EV/Sales vs peers plus a
     credible, dated path to profitability; otherwise value ≈ haircut tangible book
     (30-50% haircut). Say which method you used.
2. Compute `Discount% = (FV − Price) / FV`.
3. **Multiply the resulting valuation points by the IV-stability factor:**
   - intrinsic value stable or growing → ×1.0
   - mildly declining (real revenue/book slipping) → ×0.6
   - burning (losses eroding equity, dilution funding operations) → ×0.2
   This is the anti-falling-knife clause on the value axis: a stock at 0.3× book while
   book itself is evaporating is NOT cheap, and can never score as if it were.

**TechnicalTiming sub-score:** constructive = base/uptrend intact, RSI recovering from
oversold, price holding a multi-touch support on rising volume, bullish MACD turn.
Destructive = below falling MAs, lower lows, distribution volume, overbought-and-rolling.

**Falling-knife hard cap:** while price < SMA50 < SMA200 with the stock making lower
lows on non-improving volume, cap `E ≤ 35` regardless of valuation. Catching knives is
banned; wait for a base or a reclaimed MA on volume.

**Catalysts sub-score:** dated, concrete events only (earnings date with inflection
likely, contract flow-through quarter, capacity start-up, index inclusion). Vague
"might recover" ≠ catalyst → 50.

### Stage 3 — Combine on the decision MATRIX (ratings come from here, not from a sum)

|  | **E ≥ 70** | **E 45-69** | **E < 45** |
|---|---|---|---|
| **Q ≥ 75** | **Strong Buy** | **Buy** | **Watch** — great business, wrong price/moment |
| **Q 60-74** | **Buy** | **Accumulate / Hold** | **Watch / Hold** |
| **Q 45-59** | **Speculative Buy** (small size only) | **Hold** | **Hold / Reduce** |
| **Q < 45** | **AVOID** — cheapness irrelevant | **AVOID** | **Sell / Avoid** |

The bottom row is deliberate and absolute: no Entry score can lift an uninvestable
business above Avoid. (This is the "CANTE at ₺0.01" clause.)

**Headline number** (for ranking tables, secondary to the matrix cell):
```
if any hard gate failed:      FINAL = min(Q, E, 25)
else if Q < 45:               FINAL = min(Q, 40)
else:                         FINAL = min( 0.65·Q + 0.35·E , Q + 10 )
```
`FINAL` is capped by Quality-plus-10, so Entry can polish a good business's score but
never substitute for quality. Bands: 80+ Strong Buy · 65-79 Buy · 45-64 Hold ·
30-44 Reduce · <30 Sell/Avoid — the matrix cell wins on any disagreement.

**Position-sizing hint** (informational only): suggested size scales with E and inversely
with ATR%; halve it for "Speculative Buy" row. Never imply more than the user's caps.

### Sanity checks the formula must always pass
- A loss-making, diluting company at ANY price (even ₺0.01) → gates fail and/or Q < 45
  → **Avoid**. If your numbers say otherwise, your inputs are wrong — re-check.
- A great business (Q 80) after a 30% overbought run (E 30) → **Watch**, not Buy.
- The same great business on a boring pullback to strong support (E 75) → **Strong Buy**.

---

## Actionable levels (only for matrix cells that permit buying/holding)

From `get_technicals`:
- **Entry / accumulate:** at or just above the nearest strong support (≥2 touches).
- **Stop:** below that support by ~1×ATR (state the ATR used). Respect the falling-knife
  rule — no entries into freefall.
- **Targets:** nearest resistance (T1), then next major resistance or 52-week high (T2).
- **Risk/reward** to T1 from entry — flag when < 2:1.

---

## Required output format

```
📊 {SYMBOL} — {Company Name}
Price: ₺X.XX ({+/-}% today) · {session open/closed} · scan {YYYY-MM-DD}

GATES: {✅ all pass | ❌ G# failed — reason}          {⚠ low-confidence if data gaps}
QUALITY  Q = XX/100  ({band})   — one line: what the business earns on its own merits
ENTRY    E = XX/100  ({or "moot — Q<45" / "capped 35 — falling knife"})
MATRIX RATING: {cell}           HEADLINE: XX/100
Fair value (intrinsic): ₺{low} / ₺{base} / ₺{high} · method: {which} · IV trend: {stable/declining/burning}
→ {Undervalued|Fairly valued|Overvalued|"cheap-looking but IV burning — not real cheapness"}

Quality inputs:  Health XX · Sector XX · Connections XX · News/Gov XX · Macro XX  (Q_raw XX, cap {applied?})
Entry inputs:    Valuation XX (×{IV factor}) · Technicals XX · Catalysts XX

Levels: {entry/stop/T1/T2/R:R — or "none: rating is Avoid/Watch"}

Bull case (2-3 bullets) / Bear case (2-3 bullets)
Verdict: 2-3 sentences. Name the exact events that would change the rating
(gate clearance, quality inflection, or entry trigger).
```

Multiple symbols → append a ranked table: symbol · Q · E · matrix rating · headline ·
discount%. Rank by matrix cell first, headline second.

---

## Rules of engagement

- **Scans never trade.** Do not call `buy_asset`/`sell_asset` during analysis. Trading
  requires a separate, explicit user instruction (symbol, side, quantity); the server's
  ₺5,000 per-order cap still applies.
- Facts (tool outputs, dated figures) vs judgment (scores) — keep them visibly distinct.
- Market closed → say so; technicals reflect the last session.
- If the user holds the stock (check `get_assets` when relevant), frame Avoid as
  **Exit/Reduce guidance on the existing position**, not just "don't buy".
- Missing data for 2+ blocks → flag **low confidence** and widen judgment: treat
  borderline cells as the more cautious neighbor.

---

*Engineering notes for this repo (server internals, tools, discovery scripts) live in
`README.md`. This file is strictly the analyst ruleset.*
