import type { Trade, TradingRule, DiscoveredPattern } from "./types";
import { getMultiplier } from "./contracts";

/* ------------------------------------------------------------------ */
/* Profile types                                                      */
/* ------------------------------------------------------------------ */

export interface SetupStat {
  name: string;
  tradeCount: number;
  winRate: number;
  netPnl: number;
  expectancy: number;
  avgR: number | null;
}

export interface InstrumentStat {
  name: string;
  tradeCount: number;
  winRate: number;
  netPnl: number;
}

export interface SessionStat {
  name: string;
  tradeCount: number;
  winRate: number;
  netPnl: number;
}

export interface PatternRef {
  patternKey: string;
  label: string;
  category: string;
  confidenceTier: string;
  tradeCount: number;
  expectancy: number | null;
  netPnl: number | null;
  recommendedAction: string;
}

export interface RuleRef {
  id: string;
  name: string;
  category: string;
  followedRate: number;
  violatedCount: number;
  violatedPnl: number;
  followedPnl: number;
}

export interface TrendMetric {
  label: string;
  firstHalf: number;
  secondHalf: number;
  change: string;
  improving: boolean;
}

export interface TraderProfile {
  builtAt: string;
  totalTrades: number;
  closedTrades: number;

  primaryInstruments: InstrumentStat[];
  preferredSessions: SessionStat[];
  favoriteSetups: SetupStat[];
  bestPerformingSetups: SetupStat[];
  worstPerformingSetups: SetupStat[];

  tradingStrengths: string[];
  recurringWeaknesses: string[];
  riskPreferences: {
    avgPositionSize: number;
    avgStopSize: number | null;
    avgRRRatio: number | null;
    noStopCount: number;
    noStopPnl: number;
    maxPositionSize: number;
  };

  tradingRules: RuleRef[];
  disciplinePatterns: {
    avgDisciplineScore: number | null;
    highDisciplineTrades: number;
    highDisciplineWinRate: number;
    lowDisciplineTrades: number;
    lowDisciplineWinRate: number;
    highDisciplineExpectancy: number;
    lowDisciplineExpectancy: number;
  };
  psychologicalPatterns: {
    emotionalTradeCount: number;
    emotionalPnl: number;
    emotionalWinRate: number;
    positiveEmotionTrades: number;
    positiveEmotionWinRate: number;
    revengeTrades: number;
    revengePnl: number;
    fomoTrades: number;
    fomoPnl: number;
  };

  currentImprovementGoal: string | null;
  recentRecommendations: string[];

  discoveredPatterns: PatternRef[];
  performanceTrend: TrendMetric[];
  edgeDiscoveryReady: boolean;
}

/* ------------------------------------------------------------------ */
/* Math helpers (self-contained — used by both client and edge fn)    */
/* ------------------------------------------------------------------ */

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

function avgR(trades: Trade[]): number | null {
  const rs = trades.map(rMultiple).filter((r): r is number => r !== null);
  if (rs.length === 0) return null;
  return rs.reduce((s, r) => s + r, 0) / rs.length;
}

function stopSize(t: Trade): number | null {
  if (t.stop_price === null || t.entry_price === null) return null;
  return Math.abs(t.entry_price - t.stop_price);
}

function targetMultiple(t: Trade): number | null {
  if (t.target_price === null || t.entry_price === null) return null;
  return Math.abs(t.target_price - t.entry_price);
}

function rrRatio(t: Trade): number | null {
  const s = stopSize(t);
  const tg = targetMultiple(t);
  if (s === null || tg === null || s === 0) return null;
  return tg / s;
}

function setupLabel(t: Trade): string {
  if (t.strategy_tags && t.strategy_tags.length > 0) return t.strategy_tags[0];
  return t.setup ?? "Unspecified";
}

function sessionName(t: Trade): string | null {
  if (!t.market_session) return null;
  const map: Record<string, string> = {
    asian: "Asia", london: "London", new_york: "New York", overnight: "Overnight",
  };
  return map[t.market_session] ?? t.market_session;
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

/* ------------------------------------------------------------------ */
/* Profile builder                                                    */
/* ------------------------------------------------------------------ */

export function buildTraderProfile(
  trades: Trade[],
  patterns: DiscoveredPattern[],
  rules: TradingRule[]
): TraderProfile {
  const closed = trades.filter((t) => t.exit_time !== null && t.pnl !== null);
  const builtAt = new Date().toISOString();

  // Instruments
  const instrumentGroups = Array.from(groupBy(closed, (t) => t.instrument).entries())
    .map(([name, ts]) => ({
      name,
      tradeCount: ts.length,
      winRate: winRate(ts),
      netPnl: totalPnl(ts),
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount);

  // Sessions
  const sessionGroups = Array.from(groupBy(closed, sessionName).entries())
    .map(([name, ts]) => ({
      name,
      tradeCount: ts.length,
      winRate: winRate(ts),
      netPnl: totalPnl(ts),
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount);

  // Setups
  const setupGroups = Array.from(groupBy(closed, setupLabel).entries())
    .filter(([name]) => name !== "Unspecified")
    .map(([name, ts]) => ({
      name,
      tradeCount: ts.length,
      winRate: winRate(ts),
      netPnl: totalPnl(ts),
      expectancy: avgPnl(ts),
      avgR: avgR(ts),
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  const bestSetups = setupGroups
    .filter((s) => s.tradeCount >= 3 && s.netPnl > 0)
    .sort((a, b) => b.expectancy - a.expectancy)
    .slice(0, 5);
  const worstSetups = setupGroups
    .filter((s) => s.tradeCount >= 3 && s.netPnl < 0)
    .sort((a, b) => a.expectancy - b.expectancy)
    .slice(0, 5);

  // Strengths from patterns
  const strengthPatterns = patterns.filter((p) => p.category === "strength" && p.is_active);
  const tradingStrengths = strengthPatterns.slice(0, 5).map((p) => p.label);

  // Weaknesses from patterns
  const weaknessPatterns = patterns.filter(
    (p) => (p.category === "weakness" || p.category === "behavioral_leak") && p.is_active
  );
  const recurringWeaknesses = weaknessPatterns.slice(0, 5).map((p) => p.label);

  // Risk preferences
  const positionSizes = closed.map((t) => t.quantity);
  const stopSizes = closed.map(stopSize).filter((s): s is number => s !== null);
  const rrRatios = closed.map(rrRatio).filter((r): r is number => r !== null);
  const noStopTrades = closed.filter((t) => t.stop_price === null);

  // Rules
  const ruleRefs: RuleRef[] = rules.map((r) => {
    let followed = 0, violated = 0, followedPnl = 0, violatedPnl = 0, total = 0;
    for (const t of closed) {
      const comp = t.rule_compliance;
      if (!(r.id in comp)) continue;
      total++;
      if (comp[r.id]) { followed++; followedPnl += netPnl(t); }
      else { violated++; violatedPnl += netPnl(t); }
    }
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      followedRate: total > 0 ? (followed / total) * 100 : 0,
      violatedCount: violated,
      violatedPnl,
      followedPnl,
    };
  }).filter((r) => r.violatedCount > 0 || r.followedRate > 0);

  // Discipline patterns
  const withDiscipline = closed.filter((t) => t.discipline_score !== null && t.discipline_score !== undefined);
  const highDisc = withDiscipline.filter((t) => (t.discipline_score ?? 0) >= 80);
  const lowDisc = withDiscipline.filter((t) => (t.discipline_score ?? 0) < 50);

  // Psychological patterns
  const negEmotions = ["fomo", "revenge", "fear", "panic", "greed", "anxious", "tilt", "angry", "frustrat", "nervous"];
  const posEmotions = ["calm", "confident", "neutral", "focused", "patient", "disciplined"];
  const emotionalTrades = closed.filter((t) => {
    const e = (t.emotions ?? "").toLowerCase();
    return negEmotions.some((n) => e.includes(n));
  });
  const positiveEmotionTrades = closed.filter((t) => {
    const e = (t.emotions ?? "").toLowerCase();
    return posEmotions.some((p) => e.includes(p));
  });
  const revengeTrades = closed.filter((t) => {
    const e = (t.emotions ?? "").toLowerCase();
    return e.includes("revenge") || e.includes("tilt") || e.includes("angry");
  });
  const fomoTrades = closed.filter((t) => {
    const e = (t.emotions ?? "").toLowerCase();
    return e.includes("fomo") || e.includes("chase") || e.includes("impulsive");
  });

  // Performance trend
  const chrono = [...closed].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  const trends: TrendMetric[] = [];
  if (chrono.length >= 16) {
    const mid = Math.floor(chrono.length / 2);
    const first = chrono.slice(0, mid);
    const second = chrono.slice(mid);

    const wr1 = winRate(first), wr2 = winRate(second);
    trends.push({
      label: "Win rate",
      firstHalf: wr1, secondHalf: wr2,
      change: `${wr2 >= wr1 ? "+" : ""}${(wr2 - wr1).toFixed(1)}pp`,
      improving: wr2 > wr1,
    });
    const ev1 = avgPnl(first), ev2 = avgPnl(second);
    trends.push({
      label: "Expectancy per trade",
      firstHalf: ev1, secondHalf: ev2,
      change: `${ev2 >= ev1 ? "+" : ""}$${(ev2 - ev1).toFixed(2)}`,
      improving: ev2 > ev1,
    });
    const r1 = avgR(first), r2 = avgR(second);
    if (r1 !== null || r2 !== null) {
      const v1 = r1 ?? 0;
      const v2 = r2 ?? 0;
      trends.push({
        label: "Average R multiple",
        firstHalf: v1, secondHalf: v2,
        change: `${v2 >= v1 ? "+" : ""}${(v2 - v1).toFixed(2)}R`,
        improving: (r2 ?? 0) > (r1 ?? 0),
      });
    }
    // Rule compliance trend
    const withRules1 = first.filter((t) => Object.keys(t.rule_compliance).length > 0);
    const withRules2 = second.filter((t) => Object.keys(t.rule_compliance).length > 0);
    if (withRules1.length > 0 && withRules2.length > 0) {
      const rc1 = withRules1.reduce((s, t) => {
        const vals = Object.values(t.rule_compliance);
        return s + (vals.filter(Boolean).length / vals.length) * 100;
      }, 0) / withRules1.length;
      const rc2 = withRules2.reduce((s, t) => {
        const vals = Object.values(t.rule_compliance);
        return s + (vals.filter(Boolean).length / vals.length) * 100;
      }, 0) / withRules2.length;
      trends.push({
        label: "Rule compliance",
        firstHalf: rc1, secondHalf: rc2,
        change: `${rc2 >= rc1 ? "+" : ""}${(rc2 - rc1).toFixed(1)}pp`,
        improving: rc2 > rc1,
      });
    }
  }

  // Current improvement goal (derived from highest-impact weakness)
  const currentImprovementGoal = deriveImprovementGoal(patterns, ruleRefs, worstSetups);

  // Recent recommendations (from patterns, top 3 by confidence * impact)
  const recentRecommendations = patterns
    .filter((p) => p.is_active)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 3)
    .map((p) => p.recommended_action);

  // Discovered patterns as refs
  const patternRefs: PatternRef[] = patterns
    .filter((p) => p.is_active)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 20)
    .map((p) => ({
      patternKey: p.pattern_key,
      label: p.label,
      category: p.category,
      confidenceTier: p.confidence_tier,
      tradeCount: p.trade_count,
      expectancy: p.expectancy,
      netPnl: p.net_pnl,
      recommendedAction: p.recommended_action,
    }));

  return {
    builtAt,
    totalTrades: trades.length,
    closedTrades: closed.length,
    primaryInstruments: instrumentGroups.slice(0, 5),
    preferredSessions: sessionGroups.slice(0, 4),
    favoriteSetups: setupGroups.slice(0, 5),
    bestPerformingSetups: bestSetups,
    worstPerformingSetups: worstSetups,
    tradingStrengths,
    recurringWeaknesses,
    riskPreferences: {
      avgPositionSize: positionSizes.length > 0
        ? positionSizes.reduce((s, q) => s + q, 0) / positionSizes.length
        : 1,
      avgStopSize: stopSizes.length > 0
        ? stopSizes.reduce((s, v) => s + v, 0) / stopSizes.length
        : null,
      avgRRRatio: rrRatios.length > 0
        ? rrRatios.reduce((s, v) => s + v, 0) / rrRatios.length
        : null,
      noStopCount: noStopTrades.length,
      noStopPnl: totalPnl(noStopTrades),
      maxPositionSize: positionSizes.length > 0 ? Math.max(...positionSizes) : 1,
    },
    tradingRules: ruleRefs,
    disciplinePatterns: {
      avgDisciplineScore: withDiscipline.length > 0
        ? withDiscipline.reduce((s, t) => s + (t.discipline_score ?? 0), 0) / withDiscipline.length
        : null,
      highDisciplineTrades: highDisc.length,
      highDisciplineWinRate: winRate(highDisc),
      lowDisciplineTrades: lowDisc.length,
      lowDisciplineWinRate: winRate(lowDisc),
      highDisciplineExpectancy: avgPnl(highDisc),
      lowDisciplineExpectancy: avgPnl(lowDisc),
    },
    psychologicalPatterns: {
      emotionalTradeCount: emotionalTrades.length,
      emotionalPnl: totalPnl(emotionalTrades),
      emotionalWinRate: winRate(emotionalTrades),
      positiveEmotionTrades: positiveEmotionTrades.length,
      positiveEmotionWinRate: winRate(positiveEmotionTrades),
      revengeTrades: revengeTrades.length,
      revengePnl: totalPnl(revengeTrades),
      fomoTrades: fomoTrades.length,
      fomoPnl: totalPnl(fomoTrades),
    },
    currentImprovementGoal,
    recentRecommendations,
    discoveredPatterns: patternRefs,
    performanceTrend: trends,
    edgeDiscoveryReady: patterns.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Improvement goal derivation                                        */
/* ------------------------------------------------------------------ */

function deriveImprovementGoal(
  patterns: DiscoveredPattern[],
  rules: RuleRef[],
  worstSetups: SetupStat[]
): string | null {
  // Priority: behavioral leak with highest impact
  const behavioralLeaks = patterns
    .filter((p) => p.category === "behavioral_leak" && p.is_active)
    .sort((a, b) => Math.abs(b.estimated_pnl_impact) - Math.abs(a.estimated_pnl_impact));

  if (behavioralLeaks.length > 0) {
    return behavioralLeaks[0].recommended_action;
  }

  // Next: most costly rule violation
  const costlyRules = rules
    .filter((r) => r.violatedCount > 0 && r.violatedPnl < 0)
    .sort((a, b) => a.violatedPnl - b.violatedPnl);

  if (costlyRules.length > 0) {
    const r = costlyRules[0];
    return `Stop violating "${r.name}". It has cost you $${Math.abs(r.violatedPnl).toFixed(0)} across ${r.violatedCount} trades.`;
  }

  // Next: worst setup
  if (worstSetups.length > 0) {
    const s = worstSetups[0];
    return `Eliminate ${s.name} from your trade plan — it loses $${Math.abs(s.expectancy).toFixed(0)}/trade across ${s.tradeCount} trades.`;
  }

  // Check for opportunity patterns
  const opportunities = patterns
    .filter((p) => p.category === "opportunity" && p.is_active)
    .sort((a, b) => Math.abs(b.estimated_pnl_impact) - Math.abs(a.estimated_pnl_impact));

  if (opportunities.length > 0) {
    return opportunities[0].recommended_action;
  }

  return null;
}
