# BIST Scan Method — Quick Reference (v3.1)

> Compact summary of the scoring methodology. The full binding ruleset the scans follow
> is `CLAUDE.md`; this card is for checking the logic at a glance.

## Pipeline

```
gather 6 data blocks  →  score Q, P, R  →  FINAL = 100·(Q/100)^0.45·(P/100)^0.55·R ± Tape  →  stance
```

## 1. Data gathered every scan

| Block | Source | Feeds |
|---|---|---|
| Macro (TCMB rate, inflation, TRY, flows) | web, dated | Quality 10% |
| Sector (demand, regulation, FX exposure, vs XU100) | web | Quality 20% |
| Fundamentals — **Health** (margins, ROE, real growth, debt, cash) | web/KAP | Quality 45% |
| Fundamentals — **Valuation** (discount to intrinsic FV, peer multiples) | web + price | Price 45% |
| Connections (end-market trend, value chain, themes) | web | Quality 15% |
| News & governance (KAP, contracts, dilution, insiders) | web | Quality 10% + Risk; catalysts → Price 15% |
| Technicals (RSI, MAs, MACD, ATR, S/R, volume, 52w) | `get_technicals` tool | Price 40% |

## 2. The three scores

**QUALITY — "is the business worth owning?"** (valuation excluded)

```
Q = 0.45·Health + 0.20·Sector + 0.15·Connections + 0.10·News + 0.10·Macro
    capped at Health + 20      (environment can't carry a sick company)
```

**PRICE — "are the price and moment attractive?"** (the majority axis)

```
P = 0.45·Valuation + 0.40·Technicals + 0.15·Catalysts
```

- Valuation = discount to **intrinsic** fair value only (peer F/K × normalized EPS,
  justified PD/DD × book, FD/FAVÖK; haircut book for loss-makers). Never derived from
  support/resistance — that would be circular. Honesty deduction when intrinsic value is
  declining (−10) or burning (−20).
- Technicals codified in `src/backtest.ts`: freefall penalty −13, parabolic-extension
  penalty −10, **no penalty for oversold alone** (backtest: RSI<30 was mildly positive
  on BIST).

**RISK — graduated deductions, no kill-switches** (R = 1.00 down to 0.55)

Bedelli <12m: −0.05…−0.15 · sustained losses: −0.05…−0.15 · SPK/VBTS: −0.10…−0.20 ·
going-concern: −0.20 · thin liquidity: −0.05 · governance: −0.05…−0.15

## 3. The formula

```
FINAL = 100 × (Q/100)^0.45 × (P/100)^0.55 × R  + TapeAdjustment
```

- **TapeAdjustment (reflexivity term):** +7 when the move is confirmed (technical score
  ≥ 70, volume ≥ 20-day average, not parabolic) · −7 when freefall is active · else 0.
- **Speculative ceiling:** Q < 45 → FINAL capped at **55**. Price and flows can make a
  weak name *interesting* — never a rated *Buy*.

## 4. Stances

| FINAL | Stance |
|---|---|
| 75–100 | Strong Buy |
| 60–74 | Buy / Accumulate |
| 45–59 | Hold / Neutral |
| 32–44 | Speculative / Weak Hold (+ mandatory recovery conditions) |
| < 32 | Unattractive / reduce-into-strength — never a sell command |

Every scan also outputs: intrinsic fair-value band (low/base/high), entry, ATR-based
stop, T1/T2 targets, risk/reward, bull & bear cases.

## 5. Standing rules

- **Scans never place orders.** Trading only on a separate explicit instruction;
  the server's ₺5,000/order cap always applies.
- Every figure dated; growth inflation-adjusted; missing data → neutral 50 +
  low-confidence flag.
- Backtest evidence (29 names, Nov 2023 → Apr 2026, 3,479 point-in-time observations):
  technical scores ≥65 beat same-date peers by **+1.7%** over 63 trading days; scores
  <35 lagged by **−2.3%**; mean cross-sectional IC ≈ **0.06**. Freefall pattern
  underperformed (−1.4%); plain oversold did not. The two calibrations (oversold
  de-penalized, parabolic penalty) are in-sample — re-validate quarterly with
  `npm run backtest`.

**Philosophy in one line:** price is the majority partner (reflexivity — and it is the
only backtest-validated edge), but quality multiplies, so what price can buy is capped
by what the business is.

## Version history

- **v1** — weighted average of six blocks. Flaw: compensatory (cheapness rescued
  broken businesses).
- **v2** — hard gates + quality/entry matrix. Flaw: binary kill-switches ignored price
  entirely.
- **v3** — continuous multiplicative blend Q^0.55·P^0.45 with graduated risk overlay.
- **v3.1 (current)** — price made the majority axis (Q^0.45·P^0.55), technicals raised
  to 40% of P, ±7 tape-confirmation term, speculative ceiling (Q<45 → FINAL ≤ 55);
  backtest-calibrated technical penalties.
