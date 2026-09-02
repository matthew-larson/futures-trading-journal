import type {
  Trade,
  PatternCategory,
  PatternDimension,
  ConfidenceTier,
  DiscoveredPatternInput,
} from "./types";
import { toNyParts, nyDayName as nyDayNameTz } from "./timezone";
import { getMultiplier } from "./contracts";

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

export interface EngineResult {
  patterns: DiscoveredPatternInput[];
  totalTrades: number;
  hasSufficientData: boolean;
  runTimestamp: string;
}

interface GroupStat {
  label: string;
  trades: Trade[];
  count: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  avgR: number | null;
  profitFactor: number;
  expectancy: number;
  tradeIds: string[];
}

/* ================================================================== */
/* Configuration                                                      */
/* ================================================================== */

export const MIN_SAMPLE = 5;
export const STRONG_SAMPLE = 10;
export const HIGH_CONF_SAMPLE = 20;
export const MIN_TRADES_FOR_ANALYSIS = 8;

/* ================================================================== */
/* Math helpers                                                       */
/* ================================================================== */

function netPnl(t: Trade): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return (trades.filter((t) => netPnl(t) > 0).length / trades.length) * 100;
}

function totalPnl(trades: Trade[]): number {
  return trades.reduce((s, t) => s + netPnl(t), 0);
}

function avgPnl(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return totalPnl(trades) / trades.length;
}

function rMultiple(t: Trade): number | null {
  if (t.stop_price === null || t.entry_price === null) return null;
  const mult = getMultiplier(t.instrument);
  if (mult === null) return null;
  const risk = Math.abs(t.entry_price - t.stop_price) * mult * t.quantity;
  if (risk === 0) return null;
  return netPnl(t) / risk;
}

function targetMultiple(t: Trade): number | null {
  const reward = t.target_price !== null && t.entry_price !== null
    ? Math.abs(t.target_price - t.entry_price)
    : null;
  if (!reward || reward === 0) return null;
  return reward;
}

function stopSize(t: Trade): number | null {
  if (t.stop_price === null || t.entry_price === null) return null;
  return Math.abs(t.entry_price - t.stop_price);
}

function avgR(trades: Trade[]): number | null {
  const rs = trades.map(rMultiple).filter((r): r is number => r !== null);
  if (rs.length === 0) return null;
  return rs.reduce((s, r) => s + r, 0) / rs.length;
}

function profitFactor(trades: Trade[]): number {
  const gross = trades.filter((t) => netPnl(t) > 0).reduce((s, t) => s + netPnl(t), 0);
  const loss = Math.abs(trades.filter((t) => netPnl(t) < 0).reduce((s, t) => s + netPnl(t), 0));
  if (loss === 0) return gross > 0 ? 99 : 0;
  return gross / loss;
}

function expectancy(trades: Trade[]): number {
  return avgPnl(trades);
}

function confidenceScore(tradeCount: number, effectStrength: number = 1): number {
  let base: number;
  if (tradeCount >= HIGH_CONF_SAMPLE) base = 88;
  else if (tradeCount >= STRONG_SAMPLE) base = 72;
  else if (tradeCount >= MIN_SAMPLE) base = 52;
  else base = Math.max(10, Math.round((tradeCount / MIN_SAMPLE) * 35));
  return Math.max(10, Math.min(96, Math.round(base * effectStrength)));
}

function confidenceTier(score: number): ConfidenceTier {
  if (score >= 75) return "high_confidence";
  if (score >= 52) return "strong";
  return "emerging";
}

function tierLabel(tier: ConfidenceTier): string {
  if (tier === "high_confidence") return "High-Confidence Pattern";
  if (tier === "strong") return "Strong Pattern";
  return "Emerging Pattern";
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    if (key === null) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function formatMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/* ================================================================== */
/* Dimension extractors                                               */
/* ================================================================== */

function setupLabel(t: Trade): string {
  if (t.strategy_tags && t.strategy_tags.length > 0) return t.strategy_tags[0];
  return t.setup ?? "Unspecified";
}

function strategyLabel(t: Trade): string {
  if (t.strategy_tags && t.strategy_tags.length > 0) return t.strategy_tags.join(", ");
  return t.setup ?? "Unspecified";
}

function timeBucket(t: Trade): string {
  const m = toNyParts(t.entry_time).minuteOfDay;
  if (m < 600) return "Pre-Market (before 10:00)";
  if (m < 645) return "NY Open (10:00-10:45)";
  if (m < 720) return "Late Morning (10:45-12:00)";
  if (m < 840) return "Lunch (12:00-14:00)";
  if (m < 960) return "Afternoon (14:00-16:00)";
  return "Evening (after 16:00)";
}

function exitTimeBucket(t: Trade): string | null {
  if (!t.exit_time) return null;
  const m = toNyParts(t.exit_time).minuteOfDay;
  if (m < 600) return "Pre-Market Exit (before 10:00)";
  if (m < 645) return "NY Open Exit (10:00-10:45)";
  if (m < 720) return "Late Morning Exit (10:45-12:00)";
  if (m < 840) return "Lunch Exit (12:00-14:00)";
  if (m < 960) return "Afternoon Exit (14:00-16:00)";
  return "Evening Exit (after 16:00)";
}

function dayName(t: Trade): string {
  return nyDayNameTz(t.entry_time);
}

function sessionLabel(t: Trade): string {
  if (t.market_session === "asian") return "Asia";
  if (t.market_session === "london") return "London";
  if (t.market_session === "new_york") return "New York";
  if (t.market_session === "overnight") return "Overnight";
  return "Untagged";
}

function holdMinutes(t: Trade): number | null {
  if (!t.exit_time || !t.entry_time) return null;
  return (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000;
}

function holdBucket(t: Trade): string | null {
  const m = holdMinutes(t);
  if (m === null) return null;
  if (m < 15) return "< 15 min (scalp)";
  if (m < 45) return "15-45 min (intraday)";
  if (m < 120) return "45 min-2h (swing)";
  return "2h+ (position)";
}

function rBucket(t: Trade): string | null {
  const r = rMultiple(t);
  if (r === null) return null;
  if (r <= -1) return "Full stop (-1R or worse)";
  if (r < 0) return "Small loss (-1R to 0)";
  if (r < 1) return "Small win (0 to +1R)";
  if (r < 2) return "Solid win (+1R to +2R)";
  return "Big win (+2R or better)";
}

function rrRatio(t: Trade): number | null {
  const stop = stopSize(t);
  const target = targetMultiple(t);
  if (stop === null || target === null || stop === 0) return null;
  return target / stop;
}

function rrBucket(t: Trade): string | null {
  const rr = rrRatio(t);
  if (rr === null) return null;
  if (rr < 1) return "R:R < 1:1 (poor)";
  if (rr < 2) return "R:R 1:1-2:1 (acceptable)";
  if (rr < 3) return "R:R 2:1-3:1 (good)";
  return "R:R 3:1+ (excellent)";
}

function positionSizeBucket(t: Trade): string {
  if (t.quantity === 1) return "1 lot";
  if (t.quantity === 2) return "2 lots";
  return "3+ lots";
}

function stopSizeBucket(t: Trade): string | null {
  const s = stopSize(t);
  if (s === null) return null;
  if (s < 5) return "Tight stop (< 5 pts)";
  if (s < 15) return "Standard stop (5-15 pts)";
  if (s < 30) return "Wide stop (15-30 pts)";
  return "Very wide stop (30+ pts)";
}

function emotionCategory(t: Trade): string | null {
  if (!t.emotions) return null;
  const e = t.emotions.toLowerCase();
  const positive = ["calm", "confident", "neutral", "focused", "patient", "disciplined"];
  const negative = ["fomo", "revenge", "fear", "panic", "greed", "anxious", "tilt", "angry", "frustrat", "nervous", "excited"];
  if (positive.some((p) => e.includes(p))) return "Positive (calm/focused)";
  if (negative.some((n) => e.includes(n))) return "Negative (fear/greed/FOMO)";
  return "Mixed/other";
}

function gradeTier(t: Trade): string | null {
  const grade = t.ai_analysis?.grade ?? null;
  if (!grade) return null;
  if (grade.startsWith("A")) return "A-grade";
  if (grade.startsWith("B")) return "B-grade";
  if (grade.startsWith("C")) return "C-grade";
  return "D/F-grade";
}

function disciplineBucket(t: Trade): string | null {
  if (t.discipline_score === null || t.discipline_score === undefined) return null;
  if (t.discipline_score >= 80) return "High discipline (80+)";
  if (t.discipline_score >= 50) return "Medium discipline (50-79)";
  return "Low discipline (<50)";
}

function isTrendAligned(t: Trade): boolean | null {
  const tags = t.strategy_tags ?? [];
  const trendTags = ["Trend Pullback", "Trend Continuation", "Opening Range Breakout", "EMA Bounce", "Momentum", "Breakout"];
  const counterTags = ["VWAP Reversal", "Reversal", "Liquidity Sweep", "Scalp", "Range"];
  const hasTrend = tags.some((tg) => trendTags.includes(tg));
  const hasCounter = tags.some((tg) => counterTags.includes(tg));
  if (hasTrend && !hasCounter) return true;
  if (hasCounter && !hasTrend) return false;
  return null;
}

/* ================================================================== */
/* Group stats computation                                            */
/* ================================================================== */

function computeGroupStat(label: string, trades: Trade[]): GroupStat {
  return {
    label,
    trades,
    count: trades.length,
    winRate: winRate(trades),
    netPnl: totalPnl(trades),
    avgPnl: avgPnl(trades),
    avgR: avgR(trades),
    profitFactor: profitFactor(trades),
    expectancy: expectancy(trades),
    tradeIds: trades.map((t) => t.id),
  };
}

function groupStats(
  trades: Trade[],
  keyFn: (t: Trade) => string | null,
  minSample: number = MIN_SAMPLE
): GroupStat[] {
  return Array.from(groupBy(trades, keyFn).entries())
    .filter(([label]) => label !== null && label !== "Untagged" && label !== "Unspecified")
    .map(([label, ts]) => computeGroupStat(label, ts))
    .filter((g) => g.count >= minSample);
}

/* ================================================================== */
/* Pattern factory                                                    */
/* ================================================================== */

interface PatternSpec {
  key: string;
  category: PatternCategory;
  dimension: PatternDimension;
  label: string;
  description: string;
  recommendedAction: string;
  group: GroupStat;
  overallEv: number;
  overallPnl: number;
  effectStrength?: number;
}

function makePattern(spec: PatternSpec): DiscoveredPatternInput {
  const { group, overallEv, overallPnl } = spec;
  const effectStrength = spec.effectStrength ?? 1;

  const score = confidenceScore(group.count, effectStrength);
  const tier = confidenceTier(score);

  // Estimated P&L impact = difference between group P&L and what the same
  // number of trades at overall expectancy would have produced
  const expectedAtOverall = overallEv * group.count;
  const pnlImpact = group.netPnl - expectedAtOverall;

  return {
    pattern_key: spec.key,
    category: spec.category,
    dimension: spec.dimension,
    label: spec.label,
    description: spec.description,
    recommended_action: spec.recommendedAction,
    trade_count: group.count,
    win_rate: Math.round(group.winRate * 10) / 10,
    net_pnl: Math.round(group.netPnl),
    avg_r: group.avgR !== null ? Math.round(group.avgR * 100) / 100 : null,
    expectancy: Math.round(group.expectancy * 100) / 100,
    confidence_score: score,
    confidence_tier: tier,
    estimated_pnl_impact: Math.round(pnlImpact),
    is_active: true,
    supporting_trade_ids: group.tradeIds,
    degradation_note: null,
  };
}

/* ================================================================== */
/* Dimension scanners                                                 */
/* ================================================================== */

interface ScanContext {
  closed: Trade[];
  overallEv: number;
  overallPnl: number;
  overallWinRate: number;
  overallPf: number;
}

function scanSimpleDimension(
  ctx: ScanContext,
  dimension: PatternDimension,
  keyFn: (t: Trade) => string | null,
  labelPrefix: string
): DiscoveredPatternInput[] {
  const groups = groupStats(ctx.closed, keyFn);
  const patterns: DiscoveredPatternInput[] = [];

  for (const g of groups) {
    const isStrong = g.expectancy > ctx.overallEv * 1.25 && g.expectancy > 0;
    const isWeak = g.expectancy < 0 && g.expectancy < ctx.overallEv * 0.7;

    if (isStrong) {
      const strength = Math.min(2, g.expectancy / (Math.abs(ctx.overallEv) + 1));
      patterns.push(makePattern({
        key: `${dimension}:strong:${g.label}`,
        category: "strength",
        dimension,
        label: `${labelPrefix}: ${g.label} is a high-performing pattern`,
        description: `Across ${g.count} trades, ${g.label} produces ${formatMoney(g.expectancy)}/trade with a ${g.winRate.toFixed(0)}% win rate and ${g.profitFactor.toFixed(2)} profit factor (overall PF: ${ctx.overallPf.toFixed(2)}). This is above your average expectancy of ${formatMoney(ctx.overallEv)}.`,
        recommendedAction: `Prioritize ${g.label}. Your data supports allocating more capital here — consider sizing up when all criteria align.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
        effectStrength: strength,
      }));
    }

    if (isWeak) {
      const strength = Math.min(2, Math.abs(g.expectancy) / (Math.abs(ctx.overallEv) + 1));
      patterns.push(makePattern({
        key: `${dimension}:weak:${g.label}`,
        category: g.expectancy < 0 ? "weakness" : "behavioral_leak",
        dimension,
        label: `${labelPrefix}: ${g.label} is a poor-performing pattern`,
        description: `Across ${g.count} trades, ${g.label} loses ${formatMoney(Math.abs(g.expectancy))}/trade with a ${g.winRate.toFixed(0)}% win rate. Total damage: ${formatMoney(g.netPnl)}. This is below your average expectancy of ${formatMoney(ctx.overallEv)}.`,
        recommendedAction: `Remove ${g.label} from your trade plan for two weeks. If you must trade it, reduce size to 1/3 and only take A-grade entries.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
        effectStrength: strength,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Direction: long vs short                                           */
/* ------------------------------------------------------------------ */

function scanDirection(ctx: ScanContext): DiscoveredPatternInput[] {
  const longs = ctx.closed.filter((t) => t.direction === "long");
  const shorts = ctx.closed.filter((t) => t.direction === "short");
  const patterns: DiscoveredPatternInput[] = [];

  if (longs.length >= MIN_SAMPLE && shorts.length >= MIN_SAMPLE) {
    const longG = computeGroupStat("Long", longs);
    const shortG = computeGroupStat("Short", shorts);
    const diff = longG.expectancy - shortG.expectancy;
    const threshold = Math.abs(ctx.overallEv) * 0.3 + 50;

    if (Math.abs(diff) > threshold) {
      const better = diff > 0 ? longG : shortG;
      const worse = diff > 0 ? shortG : longG;
      const betterDir = diff > 0 ? "long" : "short";
      const worseDir = diff > 0 ? "short" : "long";
      const isLeak = worse.expectancy < 0;

      patterns.push(makePattern({
        key: `direction:edge:${betterDir}`,
        category: isLeak ? "behavioral_leak" : "strength",
        dimension: "direction",
        label: `Your ${betterDir} trades ${isLeak ? "are profitable but " + worseDir + "s are losing" : "outperform your " + worseDir + "s"}`,
        description: `Long: ${formatMoney(longG.expectancy)}/trade (${longG.winRate.toFixed(0)}% win, ${longG.count} trades). Short: ${formatMoney(shortG.expectancy)}/trade (${shortG.winRate.toFixed(0)}% win, ${shortG.count} trades). The expectancy gap is ${formatMoney(Math.abs(diff))}/trade.`,
        recommendedAction: isLeak
          ? `Stop taking ${worseDir} trades until you've reviewed your ${worse.count} losing ${worseDir}s. Your edge is clearly on the ${betterDir} side.`
          : `Continue favoring ${betterDir}s but refine your ${worseDir} entries — the gap is close enough to close.`,
        group: better,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Consecutive wins/losses — overtrading & revenge patterns           */
/* ------------------------------------------------------------------ */

function scanStreaks(ctx: ScanContext): DiscoveredPatternInput[] {
  const chrono = [...ctx.closed].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  const patterns: DiscoveredPatternInput[] = [];

  // Trades after N consecutive losses (revenge trading)
  for (const n of [2, 3]) {
    const after: Trade[] = [];
    let consec = 0;
    for (const t of chrono) {
      if (consec >= n) after.push(t);
      const p = netPnl(t);
      if (p > 0) consec = 0;
      else if (p < 0) consec++;
    }
    if (after.length >= MIN_SAMPLE) {
      const g = computeGroupStat(`After ${n}+ losses`, after);
      if (g.expectancy < 0 && g.expectancy < ctx.overallEv * 0.7) {
        patterns.push(makePattern({
          key: `consecutive_losses:revenge:${n}`,
          category: "behavioral_leak",
          dimension: "consecutive_losses",
          label: `Revenge trading after ${n}+ consecutive losses`,
          description: `After ${n}+ consecutive losses, your next trade averages ${formatMoney(g.expectancy)} across ${g.count} instances with a ${g.winRate.toFixed(0)}% win rate. This is a measurable tilt pattern — your decision quality degrades under drawdown pressure.`,
          recommendedAction: `Enforce a hard rule: after ${n} consecutive losses, stop trading for the rest of the day. Your edge does not survive the emotional state that follows back-to-back losses.`,
          group: g,
          overallEv: ctx.overallEv,
          overallPnl: ctx.overallPnl,
        }));
      }
    }
  }

  // Trades after N consecutive wins (overconfidence)
  for (const n of [2, 3]) {
    const after: Trade[] = [];
    let consec = 0;
    for (const t of chrono) {
      if (consec >= n) after.push(t);
      const p = netPnl(t);
      if (p > 0) consec++;
      else if (p < 0) consec = 0;
    }
    if (after.length >= MIN_SAMPLE) {
      const g = computeGroupStat(`After ${n}+ wins`, after);
      if (g.expectancy < 0) {
        patterns.push(makePattern({
          key: `consecutive_wins:overconfidence:${n}`,
          category: "behavioral_leak",
          dimension: "consecutive_wins",
          label: `Overconfidence after ${n}+ consecutive wins`,
          description: `After ${n}+ consecutive wins, your next trade averages ${formatMoney(g.expectancy)} across ${g.count} instances with a ${g.winRate.toFixed(0)}% win rate. You're likely sizing up or loosening entry criteria after winning streaks.`,
          recommendedAction: `After a ${n}+ win streak, pause for 15 minutes before the next trade. Re-verify every entry criterion — winning streaks breed carelessness.`,
          group: g,
          overallEv: ctx.overallEv,
          overallPnl: ctx.overallPnl,
        }));
      }
      if (g.expectancy > 0 && g.expectancy > ctx.overallEv * 1.25) {
        patterns.push(makePattern({
          key: `consecutive_wins:momentum:${n}`,
          category: "strength",
          dimension: "consecutive_wins",
          label: `You ride momentum well after ${n}+ winning streaks`,
          description: `After ${n}+ consecutive wins, your next trade averages ${formatMoney(g.expectancy)} across ${g.count} instances with a ${g.winRate.toFixed(0)}% win rate. You stay in a flow state and execute well.`,
          recommendedAction: `When in a winning streak, continue trading — but cap at your normal position size. Don't let confidence become overconfidence.`,
          group: g,
          overallEv: ctx.overallEv,
          overallPnl: ctx.overallPnl,
        }));
      }
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Overtrading — too many trades per day                              */
/* ------------------------------------------------------------------ */

function scanOvertrading(ctx: ScanContext): DiscoveredPatternInput[] {
  const byDay = groupBy(ctx.closed, (t) => toNyParts(t.entry_time).dateString);
  const patterns: DiscoveredPatternInput[] = [];

  const highVolumeDays: Trade[] = [];
  const normalDays: Trade[] = [];
  for (const [, dayTrades] of byDay) {
    if (dayTrades.length >= 5) highVolumeDays.push(...dayTrades);
    else normalDays.push(...dayTrades);
  }

  if (highVolumeDays.length >= MIN_SAMPLE && normalDays.length >= MIN_SAMPLE) {
    const highG = computeGroupStat("5+ trades/day", highVolumeDays);
    const normalG = computeGroupStat("1-4 trades/day", normalDays);

    if (highG.expectancy < normalG.expectancy * 0.6 && highG.expectancy < 0) {
      patterns.push(makePattern({
        key: "overtrading:high_volume",
        category: "behavioral_leak",
        dimension: "combination",
        label: `Overtrading: 5+ trades/day degrades your edge`,
        description: `On days with 5+ trades, you average ${formatMoney(highG.expectancy)}/trade (${highG.count} trades, ${highG.winRate.toFixed(0)}% win). On normal days (1-4 trades), you average ${formatMoney(normalG.expectancy)}/trade (${normalG.count} trades, ${normalG.winRate.toFixed(0)}% win). More trades correlates with worse decisions.`,
        recommendedAction: `Cap yourself at 3 trades per day. Your data shows that beyond 4 trades, your win rate and expectancy collapse — you're forcing setups.`,
        group: highG,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Rule compliance — each rule followed vs violated                   */
/* ------------------------------------------------------------------ */

function scanRuleCompliance(ctx: ScanContext): DiscoveredPatternInput[] {
  const withRules = ctx.closed.filter((t) => t.rule_compliance && Object.keys(t.rule_compliance).length > 0);
  if (withRules.length < MIN_SAMPLE) return [];

  const patterns: DiscoveredPatternInput[] = [];
  const ruleMap = new Map<string, { followed: Trade[]; violated: Trade[] }>();

  for (const t of withRules) {
    for (const [ruleId, compliant] of Object.entries(t.rule_compliance)) {
      const entry = ruleMap.get(ruleId) ?? { followed: [], violated: [] };
      if (compliant) entry.followed.push(t);
      else entry.violated.push(t);
      ruleMap.set(ruleId, entry);
    }
  }

  for (const [ruleId, { followed, violated }] of ruleMap) {
    if (followed.length >= MIN_SAMPLE && violated.length >= MIN_SAMPLE) {
      const followG = computeGroupStat("Rule followed", followed);
      const violG = computeGroupStat("Rule violated", violated);

      if (followG.expectancy > 0 && violG.expectancy < followG.expectancy * 0.5) {
        patterns.push(makePattern({
          key: `rule_compliance:${ruleId}`,
          category: "opportunity",
          dimension: "rule_compliance",
          label: `Trades following this rule outperformed violations by approximately ${formatMoney(Math.abs(violG.netPnl))}`,
          description: `When you follow this rule: ${formatMoney(followG.expectancy)}/trade (${followG.count} trades, ${followG.winRate.toFixed(0)}% win). When you break it: ${formatMoney(violG.expectancy)}/trade (${violG.count} trades, ${violG.winRate.toFixed(0)}% win). The difference is ${formatMoney(followG.expectancy - violG.expectancy)}/trade.`,
          recommendedAction: `Make this rule non-negotiable. Before every entry, verbally confirm you're following it — trades following it outperform violations by approximately ${formatMoney(followG.expectancy - violG.expectancy)} per trade.`,
          group: violG,
          overallEv: ctx.overallEv,
          overallPnl: ctx.overallPnl,
        }));
      }
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Discipline score buckets                                           */
/* ------------------------------------------------------------------ */

function scanDiscipline(ctx: ScanContext): DiscoveredPatternInput[] {
  const groups = groupStats(ctx.closed, disciplineBucket);
  const patterns: DiscoveredPatternInput[] = [];

  for (const g of groups) {
    if (g.label.startsWith("High") && g.expectancy > ctx.overallEv * 1.2 && g.expectancy > 0) {
      patterns.push(makePattern({
        key: `discipline_score:high`,
        category: "strength",
        dimension: "discipline_score",
        label: `High-discipline trades are your most profitable`,
        description: `When your discipline score is 80+, you average ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. Discipline is a leading indicator of your performance.`,
        recommendedAction: `Treat your pre-trade discipline checklist as sacred. Your data shows a direct correlation between discipline score and profitability.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
    if (g.label.startsWith("Low") && g.expectancy < 0) {
      patterns.push(makePattern({
        key: `discipline_score:low`,
        category: "behavioral_leak",
        dimension: "discipline_score",
        label: `Low-discipline trades consistently lose money`,
        description: `When your discipline score is below 50, you average ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. Undisciplined entries have a measurable negative edge.`,
        recommendedAction: `If your discipline score is below 50 on a given day, stop trading. Your data shows you cannot trade profitably in that state.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Emotional tags                                                     */
/* ------------------------------------------------------------------ */

function scanEmotions(ctx: ScanContext): DiscoveredPatternInput[] {
  const groups = groupStats(ctx.closed, emotionCategory);
  const patterns: DiscoveredPatternInput[] = [];

  for (const g of groups) {
    if (g.label.startsWith("Negative") && g.expectancy < 0) {
      patterns.push(makePattern({
        key: `emotional_tag:negative`,
        category: "behavioral_leak",
        dimension: "emotional_tag",
        label: `Emotional trades are your biggest losers`,
        description: `When you trade with negative emotions (${g.count} trades), your expectancy is ${formatMoney(g.expectancy)}/trade with a ${g.winRate.toFixed(0)}% win rate. Total loss: ${formatMoney(g.netPnl)}.`,
        recommendedAction: `Before entering, check your emotional state. If you feel FOMO, revenge, or anxiety, skip the trade. Emotional entries have a measurable negative edge.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
    if (g.label.startsWith("Positive") && g.expectancy > ctx.overallEv * 1.15 && g.expectancy > 0) {
      patterns.push(makePattern({
        key: `emotional_tag:positive`,
        category: "strength",
        dimension: "emotional_tag",
        label: `Calm, confident trading produces your best results`,
        description: `When you trade with positive emotions (${g.count} trades), your expectancy is ${formatMoney(g.expectancy)}/trade with a ${g.winRate.toFixed(0)}% win rate. Your profit factor is ${g.profitFactor.toFixed(2)}.`,
        recommendedAction: `Your emotional state is a leading indicator. Only trade when you feel calm and prepared — the data shows a clear performance gap.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Trade grade                                                        */
/* ------------------------------------------------------------------ */

function scanTradeGrade(ctx: ScanContext): DiscoveredPatternInput[] {
  const groups = groupStats(ctx.closed, gradeTier);
  const patterns: DiscoveredPatternInput[] = [];
  const aG = groups.find((g) => g.label === "A-grade");
  const lowG = groups.filter((g) => ["C-grade", "D/F-grade"].includes(g.label));

  if (aG && aG.expectancy > 0 && aG.expectancy > ctx.overallEv * 1.2) {
    patterns.push(makePattern({
      key: `trade_grade:a_excellence`,
      category: "strength",
      dimension: "trade_grade",
      label: `A-grade setups are your highest-edge trades`,
      description: `A-grade trades produce ${formatMoney(aG.expectancy)}/trade across ${aG.count} trades with a ${aG.winRate.toFixed(0)}% win rate and ${aG.profitFactor.toFixed(2)} profit factor. This is well above your overall average.`,
      recommendedAction: `Only take trades your AI coach rates A- or above. If a setup doesn't meet that bar in pre-trade analysis, skip it.`,
      group: aG,
      overallEv: ctx.overallEv,
      overallPnl: ctx.overallPnl,
    }));
  }

  const lowTrades = lowG.flatMap((g) => g.trades);
  if (lowTrades.length >= MIN_SAMPLE) {
    const lowGroup = computeGroupStat("C/D/F-grade", lowTrades);
    if (lowGroup.expectancy < 0) {
      patterns.push(makePattern({
        key: `trade_grade:low_grade_leak`,
        category: "behavioral_leak",
        dimension: "trade_grade",
        label: `Low-grade setups are leaking capital`,
        description: `C/D/F-rated trades average ${formatMoney(lowGroup.expectancy)}/trade across ${lowGroup.count} trades with a ${lowGroup.winRate.toFixed(0)}% win rate. You've lost ${formatMoney(lowGroup.netPnl)} on sub-par setups.`,
        recommendedAction: `Filter to A/B-grade setups only. Every low-grade trade is a conscious choice to deploy capital where your edge is negative.`,
        group: lowGroup,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Risk management — position size, stop size, R:R                    */
/* ------------------------------------------------------------------ */

function scanRiskManagement(ctx: ScanContext): DiscoveredPatternInput[] {
  const patterns: DiscoveredPatternInput[] = [];

  // Position size
  for (const g of groupStats(ctx.closed, positionSizeBucket)) {
    if (g.label === "3+ lots" && g.expectancy < 0) {
      patterns.push(makePattern({
        key: `position_size:oversized`,
        category: "risk_pattern",
        dimension: "position_size",
        label: `Sizing up to 3+ lots is destroying your edge`,
        description: `When you trade 3+ lots, your expectancy drops to ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. Larger size correlates with worse decisions — likely emotional overexposure.`,
        recommendedAction: `Cap your position at 1-2 lots for the next three weeks. Prove you can be consistent before adding size.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
    if (g.label === "1 lot" && g.expectancy > ctx.overallEv * 1.15 && g.expectancy > 0) {
      patterns.push(makePattern({
        key: `position_size:1lot_edge`,
        category: "strength",
        dimension: "position_size",
        label: `You perform best with 1-lot sizing`,
        description: `With 1 lot, your expectancy is ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. Profit factor: ${g.profitFactor.toFixed(2)}.`,
        recommendedAction: `Stick to 1 lot until you've built consistency. Sizing up beyond this is hurting your decision quality.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  // Stop size
  for (const g of groupStats(ctx.closed, stopSizeBucket)) {
    if (g.label.includes("Very wide") && g.expectancy < 0) {
      patterns.push(makePattern({
        key: `stop_size:too_wide`,
        category: "risk_pattern",
        dimension: "stop_size",
        label: `Very wide stops (30+ pts) are losing trades`,
        description: `When your stop is 30+ points, your expectancy is ${formatMoney(g.expectancy)}/trade across ${g.count} trades. Wide stops mean you're risking too much per trade or entering without a clear invalidation level.`,
        recommendedAction: `Tighten your stops to the 5-15 point range. If a setup requires a 30+ point stop, the entry is too early or the setup is unclear.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  // R:R ratio
  for (const g of groupStats(ctx.closed, rrBucket)) {
    if (g.label.includes("poor") && g.expectancy < 0) {
      patterns.push(makePattern({
        key: `target_size:poor_rr`,
        category: "risk_pattern",
        dimension: "target_size",
        label: `R:R below 1:1 is a negative-edge pattern`,
        description: `When your reward-to-risk ratio is below 1:1, your expectancy is ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. You need a very high win rate to overcome poor R:R — and yours isn't high enough.`,
        recommendedAction: `Only take trades with at least 2:1 reward-to-risk. If the setup doesn't offer 2:1, the trade isn't worth taking.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
    if (g.label.includes("excellent") && g.expectancy > 0) {
      patterns.push(makePattern({
        key: `target_size:excellent_rr`,
        category: "strength",
        dimension: "target_size",
        label: `3:1+ R:R trades are your best risk-adjusted returns`,
        description: `When your R:R is 3:1+, you average ${formatMoney(g.expectancy)}/trade across ${g.count} trades with a ${g.winRate.toFixed(0)}% win rate. You're letting winners run and cutting losers short.`,
        recommendedAction: `Continue targeting 3:1+ setups. Your data confirms that asymmetric risk-reward is where your edge compounds.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  // R-multiple distribution
  for (const g of groupStats(ctx.closed, rBucket)) {
    if (g.label.includes("Full stop") && g.count >= MIN_SAMPLE) {
      patterns.push(makePattern({
        key: `r_multiple:full_stop`,
        category: "weakness",
        dimension: "r_multiple",
        label: `${g.count} trades hit full stop — your biggest R bucket`,
        description: `${g.count} trades (${g.winRate.toFixed(0)}% of this bucket) resulted in a full stop-out. These trades are associated with ${formatMoney(g.netPnl)} in net losses. Reducing full-stop frequency is associated with higher expectancy.`,
        recommendedAction: `Review your ${g.count} full-stop trades. Are your stops too tight, or are your entries poorly timed? Each full-stop trade is a thesis that was wrong — learn from the pattern.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
    if (g.label.includes("Big win") && g.expectancy > 0) {
      patterns.push(makePattern({
        key: `r_multiple:big_win`,
        category: "strength",
        dimension: "r_multiple",
        label: `Your +2R+ winners are your edge source`,
        description: `Your ${g.count} big winners (+2R or better) average ${formatMoney(g.expectancy)}/trade. These trades are where your edge actually comes from — your ability to let winners run.`,
        recommendedAction: `Protect your big winners. Don't cut a +2R trade early — your data shows these are your edge source. Trail your stop and let the market take you out.`,
        group: g,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Trend alignment (countertrend leak)                                */
/* ------------------------------------------------------------------ */

function scanTrendAlignment(ctx: ScanContext): DiscoveredPatternInput[] {
  const patterns: DiscoveredPatternInput[] = [];
  const trendTrades = ctx.closed.filter((t) => isTrendAligned(t) === true);
  const counterTrades = ctx.closed.filter((t) => isTrendAligned(t) === false);

  if (trendTrades.length >= MIN_SAMPLE && counterTrades.length >= MIN_SAMPLE) {
    const trendG = computeGroupStat("Trend-following", trendTrades);
    const counterG = computeGroupStat("Countertrend", counterTrades);

    if (trendG.expectancy > 0 && counterG.expectancy < 0) {
      patterns.push(makePattern({
        key: `combination:trend_vs_counter`,
        category: "opportunity",
        dimension: "combination",
        label: `Countertrend trades are leaking capital`,
        description: `Trend-following: ${formatMoney(trendG.expectancy)}/trade (${trendG.count} trades, ${trendG.winRate.toFixed(0)}% win). Countertrend: ${formatMoney(counterG.expectancy)}/trade (${counterG.count} trades, ${counterG.winRate.toFixed(0)}% win). Dropping countertrend trades would shift your expectancy from ${formatMoney(ctx.overallEv)} to ${formatMoney(trendG.expectancy)}.`,
        recommendedAction: `For the next two weeks, only trade in the direction of the higher timeframe trend. Counter your impulses, not the trend.`,
        group: counterG,
        overallEv: ctx.overallEv,
        overallPnl: ctx.overallPnl,
      }));
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Performance trend over time (first half vs second half)            */
/* ------------------------------------------------------------------ */

function scanPerformanceTrend(ctx: ScanContext): DiscoveredPatternInput[] {
  const patterns: DiscoveredPatternInput[] = [];
  if (ctx.closed.length < 16) return patterns; // need enough data to split

  const chrono = [...ctx.closed].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  const mid = Math.floor(chrono.length / 2);
  const firstHalf = chrono.slice(0, mid);
  const secondHalf = chrono.slice(mid);

  const firstG = computeGroupStat("First half", firstHalf);
  const secondG = computeGroupStat("Second half", secondHalf);

  // Improving
  if (secondG.expectancy > firstG.expectancy * 1.3 && secondG.expectancy > 0) {
    patterns.push(makePattern({
      key: `trend:improving`,
      category: "strength",
      dimension: "combination",
      label: `Your performance is improving over time`,
      description: `Your first ${mid} trades averaged ${formatMoney(firstG.expectancy)}/trade (${firstG.winRate.toFixed(0)}% win). Your most recent ${chrono.length - mid} trades average ${formatMoney(secondG.expectancy)}/trade (${secondG.winRate.toFixed(0)}% win). You're getting better.`,
      recommendedAction: `Keep doing what you're doing. Your recent performance is significantly better than your earlier trades — your process improvements are working.`,
      group: secondG,
      overallEv: ctx.overallEv,
      overallPnl: ctx.overallPnl,
    }));
  }

  // Declining
  if (secondG.expectancy < firstG.expectancy * 0.5 && secondG.expectancy < firstG.expectancy) {
    patterns.push(makePattern({
      key: `trend:declining`,
      category: "weakness",
      dimension: "combination",
      label: `Your performance is declining`,
      description: `Your first ${mid} trades averaged ${formatMoney(firstG.expectancy)}/trade (${firstG.winRate.toFixed(0)}% win). Your most recent ${chrono.length - mid} trades average ${formatMoney(secondG.expectancy)}/trade (${secondG.winRate.toFixed(0)}% win). Something has changed — and not for the better.`,
      recommendedAction: `Audit what changed between your first and second half. Did you alter your setup, size, or schedule? Revert to what was working.`,
      group: secondG,
      overallEv: ctx.overallEv,
      overallPnl: ctx.overallPnl,
    }));
  }

  return patterns;
}

/* ================================================================== */
/* Main engine function                                               */
/* ================================================================== */

export function runEdgeDiscoveryEngine(trades: Trade[]): EngineResult {
  const closed = trades.filter((t) => t.exit_time !== null && t.pnl !== null);
  const totalTrades = closed.length;
  const runTimestamp = new Date().toISOString();

  if (totalTrades < MIN_TRADES_FOR_ANALYSIS) {
    return {
      patterns: [],
      totalTrades,
      hasSufficientData: false,
      runTimestamp,
    };
  }

  const ctx: ScanContext = {
    closed,
    overallEv: avgPnl(closed),
    overallPnl: totalPnl(closed),
    overallWinRate: winRate(closed),
    overallPf: profitFactor(closed),
  };

  const allPatterns: DiscoveredPatternInput[] = [];

  // Single-dimension scans
  allPatterns.push(...scanSimpleDimension(ctx, "instrument", (t) => t.instrument, "Instrument"));
  allPatterns.push(...scanSimpleDimension(ctx, "setup", setupLabel, "Setup"));
  allPatterns.push(...scanSimpleDimension(ctx, "strategy", strategyLabel, "Strategy"));
  allPatterns.push(...scanSimpleDimension(ctx, "entry_time", timeBucket, "Entry time"));
  allPatterns.push(...scanSimpleDimension(ctx, "exit_time", exitTimeBucket, "Exit time"));
  allPatterns.push(...scanSimpleDimension(ctx, "day_of_week", dayName, "Day of week"));
  allPatterns.push(...scanSimpleDimension(ctx, "session", sessionLabel, "Session"));
  allPatterns.push(...scanSimpleDimension(ctx, "holding_time", holdBucket, "Holding time"));
  allPatterns.push(...scanSimpleDimension(ctx, "win_loss", (t) => (netPnl(t) > 0 ? "Winner" : "Loser"), "Win/Loss"));

  // Complex behavioral scans
  allPatterns.push(...scanDirection(ctx));
  allPatterns.push(...scanStreaks(ctx));
  allPatterns.push(...scanOvertrading(ctx));
  allPatterns.push(...scanRuleCompliance(ctx));
  allPatterns.push(...scanDiscipline(ctx));
  allPatterns.push(...scanEmotions(ctx));
  allPatterns.push(...scanTradeGrade(ctx));
  allPatterns.push(...scanRiskManagement(ctx));
  allPatterns.push(...scanTrendAlignment(ctx));
  allPatterns.push(...scanPerformanceTrend(ctx));

  // Deduplicate by pattern_key (keep highest confidence if collision)
  const byKey = new Map<string, DiscoveredPatternInput>();
  for (const p of allPatterns) {
    const existing = byKey.get(p.pattern_key);
    if (!existing || p.confidence_score > existing.confidence_score) {
      byKey.set(p.pattern_key, p);
    }
  }

  return {
    patterns: Array.from(byKey.values()),
    totalTrades,
    hasSufficientData: true,
    runTimestamp,
  };
}

/* ================================================================== */
/* Utility exports for consumers                                      */
/* ================================================================== */

export { tierLabel, confidenceTier, confidenceScore };
export type { DiscoveredPatternInput as PatternInput };
