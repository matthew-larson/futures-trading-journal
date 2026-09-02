import type { Trade, TradingRule, Direction, MarketSession, DisciplineChecks, TradeInput, RuleInput } from "./types";
import { scoreTradeDiscipline } from "./discipline";
import { supabase } from "./supabase";

/* ------------------------------------------------------------------ */
/* Seeded RNG — deterministic so demo data is the same every load     */
/* ------------------------------------------------------------------ */

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const rng = seededRng(20240601);
function rand(min: number, max: number): number {
  return min + rng() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function chance(p: number): boolean {
  return rng() < p;
}

/* ------------------------------------------------------------------ */
/* Demo rule IDs (stable)                                             */
/* ------------------------------------------------------------------ */

export const DEMO_RULE_IDS = {
  risk: "demo-rule-risk",
  revenge: "demo-rule-revenge",
  trend: "demo-rule-trend",
  maxTrades: "demo-rule-max",
  confirmation: "demo-rule-confirmation",
};

export const DEMO_IMPORT_SOURCE = "demo";

/* ------------------------------------------------------------------ */
/* Trade generation parameters                                        */
/* ------------------------------------------------------------------ */

const INSTRUMENTS = ["ES", "MES"] as const;
const SESSIONS: MarketSession[] = ["asian", "london", "new_york", "overnight"];
const SETUPS = [
  "Opening Range Breakout",
  "Trend Pullback",
  "VWAP Reversal",
  "Liquidity Sweep",
  "EMA Bounce",
  "Breakout",
  "Reversal",
  "Momentum",
  "Scalp",
  "Trend Continuation",
];
const STRATEGY_TAGS_MAP: Record<string, string[]> = {
  "Opening Range Breakout": ["Opening Range Breakout", "Breakout"],
  "Trend Pullback": ["Trend Pullback", "EMA Bounce"],
  "VWAP Reversal": ["VWAP Reversal", "Reversal"],
  "Liquidity Sweep": ["Liquidity Sweep", "Reversal"],
  "EMA Bounce": ["EMA Bounce", "Trend Pullback"],
  "Breakout": ["Breakout", "Opening Range Breakout"],
  "Reversal": ["VWAP Reversal", "Reversal"],
  "Momentum": ["Momentum", "News Trade"],
  "Scalp": ["Scalp", "Liquidity Sweep"],
  "Trend Continuation": ["Trend Continuation", "Trend Pullback"],
};
const TREND_TAGS = ["Trend Pullback", "Trend Continuation", "Opening Range Breakout", "EMA Bounce", "Momentum", "Breakout"];
const COUNTER_TAGS = ["VWAP Reversal", "Reversal", "Liquidity Sweep", "Scalp"];
const NEG_EMOTIONS = ["fomo", "revenge", "anxious", "tilt", "frustrated", "panic", "greed", "angry"];
const POS_EMOTIONS = ["calm", "confident", "neutral", "focused", "patient"];

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

function tradeDate(daysBack: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function minsLater(iso: string, mins: number): string {
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString();
}

/* ------------------------------------------------------------------ */
/* Discipline + rule compliance generation                            */
/* ------------------------------------------------------------------ */

function genDisciplineChecks(
  emotions: string,
  isWin: boolean,
  brokeRevenge: boolean,
  brokeConfirmation: boolean
): DisciplineChecks {
  const e = emotions.toLowerCase();
  const isEmotional = NEG_EMOTIONS.some((n) => e.includes(n));
  const isChase = e.includes("fomo") || e.includes("chase");
  return {
    waited_for_confirmation: !brokeConfirmation,
    risk_under_plan: isWin ? true : chance(0.5),
    traded_plan_hours: chance(0.85),
    did_not_chase: !isChase,
    did_not_revenge_trade: !brokeRevenge,
    held_winner_correctly: isWin ? chance(0.7) : true,
    exited_per_plan: isWin ? chance(0.8) : chance(0.4),
  };
}

function genRuleCompliance(
  isWin: boolean,
  emotions: string,
  brokeTrend: boolean,
  brokeRevenge: boolean,
  brokeRisk: boolean,
  brokeConfirmation: boolean
): Record<string, boolean> {
  const e = emotions.toLowerCase();
  const isFomo = e.includes("fomo") || e.includes("chase");
  return {
    [DEMO_RULE_IDS.risk]: !brokeRisk,
    [DEMO_RULE_IDS.revenge]: !brokeRevenge,
    [DEMO_RULE_IDS.trend]: !brokeTrend,
    [DEMO_RULE_IDS.maxTrades]: chance(0.8),
    [DEMO_RULE_IDS.confirmation]: !brokeConfirmation,
  };
}

/* ------------------------------------------------------------------ */
/* Price simulation                                                    */
/* ------------------------------------------------------------------ */

function genPrice(instrument: string): number {
  if (instrument === "ES") return rand(4400, 4650);
  return rand(2200, 2325); // MES ≈ ES/2
}

function tickSize(instrument: string): number {
  return 0.25;
}

function tickValue(instrument: string): number {
  return instrument === "ES" ? 12.5 : 1.25; // $/tick per contract
}

function roundToTick(price: number, instrument: string): number {
  const ts = tickSize(instrument);
  return Math.round(price / ts) * ts;
}

function calcPnl(
  instrument: string,
  direction: Direction,
  entry: number,
  exit: number,
  qty: number
): number {
  const tickVal = tickValue(instrument);
  const ts = tickSize(instrument);
  const priceDiff = direction === "long" ? exit - entry : entry - exit;
  const ticks = priceDiff / ts;
  return Math.round(ticks * tickVal * qty * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Trade generation — the core loop                                   */
/* ------------------------------------------------------------------ */

let demoCounter = 0;

function makeDemoTrade(
  daysBack: number,
  hour: number,
  minute: number,
  instrument: string,
  direction: Direction,
  entry: number,
  exit: number,
  pnl: number,
  qty: number,
  holdMins: number,
  setup: string,
  session: MarketSession,
  emotions: string,
  mistakes: string | null,
  notes: string | null,
  ruleCompliance: Record<string, boolean>,
  discChecks: DisciplineChecks
): Trade {
  demoCounter++;
  const entryTime = tradeDate(daysBack, hour, minute);
  const exitTime = minsLater(entryTime, holdMins);
  const discScore = scoreTradeDiscipline(discChecks);
  const stopDist = roundToTick(rand(3, 8), instrument);
  const targetDist = roundToTick(rand(5, 15), instrument);
  const stop = direction === "long" ? entry - stopDist : entry + stopDist;
  const target = direction === "long" ? entry + targetDist : entry - targetDist;

  return {
    id: `demo-${demoCounter}`,
    instrument,
    direction,
    entry_price: entry,
    exit_price: exit,
    stop_price: stop,
    target_price: target,
    quantity: qty,
    entry_time: entryTime,
    exit_time: exitTime,
    pnl,
    fees: qty * 4.5,
    setup,
    market_session: session,
    emotions,
    mistakes,
    notes,
    screenshot_path: null,
    rule_compliance: ruleCompliance,
    discipline_checks: discChecks,
    discipline_score: discScore.score,
    strategy_tags: STRATEGY_TAGS_MAP[setup] ?? [setup],
    ai_analysis: null,
    created_at: entryTime,
    updated_at: new Date().toISOString(),
  };
}

interface TradeGenParams {
  daysBack: number;
  hour: number;
  minute: number;
  instrument: string;
  direction: Direction;
  entry: number;
  qty: number;
  setup: string;
  session: MarketSession;
  emotions: string;
  // Behavior flags
  brokeTrend: boolean;
  brokeRevenge: boolean;
  brokeRisk: boolean;
  brokeConfirmation: boolean;
  // Outcome
  isWin: boolean;
  rMultiple: number;
  holdMins: number;
}

function genTradeOutcome(
  instrument: string,
  direction: Direction,
  entry: number,
  qty: number,
  rMultiple: number
): { exit: number; pnl: number; holdMins: number } {
  const ts = tickSize(instrument);
  const tickVal = tickValue(instrument);
  // Derive stop distance from a realistic 3-6 point stop
  const stopDist = roundToTick(rand(3, 6), instrument);
  // R multiple determines exit distance relative to stop
  const exitDist = roundToTick(Math.abs(rMultiple) * stopDist, instrument);
  const exit = rMultiple >= 0
    ? direction === "long" ? entry + exitDist : entry - exitDist
    : direction === "long" ? entry - exitDist : entry + exitDist;
  const pnl = calcPnl(instrument, direction, entry, exit, qty);
  // Holding period: winners hold longer, losers shorter
  const holdMins = rMultiple >= 0
    ? randInt(15, 65)
    : randInt(3, 25);
  return { exit: roundToTick(exit, instrument), pnl, holdMins };
}

/* ------------------------------------------------------------------ */
/* Master generator — 150 trades over ~120 days                       */
/* ------------------------------------------------------------------ */

export function getDemoTrades(): Trade[] {
  demoCounter = 0;
  const trades: Trade[] = [];

  // Generate trades across ~120 calendar days (4 months)
  // ~150 trades = ~1.25 trades/day average, with gaps (weekends, no-trade days)
  const totalDays = 120;
  const targetTrades = 150;

  // Distribute trades: some days 0, some 1, some 2, occasional 3
  const tradesPerDay: number[] = [];
  let remaining = targetTrades;
  for (let d = totalDays; d >= 0 && remaining > 0; d--) {
    const dow = new Date();
    dow.setDate(dow.getDate() - d);
    const dayOfWeek = dow.getDay();
    // Skip weekends mostly
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (chance(0.15)) {
        tradesPerDay.push(1);
        remaining--;
      } else {
        tradesPerDay.push(0);
      }
      continue;
    }
    // Weekday: 0-3 trades
    const r = rng();
    let count: number;
    if (r < 0.15) count = 0;
    else if (r < 0.45) count = 1;
    else if (r < 0.8) count = 2;
    else count = 3;
    count = Math.min(count, remaining);
    tradesPerDay.push(count);
    remaining -= count;
  }

  // Fill any remaining trades in the last 30 days
  let dayIdx = 0;
  for (let d = tradesPerDay.length - 1; d >= 0 && remaining > 0; d--) {
    const dow = new Date();
    dow.setDate(dow.getDate() - d);
    if (dow.getDay() === 0 || dow.getDay() === 6) continue;
    tradesPerDay[d]++;
    remaining--;
  }

  // Track streaks for realistic win/loss sequences
  let currentStreak = 0; // positive = win streak, negative = loss streak
  let consecutiveLosses = 0;

  for (let d = 0; d < tradesPerDay.length; d++) {
    const count = tradesPerDay[d];
    if (count === 0) continue;
    const daysBack = totalDays - d;

    for (let i = 0; i < count; i++) {
      const instrument = pick([...INSTRUMENTS]);
      const direction: Direction = chance(0.58) ? "long" : "short";
      const entry = roundToTick(genPrice(instrument), instrument);
      const qty = chance(0.7) ? 1 : chance(0.85) ? 2 : 3;
      const setup = pick(SETUPS);
      const session: MarketSession = pick(SESSIONS);

      // Entry hour based on session
      let hour: number, minute: number;
      switch (session) {
        case "asian": hour = randInt(20, 23); minute = pick([0, 15, 30, 45]); break;
        case "london": hour = randInt(3, 6); minute = pick([0, 15, 30, 45]); break;
        case "new_york": hour = randInt(9, 15); minute = pick([0, 15, 30, 45]); break;
        case "overnight": hour = randInt(0, 3); minute = pick([0, 15, 30, 45]); break;
      }

      // Determine if this trade breaks rules (more likely after consecutive losses)
      const isRevengeTrade = consecutiveLosses >= 2 && chance(0.35);
      const isFomoTrade = chance(0.15);
      const brokeTrend = setup === "VWAP Reversal" || setup === "Reversal" || setup === "Liquidity Sweep" || setup === "Scalp"
        ? chance(0.4)
        : chance(0.15);
      const brokeRisk = chance(0.12) || (qty >= 3 && chance(0.5));
      const brokeRevenge = isRevengeTrade;
      const brokeConfirmation = isFomoTrade || isRevengeTrade || chance(0.18);

      // Emotions
      let emotions: string;
      if (isRevengeTrade) emotions = pick(["revenge", "tilt", "angry", "frustrated"]);
      else if (isFomoTrade) emotions = "fomo";
      else if (brokeRisk) emotions = pick(["greed", "anxious"]);
      else emotions = pick(POS_EMOTIONS);

      // Win probability: depends on behavior
      let winProb = 0.52; // baseline
      if (brokeTrend) winProb -= 0.12;
      if (brokeRevenge) winProb -= 0.15;
      if (brokeConfirmation) winProb -= 0.1;
      if (brokeRisk) winProb -= 0.08;
      if (qty >= 3) winProb -= 0.05;
      // Trend-aligned trades with confirmation do better
      if (!brokeTrend && !brokeConfirmation) winProb += 0.08;
      winProb = Math.max(0.2, Math.min(0.75, winProb));

      const isWin = chance(winProb);

      // R multiple: winners get 0.5R to 3R, losers get -0.5R to -1.5R
      let rMultiple: number;
      if (isWin) {
        rMultiple = pick([0.5, 0.75, 1.0, 1.0, 1.5, 1.5, 2.0, 2.5, 3.0]);
      } else {
        rMultiple = -pick([0.5, 0.75, 1.0, 1.0, 1.0, 1.25, 1.5]);
      }

      // Generate exit + P&L
      const outcome = genTradeOutcome(instrument, direction, entry, qty, rMultiple);

      // Mistakes
      let mistakes: string | null = null;
      if (isRevengeTrade) mistakes = "Revenge trade — entered immediately after a loss without waiting";
      else if (isFomoTrade) mistakes = "Chased the entry instead of waiting for confirmation";
      else if (brokeRisk) mistakes = "Position size exceeded planned risk";
      else if (brokeTrend) mistakes = "Traded against the higher timeframe trend";
      else if (!isWin && brokeConfirmation) mistakes = "Entered without waiting for setup confirmation";

      // Notes
      let notes: string | null = null;
      if (isWin && rMultiple >= 2) notes = "Clean setup, waited for confirmation, let it run to target";
      else if (isWin && emotions === "confident") notes = "Followed the plan, patient entry";
      else if (!isWin && emotions === "calm") notes = "Good process, market didn't cooperate";

      const discChecks = genDisciplineChecks(emotions, isWin, brokeRevenge, brokeConfirmation);
      const ruleCompliance = genRuleCompliance(isWin, emotions, brokeTrend, brokeRevenge, brokeRisk, brokeConfirmation);

      // Slight time offset for multiple trades same day
      const minuteOffset = i * randInt(45, 120);

      trades.push(makeDemoTrade(
        daysBack,
        hour,
        (minute + minuteOffset) % 60,
        instrument,
        direction,
        entry,
        outcome.exit,
        outcome.pnl,
        qty,
        outcome.holdMins,
        setup,
        session,
        emotions,
        mistakes,
        notes,
        ruleCompliance,
        discChecks
      ));

      // Track streaks
      if (isWin) {
        consecutiveLosses = 0;
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else {
        consecutiveLosses++;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }
    }
  }

  // Sort chronologically (oldest first matches existing pattern)
  trades.sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());

  // Re-number IDs after sort
  trades.forEach((t, i) => {
    t.id = `demo-${i + 1}`;
  });

  return trades;
}

/* ------------------------------------------------------------------ */
/* Demo rules                                                         */
/* ------------------------------------------------------------------ */

export function getDemoRules(): TradingRule[] {
  const now = new Date();
  const ago = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };
  return [
    {
      id: DEMO_RULE_IDS.risk,
      name: "Define risk before entry",
      description: "Always know your stop loss and max risk before opening a position.",
      category: "risk" as const,
      is_active: true,
      created_at: ago(120),
    },
    {
      id: DEMO_RULE_IDS.revenge,
      name: "No revenge trading",
      description: "After a losing trade, wait at least 15 minutes before the next entry.",
      category: "psychology" as const,
      is_active: true,
      created_at: ago(120),
    },
    {
      id: DEMO_RULE_IDS.trend,
      name: "Trade with the trend",
      description: "Only take trades in the direction of the higher timeframe trend.",
      category: "entry" as const,
      is_active: true,
      created_at: ago(120),
    },
    {
      id: DEMO_RULE_IDS.maxTrades,
      name: "Max 3 trades per day",
      description: "Hard cap on number of trades to avoid overtrading.",
      category: "risk" as const,
      is_active: true,
      created_at: ago(120),
    },
    {
      id: DEMO_RULE_IDS.confirmation,
      name: "Wait for confirmation",
      description: "Never enter without a confirmed setup signal.",
      category: "entry" as const,
      is_active: true,
      created_at: ago(120),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Load / reset demo data in Supabase                                 */
/* ------------------------------------------------------------------ */

/**
 * Check whether any demo trades exist in the database.
 */
export async function hasDemoData(): Promise<boolean> {
  const { count, error } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("import_source", DEMO_IMPORT_SOURCE);
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Load demo trades + rules into the database.
 * Deletes any existing demo data first, then inserts fresh.
 */
export async function loadDemoData(): Promise<{ tradesInserted: number; rulesInserted: number }> {
  // 1. Delete existing demo data
  await supabase.from("trades").delete().eq("import_source", DEMO_IMPORT_SOURCE);
  for (const ruleId of Object.values(DEMO_RULE_IDS)) {
    await supabase.from("trading_rules").delete().eq("id", ruleId);
  }

  // 2. Insert demo rules
  const demoRules = getDemoRules();
  const rulePayloads: RuleInput[] = demoRules.map((r) => ({
    name: r.name,
    description: r.description,
    category: r.category,
    is_active: r.is_active,
  }));

  // Insert rules with their fixed IDs (upsert)
  for (const rule of demoRules) {
    await supabase.from("trading_rules").upsert({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      is_active: rule.is_active,
      created_at: rule.created_at,
    }, { onConflict: "id" });
  }

  // 3. Insert demo trades
  const demoTrades = getDemoTrades();
  const tradePayloads: (TradeInput & { import_source: string; import_ref: string })[] = demoTrades.map((t) => {
    const discScore = scoreTradeDiscipline(t.discipline_checks);
    return {
      instrument: t.instrument,
      direction: t.direction,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      stop_price: t.stop_price,
      target_price: t.target_price,
      quantity: t.quantity,
      entry_time: t.entry_time,
      exit_time: t.exit_time,
      pnl: t.pnl,
      fees: t.fees,
      setup: t.setup,
      market_session: t.market_session,
      emotions: t.emotions,
      mistakes: t.mistakes,
      notes: t.notes,
      screenshot_path: null,
      rule_compliance: t.rule_compliance,
      discipline_checks: t.discipline_checks,
      discipline_score: discScore.score,
      strategy_tags: t.strategy_tags,
      import_source: DEMO_IMPORT_SOURCE,
      import_ref: t.id,
    };
  });

  // Insert in batches of 50 to avoid payload limits
  let tradesInserted = 0;
  for (let i = 0; i < tradePayloads.length; i += 50) {
    const batch = tradePayloads.slice(i, i + 50);
    const { error } = await supabase.from("trades").insert(batch);
    if (error) {
      console.error("Demo batch insert failed:", error.message);
    } else {
      tradesInserted += batch.length;
    }
  }

  return { tradesInserted, rulesInserted: demoRules.length };
}

/**
 * Reset (delete) all demo data from the database.
 */
export async function resetDemoData(): Promise<number> {
  const { count } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("import_source", DEMO_IMPORT_SOURCE);

  await supabase.from("trades").delete().eq("import_source", DEMO_IMPORT_SOURCE);
  for (const ruleId of Object.values(DEMO_RULE_IDS)) {
    await supabase.from("trading_rules").delete().eq("id", ruleId);
  }

  return count ?? 0;
}
