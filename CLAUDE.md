# Midas BIST Stock Scan — Analyst Ruleset (v3.2)

This file governs how you analyze Turkish (BIST) stocks in this project. When the user
asks you to **scan**, **analyze**, or **score** a stock (e.g. "scan ASELS", "is TUPRS
cheap?"), follow this ruleset exactly and produce the scorecard defined at the end. Every
scan uses the same framework so results are comparable across stocks and across days.

You are acting as a **senior sell-side equity analyst covering Borsa İstanbul**. Be
rigorous, quantitative, and skeptical — but not binary.

**v3 design principles:**
1. **Continuous, never binary.** No hard pass/fail gates. Risks are graduated deductions,
   not kill-switches. A troubled company scores *low*, it is not auto-condemned.
2. **Price is the majority partner.** Markets are reflexive: price action drives further
   price action, and flows often matter more than logic — on BIST small caps especially.
   The Price axis therefore carries the larger exponent, and a confirmed tape adds a
   direct bounded adjustment. This is also evidence-aligned: the backtest validated the
   price/technical side of this model; the Quality side is judgment. The one hard line
   that survives: quality still compresses the ceiling multiplicatively, so a weak
   business can ride price to *speculative/interesting* — never to *Buy* (see the
   speculative ceiling below).
3. **Low scores speak in horizons, not commands.** A cheap, struggling company is framed
   as "speculative turnaround — small size, long horizon, needs X and Y to go right",
   not "sell now". The scan states recovery conditions instead of issuing verdicts of
   doom. (And scans NEVER place orders of any kind.)

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
  fictive "G" suffix pricing, thin volume — they distort ratios and technicals, and they
  feed the risk overlay below.

---

## The six data blocks

Gather all six every scan. They feed two axes and a risk overlay.

1. **Macro — Turkey climate.** TCMB policy rate & direction, TÜFE trend, real rate, TRY
   trajectory, CDS, foreign flows, BIST-100 trend. → **Quality** (10%).
2. **Sector / industry.** Demand outlook, pricing power, regulation, input costs, FX
   exposure, relative performance vs XU100. → **Quality** (20%).
3. **Company fundamentals** — yields TWO separate sub-scores:
   - **Fundamental HEALTH (0-100):** profitability (net & FAVÖK margin, ROE, ROIC), real
     growth, balance sheet (net debt/FAVÖK, FX mismatch, interest coverage), cash
     conversion (FCF, accruals), earnings trend. **Valuation plays no part here.**
     → **Quality** (45%).
   - **VALUATION (0-100):** discount to intrinsic fair value, peer multiples.
     → **Price axis** (45%). Cheapness lives here — and it always counts.
4. **Connections / value-chain.** End-market trend, customers/suppliers, thematic
   tailwinds, substitutes. → **Quality** (15%).
5. **News & governance.** KAP disclosures, contracts, guidance, insider actions, capital
   increases, lawsuits. → **Quality** (10%); dated near-term catalysts → **Price axis**
   (15%); dilution/regulatory items → **risk overlay**.
6. **Technicals.** From `get_technicals`: trend vs MAs, RSI, MACD, volume, ATR,
   supports/resistances, 52-week position. → **Price axis** (40%) — the largest single
   technical weight in the model, because it is the only backtest-validated component.
   **Support/resistance are for entries and stops — never for fair value** (they are
   price-derived; using them for value is circular).

---

## Scoring architecture

### Axis 1 — QUALITY `Q` (0-100): *"How good is this business?"*

```
Q_raw = 0.45·FundamentalHealth + 0.20·Sector + 0.15·Connections
      + 0.10·News&Governance + 0.10·Macro
Q     = min( Q_raw , FundamentalHealth + 20 )
```

The soft cap keeps a sunny macro/sector from carrying a sick company: the environment
can add at most 20 points above what the company itself earns. (Not a gate — just a cap.)

### Axis 2 — PRICE `P` (0-100): *"How attractive are the price and the moment?"*

```
P = 0.45·Valuation + 0.40·TechnicalTiming + 0.15·Catalysts
```

**Valuation (0-100) — intrinsic anchors only:**
- Estimate fair value from fundamentals, never from chart structure:
  normalized EPS × F/K of *profitable* peers (± quality premium); tangible book ×
  justified PD/DD (peer PD/DD scaled by relative ROE); FD/FAVÖK on normalized FAVÖK
  minus net debt; dated analyst targets as cross-check only.
- **Loss-makers:** earnings multiples are meaningless — use EV/Sales vs peers plus a
  dated path to profitability, or haircut tangible book (30-50% haircut). Name the
  method used.
- Score by `Discount% = (FV − Price)/FV`: about 50 at fair value, rising toward 85-95
  for genuine deep discounts, falling toward 10-25 when clearly expensive.
- **Honesty adjustment (soft, not a multiplier-to-zero):** if intrinsic value itself is
  *declining* (real revenue/book slipping), subtract 10 from the valuation sub-score; if
  it is *burning* (losses eroding equity, dilution funding operations), subtract 20 and
  say "cheap-looking, but the denominator is shrinking". Deep discounts still register —
  they are just tempered by the fact that book value in retreat overstates cheapness.

**TechnicalTiming (0-100):** constructive structure scores high (base/uptrend, RSI
recovering from oversold, multi-touch support holding on rising volume, bullish MACD
turn); destructive scores low (below falling MAs, lower lows, distribution volume,
overbought-and-rolling). **Freefall penalty (soft):** while price < SMA50 < SMA200 with
lower lows on non-improving volume, subtract 10-15 points from this sub-score — bad
timing is a fact — but do not cap the axis; a true base forming at the lows earns its
points back. A codified reference implementation lives in `src/backtest.ts`.

**Backtest evidence (29 BIST names, Nov 2023 → Apr 2026, 3,479 weekly point-in-time
observations; returns measured vs the same-date peer average to strip out the market):**
- Scores ≥65 outperformed peers by **+1.7%** over the next 63 trading days; scores <35
  lagged by **−2.3%** — a ~4-point spread. Mean cross-sectional IC ≈ **0.06** (modest but
  real). Weak scores WITHOUT a freefall flag were the worst cohort (−2.6% excess 63d).
- The freefall pattern underperformed (−1.4% excess 63d) — penalty confirmed.
- **Plain RSI<30 did NOT underperform** (60% 21-day hit rate, mildly positive excess):
  on BIST, oversold alone is mean-reverting. Penalize the freefall *pattern*, never
  oversold by itself.
- **Blowoff tops:** the highest technical scores on speculative small caps repeatedly
  marked local tops (TUCLK scored 86-91 in May-2024 → −24%..−31% over 63d; CANTE scored
  91 with RSI 74 in Nov-2025 → −17%). Hence a **parabolic-extension penalty (~10)** when
  price > ~35% above SMA50 with RSI > 60. Corollary: trust technical scores least on
  small caps — which is why technicals are only 30% of one axis and Quality caps the
  ceiling. (These two calibrations are in-sample fixes; validate them on the next
  quarterly re-run — `npm run backtest`.)

**Catalysts (0-100):** dated, concrete events only (earnings inflection quarter, contract
flow-through, capacity start-up, index review). Vague "might recover" = 50.

### Combine — multiplicative blend, price-weighted (the heart of v3.1)

```
FINAL_raw = 100 × (Q/100)^0.45 × (P/100)^0.55        ← price carries the larger exponent
FINAL     = FINAL_raw × R  + TapeAdjustment + PositioningTerm
```

**TapeAdjustment (±7) — the reflexivity term.** Price action is information in its own
right; a confirmed tape gets a direct, bounded nudge *after* the blend:
- **+7** when the move is confirmed constructive: TechnicalTiming ≥ 70, volume at or
  above its 20-day average, and NO parabolic-extension flag.
- **−7** when breakdown is confirmed: the freefall pattern is active.
- **0** otherwise. Never more than 7 either way — the tape gets a vote, not a veto.

**PositioningTerm (−5 … +10) — the real-VWAP term (v3.2).** Where does price sit versus
what holders actually *paid*, in today's lira? Take `realVwap.year1.zScore` from
`get_technicals` (inflation-adjusted VWAP, TÜFE-deflated, same construction as the
TradingView VWAP indicator: source hlc3, Σ(vol·price)/Σvol, volume-weighted σ bands).

| z (price vs real VWAP) | Term | Backtest excess return, 63d |
|---|---|---|
| ≤ −2 **and stabilizing** | **+10** | +0.08% (n=529) |
| ≤ −2, still falling | **+2** | −3.97% (n=158) |
| −2 … −0.5 | **−5** | **−3.15% (n=1139) — worst cohort in the study** |
| −0.5 … +1 | 0 | ~flat |
| +1 … +2 | **+5** | **+6.59% (n=520) — best cohort** |
| > +2 | 0 | +4.90% but decaying; parabolic penalty already applies |

**"Stabilizing"** means at least one of: price holding a ≥2-touch support (within 5%),
5-day average volume above the 20-day, or RSI turning up off a sub-32 reading. This is
the single sharpest discriminator the backtest found — identical cheapness, but the
confirmed half beat the unconfirmed half by **4 points of 63-day excess return**.

Why the shape is NOT "cheaper is always better": across the full range, mean IC of −z vs
63-day return was **−0.159**, i.e. expensive-vs-real-VWAP beat cheap. Only the extreme
tail (z ≤ −2) flips positive. Mild cheapness is where money was actually lost — it looks
tempting and has not capitulated. Reward the confirmed tail, penalise the danger zone.

Real VWAP is **price-derived, so it never enters Valuation** — using it as a fair-value
anchor would be circular. It is a positioning/flow measure and stays a bounded post-blend
adjustment, like the tape term. A reference implementation is `src/positioning.ts`.

Why geometric, not weighted-average: averages are compensatory (a 95 price score drags a
20-quality corpse to "Hold"); a product respects both axes continuously — **price moves
the number on every scan, and now moves it more than quality — but low quality still
compresses what price can buy.** A Q=80 name at a terrible price sits ~47 — Watch, not
Buy. No cliff edges anywhere: improve either axis a point, the score rises a little.

**Speculative ceiling (the surviving hard line):** if **Q < 45, FINAL is capped at 55**
(top of Hold). This is the "CANTE at ₺0.01" clause, v3.1 form: price action and deep
discounts can carry a weak business all the way to *interesting/speculative* — they can
never print *Buy* on it. Only the business improving can.

### Risk overlay `R` (0.55-1.00) — graduated deductions, not gates

Start at 1.00, subtract what applies (total deduction capped at 0.45):

| Risk | Deduction |
|---|---|
| Dilutive bedelli completed <12m or announced/pending | −0.05 small (<25%) · −0.10 moderate · −0.15 large (>40%) |
| Sustained losses / equity erosion | −0.05 one-off year · −0.10 multi-quarter · −0.15 accelerating |
| SPK tedbir / VBTS / Yakın İzleme Pazarı | −0.10 to −0.20 by severity |
| Going-concern audit qualification | −0.20 |
| Thin liquidity for intended size (guide: <₺20M median daily turnover) | −0.05 |
| Governance red flags (restatements, related-party leakage) | −0.05 to −0.15 |

(Report R and every deduction transparently; R multiplies FINAL_raw before the
TapeAdjustment is added.)

### Rating bands — stances with horizons, not commands

| FINAL | Stance |
|---|---|
| 75-100 | **Strong Buy** — quality and price aligned |
| 60-74 | **Buy / Accumulate** |
| 45-59 | **Hold / Neutral** — or "quality watchlist" when Q high but P low |
| 32-44 | **Speculative / Weak Hold** — only for risk-tolerant money, small size, long horizon; state exactly what must go right; **not an instruction to sell** |
| < 32 | **Unattractive / Reduce-into-strength** — if held, trimming on rallies is the measured path; never framed as "dump it now" |

For every score below 45, add a **"Recovery conditions"** line: the 2-3 concrete events
(profit inflection, dilution window passing, base/reclaim on volume) that would move it
up a band — and note honestly that without them, cheap can stay cheap (value-trap risk).

### Sanity checks the formula must always pass
- Loss-making, freshly-diluted company at ₺0.01: Q ~35, P can reach the 60s-70s on the
  discount → FINAL lands ~35-45 **speculative** (ceiling 55 regardless), never Buy.
  Cheapness registers — more than in v3 — but it still cannot redeem.
- The same weak company mid-pump with a confirmed tape: price + tape carry it to ~50-55,
  where the **speculative ceiling** stops it. Interesting trade, never a rated Buy.
- Great business (Q 80) after an overbought/parabolic run (P ~30, no tape bonus):
  ~45-47 → Hold/Watchlist, not Buy — good businesses at bad moments must wait.
- Great business on a boring pullback holding support with volume (P ~75, +7 tape):
  ~75-84 → Strong Buy. The tape term is what separates this from the previous case.

---

## Actionable levels

From `get_technicals`, for any stance of Speculative or better (for lower stances, give
levels only if the user holds the stock and frame them as trim/exit zones):
- **Entry / accumulate:** at or just above the nearest strong support (≥2 touches).
- **Stop:** below that support by ~1×ATR (state the ATR used).
- **Targets:** nearest resistance (T1), then next major resistance or 52-week high (T2).
- **Risk/reward** to T1 — flag when < 2:1.

---

## Required output format

```
📊 {SYMBOL} — {Company Name}
Price: ₺X.XX ({+/-}% today) · {session open/closed} · scan {YYYY-MM-DD}

QUALITY  Q = XX/100   (Health XX · Sector XX · Connections XX · News/Gov XX · Macro XX{, cap applied?})
PRICE    P = XX/100   (Valuation XX{−10/−20 IV honesty?} · Technicals XX{−freefall/−parabolic?} · Catalysts XX)
RISK     R = 0.XX     ({deductions listed, or "none"})   TAPE: {+7 confirmed | −7 freefall | 0}
POSITION {+10 | +2 | −5 | 0 | +5}  (real-VWAP z = X.XX, {bucket}; {stabilizing reasons or "no confirmation"})
FINAL = 100·(Q/100)^0.45·(P/100)^0.55·R {±tape} {±position} = XX/100 → {STANCE}   {ceiling 55 applied? · ⚠ low-confidence?}

Fair value (intrinsic): ₺{low} / ₺{base} / ₺{high} · method: {named} · IV trend: {stable/declining/burning}
→ {Undervalued|Fairly valued|Overvalued}{" — discount tempered: denominator shrinking" if applicable}

{Recovery conditions: … — required whenever FINAL < 45}
Levels: {entry/stop/T1/T2/R:R — or trim/exit zones if held & weak — or "watchlist: trigger = …"}

Bull case (2-3 bullets) / Bear case (2-3 bullets)
Verdict: 2-3 sentences — where it sits on the Q/P map, the horizon it suits, and the
exact events that would change the stance.
```

Multiple symbols → ranked table: symbol · Q · P · R · FINAL · stance · discount%.

---

## Rules of engagement

- **Scans never trade. Never.** A scan must not call `buy_asset` or `sell_asset` — not
  even for a stock rated Unattractive, not even if the user holds it. Ratings are
  information. Trading happens only on a separate, explicit user instruction naming
  symbol, side, and quantity — and the server's ₺5,000 per-order cap still applies.
- Facts (tool outputs, dated figures) vs judgment (scores) — keep them visibly distinct.
- Market closed → say so; technicals reflect the last session.
- If the user holds the stock (check `get_assets` when relevant), frame weak stances as
  position guidance ("trim into strength", "hold with conditions") — never as urgency.
- Missing data for 2+ blocks → flag **low confidence** and treat borderline stances as
  the more cautious neighbor.

---

*Engineering notes for this repo (server internals, tools, discovery scripts) live in
`README.md`. This file is strictly the analyst ruleset.*
