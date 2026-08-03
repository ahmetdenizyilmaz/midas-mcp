📊 DMLKT.G — Damla Kent Projesi Gayrimenkul Sertifikası (Emlak Konut GYO / TOKİ)
Price: ₺6.01 (+0.17% today) · session CLOSED (weekend; technicals reflect Friday 2026-07-31 close) · scan 2026-08-02

> ⚠️ **INSTRUMENT FLAG — READ FIRST. This is NOT a share.**
> The symbol carries the **".G" suffix**, i.e. a non-ordinary-share quotation. For DMLKT the
> ".G" denotes the **Gayrimenkul Sertifikası (real-estate certificate)** instrument class: it
> trades on BIST's **Yapılandırılmış Ürünler ve Fon Pazarı** (Structured Products & Funds
> Market), not the equity market. Consequences, all material:
> - **No shareholder rights, no dividends, no yield of any kind** — a pure zero-carry claim.
> - **F/K, PD/DD, FD/FAVÖK, ROE, net debt/FAVÖK do not exist for this instrument** and are
>   marked **N/A** throughout (scored at neutral where the ruleset requires it). Any site
>   quoting such ratios for DMLKT is mapping issuer data onto a certificate — do not use it.
> - Non-standard settlement, wider spreads and shallower depth than an ordinary share.
> - This flag is reflected in the risk overlay (**−0.10**, see RISK below).
> Whether the ".G" is read as the certificate-class marker (which it is here) or as the generic
> fictive/special-quotation marker, the treatment is identical: ordinary equity analysis is void.

> ⚠️ **LOW CONFIDENCE.** Two-plus data blocks are structurally or practically unavailable:
> (i) conventional company fundamentals do not exist for a certificate; (ii) KAP disclosure
> retrieval for DMLKT failed on every direct attempt and there is **zero sell-side coverage**
> of the instrument; (iii) the **itfa (cash-redemption) valuation methodology could not be
> verified from the primary prospectus** — a first-order gap for fair value; (iv) the
> positioning engine returned *insufficient history*. Treat every score below as a
> judgement built on a thin, dated evidence base.

---

QUALITY  Q = 47/100   (Health 48 · Sector 38 · Connections 45 · News/Gov 52 · Macro 58 — Health+20 cap = 68, **not binding**)
PRICE    P = 49/100   (Valuation 57 **−10 IV honesty** = 47 · Technicals 48, **no freefall / no parabolic penalty** · Catalysts 55)
RISK     R = 0.85     (instrument-class / ".G" special-quotation & structured-market listing −0.10 · disclosure-opacity & unverifiable redemption mechanics −0.05 · **no liquidity deduction — turnover test passed** · no dilution · no going-concern · no VBTS/tedbir found)   TAPE: **0**
POSITION **0**  (real-VWAP z = **N/A**, bucket = **"insufficient history"**; `_positioning.json` returns `{"error":"insufficient history","term":0}` — the certificate has only 242 bars since its 2025-08-14 listing. **No stabilizing reasons computed.** Transparency note: the raw technicals snapshot *does* carry a year-1 realVwap of ₺7.5761, z = −1.3733, premium −20.67%, volumeAbovePrice 99.87% — which would map to the −5 "mild weakness / danger zone" bucket — but per ruleset the positioning file's term governs, and it declares the history insufficient. The term applied is **0**, i.e. no positioning edge claimed either way.)

FINAL = 100·(0.4695)^0.45·(0.4860)^0.55 · 0.85 ± 0 ± 0
      = 100 × 0.7115 × 0.6725 = **47.85** (raw)
      = 47.85 × 0.85 = **40.67**
      + tape 0 + position 0 = **40.7 / 100 → SPECULATIVE / WEAK HOLD**
      (speculative ceiling **NOT applied** — Q = 47.0 clears the Q<45 line, but only by 2 points · ⚠ **low-confidence**)

---

## Arithmetic, shown in full

**Quality**
```
Q_raw = 0.45(48) + 0.20(38) + 0.15(45) + 0.10(52) + 0.10(58)
      = 21.60   + 7.60     + 6.75     + 5.20     + 5.80   = 46.95
cap   = Health + 20 = 48 + 20 = 68  →  min(46.95, 68) = 46.95   (cap not binding)
Q = 46.95 ≈ 47
```

**Price**
```
Valuation 57 − 10 (IV declining: underlying losing real value, zero carry) = 47
P = 0.45(47) + 0.40(48) + 0.15(55)
  = 21.15    + 19.20    + 8.25   = 48.60 ≈ 49
```

**Risk**
```
R = 1.00 − 0.10 (.G / structured-product class) − 0.05 (disclosure opacity) = 0.85
```

**Blend**
```
ln(0.4695)×0.45 = −0.34020
ln(0.4860)×0.55 = −0.39683
sum = −0.73703 → exp = 0.47850 → FINAL_raw = 47.85
FINAL = 47.85 × 0.85 + 0 + 0 = 40.67
```

---

## Fair value

**Fair value (intrinsic): ₺5.40 (low) / ₺6.70 (base) / ₺8.30 (high)**
**Method:** *implied ₺/m² of the underlying Damla Kent units, index-rolled and delivery-discounted.* Support/resistance played **no** part (price-derived = circular).

| Step | Figure | Source / date |
|---|---|---|
| IPO price | **₺7.59/lot**, demand 2025-08-04→08, listed 2025-08-14 | halkarz / prospectus summary |
| Certificates per unit | 1+1 62m²: 631,516 · 2+1 88m²: 863,276 · 3+1 144m²: 1,384,916 · 4+1 194m²: 1,833,345 | prospectus summary |
| IPO-implied ₺/m² | ₺71,779 (4+1) → ₺77,306 (1+1); blend ≈ **₺74,000/m²** | derived, Aug 2025 |
| Stated IPO discount to appraisal | **24.1%** → appraisal-implied ≈ ₺97,500/m² | issue documentation, Aug 2025 |
| Housing index roll-forward (Aug-25 → Jun-26, ~11m of a +24.5% YoY move ≈ +22%) | ₺74,000 × 1.22 ≈ **₺90,300/m²** | **TCMB Konut Fiyat Endeksi, June 2026: nominal +24.5% YoY, real −5.8% YoY** |
| Price today implies | ₺6.01 / ₺7.59 = 0.7918 → ₺56,832–₺61,213/m², blend ≈ **₺58,600/m²** | derived, 2026-07-31 |

Discounting to the **2029-02-09** delivery (≈2.53 years, **zero cash flow in between**):
- required TL nominal return ≈ 32% net (policy rate **37.0%**, held July 2026) vs housing appreciating ≈ 25% nominal → net drag `(1.25/1.32)^2.53 ≈ 0.87`
- execution / schedule-slippage / illiquidity haircut ≈ 0.90
- real-price-erosion haircut (KFE real −5.8% YoY implies housing undershoots inflation) ≈ 0.92

`₺90,300 × 0.87 × 0.90 × 0.92 ≈ ₺65,100/m²` → certificate base FV = `6.01 × (65,100 / 58,600)` ≈ **₺6.70**
- **Low ₺5.40** — real house prices keep eroding 6-8% p.a., TCMB stays on hold, delivery slips 6-12 months (extra ~20% haircut).
- **High ₺8.30** — TCMB eases into 2027 (survey 12-mo-ahead TÜFE **23.95%**, July 2026), mortgages reopen, delivery on time, part of the 24.1% appraisal discount is recognised.

`Discount% = (6.70 − 6.01) / 6.70 =` **+10.3%**

**IV trend: DECLINING.** → **Modestly undervalued — but the discount is tempered: the denominator is losing real value** (TCMB KFE **real −5.8% YoY, June 2026**) **and the instrument pays nothing at all while you wait against a 37% policy rate.** A ~10% discount does not compensate for 2.5 years of zero carry; that arithmetic, not sentiment, is why the certificate sits 20.8% below its issue price.

---

## Recovery conditions *(required: FINAL 40.7 < 45)*

1. **A TCMB cutting cycle that actually resumes.** The 37.0% policy rate held in July 2026 is the single largest weight on this instrument — it sets both the opportunity cost of a zero-carry holding and the mortgage rate that clears the underlying flats. A visible move toward the 23.95% 12-month TÜFE expectation, with mortgage volumes turning, is the dominant re-rating lever.
2. **Real house prices stop falling.** TCMB KFE must print a non-negative real YoY (currently **−5.8%, June 2026**). Until then the underlying asset — and therefore the certificate's whole intrinsic case — is shrinking faster than the discount widens.
3. **A reclaim of ₺6.05 (5 touches) and then ₺6.215 on volume above the 20-day average**, ideally accompanied by visible **asli edinim** conversion demand absorbing supply. That would convert the current 12-touch base at ₺5.78 from "support that keeps being tested" into a genuine floor.
4. **Verifiable construction progress toward the 2029-02-09 delivery** via KAP, plus published itfa (cash-redemption) valuation mechanics — which would remove the largest analytical unknown in this scan.

**Honest counterweight:** absent 1 and 2, cheap can stay cheap for a very long time here. The classic value-trap shape is worse than usual for this instrument, because **time itself is a cost** — a share can wait for free; a zero-carry certificate bleeds opportunity cost every single day it waits. ~₺21bn was placed with **726,719 retail investors** at ₺7.59; that underwater base is persistent overhead supply on every rally.

---

## Levels — *position guidance (you hold this), not instructions*

**ATR14 = ₺0.0314 (0.52% of price) · annualized volatility 5.52%.** This is the defining technical fact: the certificate behaves far more like a bond than an equity. Ordinary stop discipline barely applies — a 1×ATR stop is a 0.5% move.

| Level | Price | Note |
|---|---|---|
| Core support | **₺5.78** | **12 touches** — the single most-tested line on the chart |
| Structural exit reference | **₺5.60** | 52-week low; a *weekly close* below it, not an intraday tick, is the meaningful break |
| Mechanical stop (1×ATR under support) | ₺5.75 | stated for completeness; impractically tight at 0.52% ATR |
| Accumulate zone (risk-tolerant money, small size only) | **₺5.78 – ₺5.85** | at the 12-touch base |
| T1 | **₺6.05** | 5 touches |
| T2 | **₺6.215** | 2 touches; then ₺6.61 (1 touch), 52w high ₺7.75 |

- **R:R from here (₺6.01) to T1 ₺6.05 against ₺5.75 = 0.04 / 0.26 = 0.15:1 — ⚠️ catastrophically below 2:1. Do not add at ₺6.01.**
- R:R from the ₺5.80 base to T2 ₺6.215 against ₺5.60 = 0.415 / 0.20 = **2.1:1 — acceptable**, and the only sensible place to add if you choose to.
- **Trim-into-strength zones for the existing holding: ₺6.20 – ₺6.25, then ₺6.55 – ₺6.65.** This is a measured way to right-size a zero-carry, 2.5-year-duration position on rallies — **not urgency, and not a sell instruction.** If the position is small relative to your portfolio, holding to the asli-edinim/delivery mechanics is entirely defensible.

---

## Technical read (facts, from the 2026-07-31 snapshot)

- Price ₺6.01 · SMA20 6.0315 · SMA50 6.0638 · SMA200 5.9506 → price below SMA20 and SMA50, **+1.0% above SMA200**.
- **`goldenCross: true` — SMA50 (6.0638) > SMA200 (5.9506).** The freefall precondition `price < SMA50 < SMA200` is therefore **NOT met → no freefall penalty, and TAPE ≠ −7.**
- Parabolic-extension test: price is **−0.89% vs SMA50** and RSI is **42.82** — nowhere near the ">35% above SMA50 with RSI>60" trigger → **no parabolic penalty**.
- RSI(14) 42.82, neutral zone — **not** oversold, so the "RSI<30 mean-reverts on BIST" backtest finding does not apply here either way.
- MACD −0.0166 vs signal −0.0163, histogram −0.0003 → nominally *bearish crossover*, but the magnitude is 0.005% of price: statistically indistinguishable from flat.
- ROC20 −1.64%. Bollinger 5.9812 / 6.0315 / 6.0818 — band width **1.67% of price**, an extremely compressed range; price in the lower half.
- 52-week: high ₺7.75, low ₺5.60 → **−22.45% from the high, +7.32% off the low**. A long, shallow post-listing drift, not a collapse.
- Volume 5,692,021 vs 20-day average 5,542,984 = **+2.69%** — at average, not confirming anything. **TechnicalTiming 48 = neutral consolidation**, and **TAPE = 0** (the +7 requires Technicals ≥70).
- Real-price context from the snapshot: nominal 1-year change **−19.44%**, **real 1-year change −37.46%** (real price one year ago ₺9.61).

---

## Bull case

- **State-grade completion risk, which is rare at this end of the market.** The issuer is **Emlak Konut GYO** (Turkey's largest listed REIT, TOKİ-controlled), the land is **TOKİ's**, and TOKİ is named in the guarantor role. There is no dilution mechanism, no leverage at the certificate level, no equity to erode and no going-concern question — the failure modes that usually destroy BIST small caps are structurally absent here.
- **A live, dated conversion mechanism sets a real economic floor.** The **asli edinim** window opened **2025-11-26** (pulled *forward* from the originally scheduled 2026-02-12 — a genuinely holder-friendly amendment) and accepts requests to **2028-08-11**, with modification to 2029-07-10. At ₺6.01 the certificate implies ~**₺57k-61k/m²** for new-build Başakşehir/Kayabaşı stock; the further that falls below the real cost of buying a comparable flat, the more rational it becomes for unit-seekers to buy certificates and convert — absorbing supply.
- **Genuine inflation-linkage plus a compressed, well-defended base.** The claim is on physical housing, so it participates in TRY debasement structurally; and the tape is quiet and orderly — a **12-touch support at ₺5.78**, 5.5% annualized volatility, price above SMA200 with SMA50 > SMA200. If TCMB resumes cutting toward the 23.95% 12-month expectation, both the mortgage market and this instrument's opportunity cost improve at the same time.

## Bear case

- **Zero carry against a 37% policy rate is the whole story.** You hold a non-yielding claim for **~2.5 years to the 2029-02-09 delivery** while TL deposits pay ~35-40% nominal and real rates run **+8 to +13 points** positive. Compounded, that opportunity cost dwarfs the ~10% discount to base fair value. This is a structural headwind, not a sentiment one, and it does not lift until the easing cycle restarts.
- **The underlying asset is losing real value and faces state-supplied substitutes.** **TCMB KFE, June 2026: nominal +24.5% YoY but real −5.8% YoY.** Worse, TOKİ's mass social-housing programme delivers directly competing stock **in the same Başakşehir/Kayabaşı corridor** at subsidised prices — the substitute is the same entity that owns the land under this project. Issuer momentum is also poor: **Emlak Konut Q1 2026 net profit ₺1.26bn, −70% YoY** (vs ₺4.26bn Q1 2025, and below the ~₺2.8bn consensus), i.e. roughly **−77% in real terms**; the FY2026 ₺13.1bn target looks a stretch.
- **Structural opacity plus a large underwater retail float.** No analyst coverage, no retrievable KAP flow, **unverified itfa valuation mechanics**, non-standard settlement on the structured-products market, and a positioning engine that cannot even compute a z-score for lack of history. Against that, ~**₺21bn was placed with 726,719 retail holders at ₺7.59** — now ~21% underwater nominally and ~37% in real terms — which is persistent overhead supply into every rally, and the 30-day price-stabilisation facility expired long ago.

---

## Verdict

DMLKT.G sits almost exactly in the middle of the Q/P map — **Q 47, P 49** — which is the honest signature of an instrument that is neither broken nor attractive: state-guaranteed delivery and a genuine ~10% discount to intrinsic on one side, a shrinking real underlying and a punishing 37% opportunity cost on the other. The multiplicative blend puts it at 47.9 before risk; the **0.85 overlay for its non-equity ".G" structured-product status and unverifiable redemption mechanics** is what pushes it to **40.7 — Speculative / Weak Hold**. Note how close the call was: at **Q 47.0** it cleared the Q<45 speculative ceiling by two points, and a single notch worse on Health or Sector would have capped it outright.

The horizon this suits is **long and patient — 2.5 years to the February 2029 delivery, with money you will not need in between** — and it suits it only at a **small position size**, because the risk here is not a crash (5.5% annualized volatility, a 12-touch floor at ₺5.78) but *dead money*: a claim that pays nothing while deposits pay 37%. **Since you already hold it, the measured path is to hold with conditions rather than act on this scan** — do not add at ₺6.01 (R:R to T1 is 0.15:1), consider trimming into the ₺6.20-6.25 and ₺6.55-6.65 zones only if the position is oversized for a zero-carry 2029 horizon, and treat a *weekly* close below ₺5.60 as the structural review trigger.

**What would change the stance:** upgrade to Hold/Neutral on (a) TCMB resuming cuts with mortgage volumes turning, plus (b) a non-negative real print in the TCMB Konut Fiyat Endeksi, plus (c) a reclaim of ₺6.05 → ₺6.215 on above-average volume. Downgrade toward Unattractive on a confirmed loss of the ₺5.78 twelve-touch base on rising volume, on any disclosed slippage in the 2029-02-09 delivery date, or on a further leg down in real house prices.

---

*Scan performed under CLAUDE.md v3.2. Read-only analysis — no orders were placed or contemplated. Macro block fixed at 58 per `scans/_macro.md`; positioning term fixed at 0 per `scans/_positioning.json`; technicals per `scans/_technicals/DMLKT.G.json` (asOf 2026-07-31).*

**Sources:** [halkarz — DMLKT Damla Kent Projesi Gayrimenkul Sertifikası](https://halkarz.com/damla-kent-projesi-gayrimenkul-sertifikasi/) · [Emlak Konut GYO](https://www.emlakkonut.com.tr/) · [Damla Kent proje sitesi](https://damlakent.emlakkonut.com.tr/) · [TCMB — Konut Fiyat Endeksi](https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Reel+Sektor+Istatistikleri/Konut+Fiyat+Endeksi) · [KAP](https://www.kap.org.tr/)
