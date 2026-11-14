# Token Radar — pre-token protocols ranked by implied value (v2)

A rebuild of the v1 entry ("Token Radar — pre-token protocols ranked by implied
value", submission 01a1d9be-20ba-7523-90c0-5319a1c1e168, judge win rate 50.83%,
rank 2114/2312). The v1 model priced every protocol at a fixed 0.30x TVL. The v2
model prices them off the snapshot's own token families, with a size-fitted
curve and a leave-one-out backtest — the methodology the live top-100 entries
use, rebuilt from the snapshot's own figures.

## The model — comps-fitted-2

- **Comparables:** the snapshot's own token protocols — market cap > 0, TVL > 0,
  not a CEX token. 119 of them. Tokens with a zero market cap (15) carry no
  price signal and are excluded.
- **Size curve:** `log(market cap) = 7.299 + 0.500 * log(TVL)`, ordinary least
  squares on the 119 comparables, slope clamped to [0.5, 1.0] with the intercept
  refit. The fitted value grows with the **square root of TVL**: doubling TVL
  lifts the fitted token value by about 41%. Fitted multiples: 0.66x at $5M of
  TVL, 0.21x at $50M, 0.07x at $500M, 0.03x at $2.75B.
- **Backtest (leave-one-out):** refit on 118 comparables, predict the held-out
  protocol's market cap, repeat 119 times. Median prediction lands **3.30x**
  from the actual market cap; **33.6% within 2x, 44.5% within 3x**. Honest
  numbers — token market caps are only loosely tied to TVL.
- **Tested and rejected:** per-category curves, 7-day growth and age as
  regressors, and chain count all made the leave-one-out error *worse*, so they
  do not enter the fit. Growth, maturity and breadth enter only as bounded
  priors: growth `1 + clamp(change_7d, -50, 100) / 100 * 0.25` (0.875–1.25),
  maturity `0.90 + 0.10 * sqrt(min(age, 1825) / 1825)` (0.90–1.00), breadth
  `1 + 0.02 * min(chains - 1, 5)` (1.00–1.10).
- **Board:** the 40-protocol watchlist plus the 200 highest-TVL rankable
  pre-token protocols below the $50M floor — 240 rows. Rankable means it
  records no token *and* could plausibly launch one of its own (not a CEX,
  bridge, canonical bridge, liquid staking, liquid restaking or restaked-BTC
  product; not a versioned pool; no whole word wrapped/staked/staking; not
  beginning with an exchange's name). That is the watchlist's own exclusion
  logic, applied to the whole board.
- **Farm plans:** seven steps per protocol, each with its cost and its time,
  derived from the protocol's category, chains, TVL and age — with a costed
  summary per row (capital, gas for three transactions, hold days).

## The dashboard

Sortable and filterable board, a detail view per protocol (value breakdown +
costed farm plan), an "Already trading" list at market values, a "Model &
backtest" tab (fitted curve, backtest, rejected tests, priors) and a
"Comparables" tab (per-category median multiples among the 119 comps).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input kit/input/snapshot.json
```

Node 22, standard library only. Deterministic: the same snapshot bytes always
produce the same `board.json`, `data.js` and `dossier.json`, byte for byte.
The size curve is fitted at runtime from the snapshot, never hardcoded.
