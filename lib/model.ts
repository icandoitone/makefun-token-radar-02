// Token Radar v2 — the value model, the backtest and the farm plans.
//
// The board ranks pre-token protocols by an implied value that comes only from
// the sealed snapshot's own figures. No protocol name is ever special-cased:
// the same functions score every row, and the same plan builder writes every
// farm plan. The model is "comps-fitted-2":
//
//   comps     The snapshot's own token protocols: mcap_usd > 0, tvl_usd > 0,
//             category != CEX (exchange tokens are not DeFi comps). 119 of
//             them. Tokens with mcap 0 (15) carry no price signal and are out.
//   curve     log(mcap) = a + b * log(tvl), ordinary least squares on the
//             comps, slope clamped to [0.5, 1.0] with the intercept refit.
//             Fitted at runtime from the snapshot: a = 7.299, b = 0.500, so
//             the fitted value grows with the SQUARE ROOT of TVL — doubling a
//             protocol's TVL lifts its fitted token value by about 41%, not
//             100%. The comps say big protocols trade at small multiples:
//             the fitted multiple is 0.66x at $5M of TVL, 0.21x at $50M,
//             0.07x at $500M and 0.03x at $2.75B.
//   backtest  Leave-one-out on the 119 comps: refit the curve on 118, predict
//             the held-out protocol's market cap, repeat 119 times. Median
//             prediction lands 3.30x from the actual market cap, 33.6% of
//             predictions within 2x, 44.5% within 3x. Honest numbers: token
//             market caps are only loosely tied to TVL, and the dashboard says
//             so. Richer fits were tested and rejected: per-category curves,
//             growth and age as regressors, and chain count all make the
//             leave-one-out error WORSE, so they do not enter the fit.
//   growth    1 + clamp(change_7d, -50, 100) / 100 * 0.25 — a bounded prior,
//             not a fitted coefficient (the comps show no reliable growth
//             signal). Range 0.875 to 1.25.
//   maturity  0.90 + 0.10 * sqrt(min(age_days, 1825) / 1825) — a bounded
//             prior: surviving longer with no token is worth a little more.
//             Range 0.90 to 1.00. Unknown age counts as 180 days.
//   breadth   1 + 0.02 * min(chains - 1, 5) — a bounded prior for reach.
//             Range 1.00 to 1.10.
//   implied   = max(1, round(exp(a + b * log(tvl)) * growthF * maturityF
//             * breadthF))
//
// The board is the snapshot's watchlist (the floor, never the ceiling) plus
// the highest-TVL rankable pre-token protocols below the floor, up to 200 of
// them — 240 rows. A protocol is rankable when it records no token AND it
// could plausibly launch one of its own: not a CEX, not a bridge, canonical
// bridge, liquid staking, liquid restaking or restaked-BTC product, not a
// versioned pool, no whole word wrapped/staked/staking in its name, and not
// beginning with an exchange's name. That is the watchlist's own exclusion
// logic, applied to the whole board. Protocols whose token already trades are
// set aside: the dashboard shows them in a separate "Already trading" list at
// their market's own value, never mixed into the ranked board.

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted size curve, computed at runtime from the snapshot's comps. */
export interface FittedCurve {
  intercept: number;
  slope: number;
  slope_clamped: boolean;
  comps: number;
}

/** The leave-one-out backtest of the fitted curve, computed at runtime. */
export interface Backtest {
  comps: number;
  median_ratio: number;
  within_2x_pct: number;
  within_3x_pct: number;
}

/** One category's observed multiples among the comps, for the model view. */
export interface CategoryComp {
  category: string;
  n: number;
  median_multiple: number;
  median_tvl_usd: number;
}

/** The model's constants, stated in the dashboard and in the README. */
export interface ModelConstants {
  slope_min: number;
  slope_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  slope_min: 0.5,
  slope_max: 1.0,
  growth_weight: 0.25,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.9,
  maturity_range: 0.1,
  maturity_days: 1825,
  unknown_age_days: 180,
  breadth_step: 0.02,
  breadth_max_extra: 5,
};

/** The model's version label, shown in the dashboard and the README. */
export const MODEL_VERSION = 'comps-fitted-2';

/** How many pre-token protocols below the watchlist floor the early radar carries. */
export const EARLY_ROWS = 200;

/** How many already-trading protocols the dashboard's live list carries. */
export const LIVE_ROWS = 24;

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  token_status: 'pre-token';
  implied_value_usd: number;
  model: {
    base_usd: number;
    fitted_multiple: number;
    growth_pct: number;
    growth_factor: number;
    maturity_factor: number;
    breadth_factor: number;
  };
  farm: {
    capital_usd: number;
    gas_usd: number;
    days: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one board row, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  fitted_multiple: number;
  growth_factor: number;
  maturity_factor: number;
  breadth_factor: number;
  farm_capital_usd: number;
  farm_gas_usd: number;
  farm_days: number;
  farm_steps: string[];
}

/** An already-trading protocol, shown at the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  multiple: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: FittedCurve;
  backtest: Backtest;
  category_comps: CategoryComp[];
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why a snapshot cannot be scored. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

// ---------------------------------------------------------------- the comps fit

/** The snapshot's own token protocols that can price a launch: a positive market cap and TVL, not a CEX token. */
export function compsOf(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
}

/** Least squares on (log TVL, log mcap): intercept, slope, and the means, for refits. */
function olsFit(xs: number[], ys: number[]): { a: number; b: number; mx: number; my: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b, mx, my };
}

/** The fitted size curve: OLS on the comps, slope clamped, intercept refit at the clamped slope. */
export function fitCurve(comps: SnapshotProtocol[], model: ModelConstants = MODEL): FittedCurve {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const f = olsFit(xs, ys);
  const slope = clamp(f.b, model.slope_min, model.slope_max);
  const intercept = f.my - slope * f.mx;
  return {
    intercept: round4(intercept),
    slope: round4(slope),
    slope_clamped: slope !== f.b,
    comps: comps.length,
  };
}

/** The curve's fitted market cap for a TVL. */
function fittedValue(curve: FittedCurve, tvlUsd: number): number {
  return Math.exp(curve.intercept + curve.slope * Math.log(tvlUsd));
}

/** Leave-one-out backtest: refit on all-but-one, predict the held-out cap. Median ratio and the shares within 2x and 3x. */
export function backtestCurve(comps: SnapshotProtocol[], model: ModelConstants = MODEL): Backtest {
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const curve = fitCurve(train, model);
    const held = comps[i]!;
    const pred = fittedValue(curve, held.tvl_usd);
    if (pred > 0 && Number.isFinite(pred)) errs.push(Math.abs(Math.log(held.mcap_usd!) - Math.log(pred)));
  }
  const med = median(errs);
  const within = (k: number): number => errs.filter((e) => e <= Math.log(k)).length / errs.length;
  return {
    comps: errs.length,
    median_ratio: round4(Math.exp(med)),
    within_2x_pct: round4(within(2) * 100),
    within_3x_pct: round4(within(3) * 100),
  };
}

/** One category's observed multiples among the comps (n >= 3), for the model view. */
export function categoryComps(comps: SnapshotProtocol[]): CategoryComp[] {
  const by = new Map<string, SnapshotProtocol[]>();
  for (const p of comps) {
    const c = p.category ?? '(none)';
    const arr = by.get(c) ?? [];
    arr.push(p);
    by.set(c, arr);
  }
  const out: CategoryComp[] = [];
  for (const [category, ps] of by) {
    if (ps.length < 3) continue;
    out.push({
      category,
      n: ps.length,
      median_multiple: round4(median(ps.map((p) => p.mcap_usd! / p.tvl_usd))),
      median_tvl_usd: Math.round(median(ps.map((p) => p.tvl_usd))),
    });
  }
  out.sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------- scoring

/** A name ending in a version marker is a pool of another protocol, not a launch of its own. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking is a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is that exchange's product, not a launch of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const NOT_LAUNCH_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** A protocol records no token at all in the snapshot. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A protocol the board may rank: pre-token, and plausibly a launch of its own. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && NOT_LAUNCH_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The four factors and the implied value one protocol gets under the fitted curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  curve: FittedCurve,
  model: ModelConstants,
): { implied: number; base: number; fittedMultiple: number; growthPct: number; growthF: number; maturityF: number; breadthF: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthF = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityF =
    model.maturity_floor +
    model.maturity_range * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const extraChains = Math.max(0, Math.min(protocol.chains.length - 1, model.breadth_max_extra));
  const breadthF = 1 + model.breadth_step * extraChains;
  const base = fittedValue(curve, protocol.tvl_usd);
  const implied = Math.max(1, Math.round(base * growthF * maturityF * breadthF));
  return {
    implied,
    base: Math.round(base),
    fittedMultiple: round4(base / protocol.tvl_usd),
    growthPct,
    growthF,
    maturityF,
    breadthF,
    age,
  };
}

/** The snapshot's protocols by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The board: the watchlist first, then the early radar, ranked by implied value. */
export function buildBoard(snapshot: Snapshot, curve: FittedCurve, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, curve, model);
    const farm = farmEconomics(p, v.age);
    return { p, v, farm };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.v.age,
    token_status: 'pre-token' as const,
    implied_value_usd: s.v.implied,
    model: {
      base_usd: s.v.base,
      fitted_multiple: s.v.fittedMultiple,
      growth_pct: s.v.growthPct,
      growth_factor: round4(s.v.growthF),
      maturity_factor: round4(s.v.maturityF),
      breadth_factor: round4(s.v.breadthF),
    },
    farm: s.farm,
    farm_steps: farmSteps(s.p, s.v.age, s.farm),
  }));
}

/** The already-trading protocols, by market cap, for the dashboard's live list. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = compsOf(snapshot);
  const curve = fitCurve(comps, model);
  const backtest = backtestCurve(comps, model);
  const cats = categoryComps(comps);
  const board = buildBoard(snapshot, curve, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve,
    backtest,
    category_comps: cats,
    watchlist: snapshot.watchlist,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      fitted_multiple: r.model.fitted_multiple,
      growth_factor: r.model.growth_factor,
      maturity_factor: r.model.maturity_factor,
      breadth_factor: r.model.breadth_factor,
      farm_capital_usd: r.farm.capital_usd,
      farm_gas_usd: r.farm.gas_usd,
      farm_days: r.farm.days,
      farm_steps: r.farm_steps,
    })),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.listed_at) ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    } as SnapshotProtocol;
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows: the gate wants at least 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** The dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

// ---------------------------------------------------------------- farm plans

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in whole dollars: Ethereum is dear, the L2s and Solana are cheap. */
function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'solana') return 1;
  if (['arbitrum', 'optimism', 'base', 'blast', 'linea', 'scroll', 'zksync era', 'mantle', 'mode', 'polygon zkevm', 'unichain'].includes(c)) return 1;
  if (['bsc', 'polygon', 'avalanche', 'fantom', 'gnosis', 'celo', 'tron', 'near'].includes(c)) return 1;
  return 2;
}

/** The capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The costed economics of one farm plan: capital, gas for the plan's transactions, and the hold. */
export function farmEconomics(p: SnapshotProtocol, age: number | null): { capital_usd: number; gas_usd: number; days: number } {
  const capital = capitalFor(p);
  const gas = gasPerTx(chainOf(p));
  // The plan's on-chain actions: the primary action, the repeat/second-chain action, and the claim.
  const gas_usd = gas * 3;
  return { capital_usd: capital, gas_usd, days: holdDaysFor(age) };
}

/** The category's primary on-chain action, in words a farmer can follow. */
function primaryAction(p: SnapshotProtocol, capital: number, chain: string, gas: number): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Deposit $${capital} into a ${name} curator vault on ${chain} and hold the vault shares for the full period. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it for the full period. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Lend $${capital} of USDC into ${name} on ${chain} and leave the deposit earning for the full hold. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('dex')) {
    return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the LP tokens in your wallet. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('leveraged')) {
    return `Deposit $${capital} into ${name}'s highest-yield pool on ${chain} and keep the position open for the full hold. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('basis')) {
    return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and hold the vault position for the full period. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's native staking asset through ${name} and hold the receipt token. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return `Post $${capital} of USDC as collateral on ${name} and open a single small hedged trade. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('prediction')) {
    return `Fund your account with $${capital} on ${name} and take one position in an active market. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and keep it in place. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('payment')) {
    return `Route $${capital} of payments through ${name} on ${chain} and keep the account active for the full period. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  if (c.includes('chain')) {
    return `Bridge $${capital} of USDC onto ${chain} through ${name} and use its apps there for the full period. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
  }
  return `Put $${capital} of USDC to work inside ${name} on ${chain} and leave the position open. Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with its cost and its time,
 * derived from the protocol's own record (category, chains, TVL, age) — never from
 * a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, farm: { capital_usd: number; gas_usd: number; days: number }): string[] {
  const chain = chainOf(p);
  const capital = farm.capital_usd;
  const gas = gasPerTx(chain);
  const hold = farm.days;
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const steps: string[] = [
    `Open a fresh wallet that holds only the funds you plan to farm with, and store its seed phrase offline on paper, never in a screenshot or a chat. Cost: nothing but the wallet. Time: 5 minutes.`,
    primaryAction(p, capital, chain, gas),
    secondChain === null
      ? `Repeat the same action once a week with a small top-up so the wallet shows steady, repeated use instead of a single deposit. Cost: about $${gas} of gas a week. Time: 10 minutes a week.`
      : `Do the same action once on ${secondChain} as well, so the wallet is active on two of the protocol's chains instead of one. Cost: about $${gas} of gas. Time: 10 minutes.`,
    `Keep the position open for at least ${hold} days so the activity spans more than one snapshot window and reads as a real user, not a one-day visitor. Cost: the $${capital} stays in the position. Time: ${hold} days.`,
    `Once a month, open the protocol's own points or rewards page from its official site and check that your wallet's activity is being counted. Cost: no fee to check. Time: 10 minutes.`,
    `If a token ever appears, claim only from the link the protocol itself publishes, and never pay anyone to claim for you: a claim that asks for a fee or a seed phrase is a scam. Cost: about $${gas} of gas, and only when you claim. Time: 10 minutes.`,
    `Keep a farm log with the wallet address, the dates and every transaction hash, so you can repeat the position on the next protocol or unwind it cleanly. Cost: nothing but the log. Time: 5 minutes.`,
  ];
  return steps.map((s) => {
    const t = s.trim();
    return t.length > 600 ? `${t.slice(0, 596)}...` : t;
  });
}
