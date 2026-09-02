import type { Trade, DisciplineKey } from "./types";
import { toNyParts, nyDayName as nyDayNameTz } from "./timezone";
import { getMultiplier } from "./contracts";

/* ------------------------------------------------------------------ */
/* Report types                                                        */
/* ------------------------------------------------------------------ */

export interface MetricInsight {
  label: string;
  tradeCount: number;
  winRate: number;
  expectancy: number;
  avgR: number | null;
  totalPnl: number;
  confidence: number;
  sufficientData: boolean;
}

export interface DirectionalInsight {
  long: MetricInsight;
  short: MetricInsight;
  edge: "long" | "short" | "neutral";
  expectancyDifference: number;
  confidence: number;
  sufficientData: boolean;
}

export interface WinLossInsight {
  avgWinner: number;
  avgLoser: number;
  winnerCount: number;
  loserCount: number;
  payoffRatio: number;
  confidence: number;
  sufficientData: boolean;
}

export interface RuleComplianceInsight {
  followedRate: number;
  followedCount: number;
  totalCount: number;
  followedExpectancy: number;
  violatedExpectancy: number;
  confidence: number;
  sufficientData: boolean;
}

export interface MistakeInsight {
  label: string;
  tradeCount: number;
  totalPnl: number;
  avgPnl: number;
  confidence: number;
  sufficientData: boolean;
}

export interface OpportunityInsight {
  title: string;
  description: string;
  behavior: string;
  tradeCount: number;
  pnlLost: number;
  pnlImprovementPct: number;
  confidence: number;
  sufficientData: boolean;
}

export interface FocusInsight {
  recommendation: string;
  rationale: string;
  confidence: number;
}

export interface EdgeReport {
  totalTrades: number;
  hasSufficientData: boolean;
  insufficientNote: string | null;
  bestSetup: MetricInsight | null;
  worstSetup: MetricInsight | null;
  bestTime: MetricInsight | null;
  worstTime: MetricInsight | null;
  bestInstrument: MetricInsight | null;
  longVsShort: DirectionalInsight | null;
  avgWinnerVsLoser: WinLossInsight | null;
  mostExpensiveMistake: MistakeInsight | null;
  ruleCompliance: RuleComplianceInsight | null;
  bestDay: MetricInsight | null;
  worstDay: MetricInsight | null;
  biggestOpportunity: OpportunityInsight | null;
  focus: FocusInsight | null;
}

/* ------------------------------------------------------------------ */
/* Math helpers                                                        */
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

function confidenceScore(tradeCount: number, minSample: number = 5): number {
  if (tradeCount >= 50) return 95;
  if (tradeCount >= 30) return 88;
  if (tradeCount >= 20) return 80;
  if (tradeCount >= 15) return 72;
  if (tradeCount >= 10) return 65;
  if (tradeCount >= 7) return 55;
  if (tradeCount >= 5) return 48;
  return Math.max(15, Math.round((tradeCount / minSample) * 40));
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const list = map.get(keyFn(item)) ?? [];
    list.push(item);
    map.set(keyFn(item), list);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Dimension extractors                                                */
/* ------------------------------------------------------------------ */

function setupLabel(t: Trade): string {
  if (t.strategy_tags && t.strategy_tags.length > 0) return t.strategy_tags[0];
  return t.setup ?? "Unspecified";
}

function timeBucket(t: Trade): string {
  const m = toNyParts(t.entry_time).minuteOfDay;
  if (m < 600) return "Pre-Market (before 10:00)";
  if (m < 645) return "NY Open (10:00–10:45)";
  if (m < 720) return "Late Morning (10:45–12:00)";
  if (m < 840) return "Lunch (12:00–14:00)";
  if (m < 960) return "Afternoon (14:00–16:00)";
  return "Evening (after 16:00)";
}

function dayName(t: Trade): string {
  return nyDayNameTz(t.entry_time);
}

const MISTAKE_KEYWORDS: { label: string; words: string[] }[] = [
  { label: "Revenge trading", words: ["revenge", "tilt", "angry", "frustrat"] },
  { label: "Chasing / FOMO", words: ["chase", "chased", "fomo", "impulsive"] },
  { label: "Oversized position", words: ["size", "too big", "oversized", "heavy", "overleverag"] },
  { label: "Early exit", words: ["early exit", "cut winner", "too soon", "premature"] },
  { label: "Late entry", words: ["late entry", "missed entry", "entered late"] },
  { label: "No confirmation", words: ["no confirmation", "didn't wait", "did not wait", "impatient"] },
  { label: "No stop / moved stop", words: ["no stop", "removed stop", "moved stop", "widened stop"] },
  { label: "Countertrend", words: ["counter", "against trend", "fighting the trend"] },
  { label: "Overtrading", words: ["overtrade", "too many", "excessive", "overtrading"] },
];

function mistakeCategory(t: Trade): string | null {
  const text = (t.mistakes ?? "").toLowerCase();
  if (text) {
    for (const cat of MISTAKE_KEYWORDS) {
      if (cat.words.some((w) => text.includes(w))) return cat.label;
    }
    if (text.length > 3) return "Other mistake";
  }
  for (const [key, val] of Object.entries(t.discipline_checks ?? {})) {
    if (val === false) {
      const map: Record<DisciplineKey, string> = {
        waited_for_confirmation: "No confirmation",
        risk_under_plan: "Oversized position",
        traded_plan_hours: "Trading outside plan hours",
        did_not_chase: "Chasing / FOMO",
        did_not_revenge_trade: "Revenge trading",
        held_winner_correctly: "Early exit",
        exited_per_plan: "Exited against plan",
      };
      return map[key as DisciplineKey] ?? null;
    }
  }
  return null;
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
/* Metric builders                                                     */
/* ------------------------------------------------------------------ */

const MIN_SAMPLE = 3;
const SUFFICIENT_SAMPLE = 5;

function toMetric(label: string, trades: Trade[]): MetricInsight {
  return {
    label,
    tradeCount: trades.length,
    winRate: winRate(trades),
    expectancy: avgPnl(trades),
    avgR: avgR(trades),
    totalPnl: totalPnl(trades),
    confidence: confidenceScore(trades.length),
    sufficientData: trades.length >= SUFFICIENT_SAMPLE,
  };
}

function bestAndWorst(
  trades: Trade[],
  keyFn: (t: Trade) => string
): { best: MetricInsight | null; worst: MetricInsight | null } {
  const groups = Array.from(groupBy(trades, keyFn).entries())
    .filter(([, ts]) => ts.length >= MIN_SAMPLE)
    .map(([label, ts]) => toMetric(label, ts));

  if (groups.length === 0) return { best: null, worst: null };

  const best = groups.reduce((a, b) => (b.expectancy > a.expectancy ? b : a));
  const worst = groups.reduce((a, b) => (b.expectancy < a.expectancy ? b : a));
  return { best, worst };
}

/* ------------------------------------------------------------------ */
/* Biggest opportunity detector                                        */
/* ------------------------------------------------------------------ */

interface OpportunityCandidate {
  behavior: string;
  trades: Trade[];
  pnlLost: number;
  description: string;
}

function findBiggestOpportunity(
  closed: Trade[],
  report: Omit<EdgeReport, "biggestOpportunity" | "focus">,
  overallPnl: number
): OpportunityInsight | null {
  const candidates: OpportunityCandidate[] = [];

  if (report.worstSetup && report.worstSetup.totalPnl < 0) {
    const ts = closed.filter((t) => setupLabel(t) === report.worstSetup!.label);
    candidates.push({
      behavior: report.worstSetup.label,
      trades: ts,
      pnlLost: Math.abs(report.worstSetup.totalPnl),
      description: `Your ${report.worstSetup.label} trades lost ${formatMoney(report.worstSetup.totalPnl)} across ${report.worstSetup.tradeCount} trades.`,
    });
  }
  if (report.worstTime && report.worstTime.totalPnl < 0) {
    const ts = closed.filter((t) => timeBucket(t) === report.worstTime!.label);
    candidates.push({
      behavior: report.worstTime.label,
      trades: ts,
      pnlLost: Math.abs(report.worstTime.totalPnl),
      description: `Trading during ${report.worstTime.label} cost you ${formatMoney(report.worstTime.totalPnl)} across ${report.worstTime.tradeCount} trades.`,
    });
  }
  if (report.worstDay && report.worstDay.totalPnl < 0) {
    const ts = closed.filter((t) => dayName(t) === report.worstDay!.label);
    candidates.push({
      behavior: report.worstDay.label,
      trades: ts,
      pnlLost: Math.abs(report.worstDay.totalPnl),
      description: `Trading on ${report.worstDay.label}s lost ${formatMoney(report.worstDay.totalPnl)} across ${report.worstDay.tradeCount} trades.`,
    });
  }
  if (report.bestInstrument && report.worstSetup === null) {
    // skip — handled by worstSetup
  }
  // Countertrend
  const counter = closed.filter((t) => isTrendAligned(t) === false);
  if (counter.length >= MIN_SAMPLE && totalPnl(counter) < 0) {
    candidates.push({
      behavior: "countertrend trades",
      trades: counter,
      pnlLost: Math.abs(totalPnl(counter)),
      description: `You lost ${formatMoney(totalPnl(counter))} from ${counter.length} countertrend trades.`,
    });
  }
  // After consecutive losses
  const chrono = [...closed].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());
  const afterLosses: Trade[] = [];
  let consecLoss = 0;
  for (const t of chrono) {
    if (consecLoss >= 2) afterLosses.push(t);
    if (netPnl(t) > 0) consecLoss = 0;
    else if (netPnl(t) < 0) consecLoss++;
  }
  if (afterLosses.length >= MIN_SAMPLE && totalPnl(afterLosses) < 0) {
    candidates.push({
      behavior: "trades after 2+ consecutive losses",
      trades: afterLosses,
      pnlLost: Math.abs(totalPnl(afterLosses)),
      description: `Trades taken after 2+ consecutive losses lost ${formatMoney(totalPnl(afterLosses))} across ${afterLosses.length} instances — a measurable tilt pattern.`,
    });
  }
  // Most expensive mistake
  if (report.mostExpensiveMistake && report.mostExpensiveMistake.totalPnl < 0) {
    candidates.push({
      behavior: report.mostExpensiveMistake.label,
      trades: closed.filter((t) => mistakeCategory(t) === report.mostExpensiveMistake!.label),
      pnlLost: Math.abs(report.mostExpensiveMistake.totalPnl),
      description: `Your ${report.mostExpensiveMistake.label.toLowerCase()} cost ${formatMoney(report.mostExpensiveMistake.totalPnl)} across ${report.mostExpensiveMistake.tradeCount} trades.`,
    });
  }

  if (candidates.length === 0) return null;

  // Pick the one with the largest absolute P&L loss
  const top = candidates.reduce((a, b) => (b.pnlLost > a.pnlLost ? b : a));
  if (top.trades.length < MIN_SAMPLE) return null;

  const withoutBehavior = closed.filter((t) => !top.trades.includes(t));
  const improvedPnl = overallPnl + top.pnlLost;
  const improvementPct = overallPnl !== 0
    ? Math.round((top.pnlLost / Math.abs(overallPnl)) * 100)
    : 0;

  const sufficient = top.trades.length >= SUFFICIENT_SAMPLE;
  return {
    title: `Eliminating ${top.behavior} was associated with approximately ${improvementPct}% better net P&L`,
    description: `${top.description} Trades without this behavior outperformed those with it by approximately ${improvementPct}% during this period. This is an observational association, not proof of causation.`,
    behavior: top.behavior,
    tradeCount: top.trades.length,
    pnlLost: Math.round(top.pnlLost),
    pnlImprovementPct: improvementPct,
    confidence: confidenceScore(top.trades.length),
    sufficientData: sufficient,
  };
}

/* ------------------------------------------------------------------ */
/* #1 Focus derivation                                                 */
/* ------------------------------------------------------------------ */

function deriveFocus(
  report: Omit<EdgeReport, "focus">,
  closed: Trade[]
): FocusInsight {
  const opp = report.biggestOpportunity;
  if (opp && opp.sufficientData) {
    return {
      recommendation: `Eliminate ${opp.behavior} from your next session.`,
      rationale: `Your data shows ${opp.behavior} was associated with ${formatMoney(-opp.pnlLost)} in losses across ${opp.tradeCount} trades. Avoiding this behavior was associated with approximately ~${opp.pnlImprovementPct}% better net P&L. This is an observational association.`,
      confidence: opp.confidence,
    };
  }
  if (report.worstSetup && report.worstSetup.sufficientData) {
    return {
      recommendation: `Stop trading ${report.worstSetup.label} for your next 5 sessions.`,
      rationale: `${report.worstSetup.label} has a ${report.worstSetup.winRate.toFixed(0)}% win rate and ${formatMoney(report.worstSetup.expectancy)}/trade expectancy across ${report.worstSetup.tradeCount} trades. This is an observational pattern — your capital may be better deployed elsewhere.`,
      confidence: report.worstSetup.confidence,
    };
  }
  if (report.worstTime && report.worstTime.sufficientData) {
    return {
      recommendation: `Do not trade during ${report.worstTime.label} for your next 5 sessions.`,
      rationale: `This window has a ${formatMoney(report.worstTime.expectancy)}/trade expectancy across ${report.worstTime.tradeCount} trades. Avoiding it is the fastest way to protect your capital.`,
      confidence: report.worstTime.confidence,
    };
  }
  if (report.mostExpensiveMistake && report.mostExpensiveMistake.sufficientData) {
    return {
      recommendation: `Eliminate ${report.mostExpensiveMistake.label.toLowerCase()} from your next session.`,
      rationale: `This recurring mistake cost ${formatMoney(report.mostExpensiveMistake.totalPnl)} across ${report.mostExpensiveMistake.tradeCount} trades — your most expensive behavioral pattern.`,
      confidence: report.mostExpensiveMistake.confidence,
    };
  }
  if (report.ruleCompliance && !report.ruleCompliance.sufficientData) {
    return {
      recommendation: `Log your next 10 trades with full discipline checks to unlock a precise behavioral recommendation.`,
      rationale: `You need at least ${SUFFICIENT_SAMPLE} trades with discipline data to identify your highest-impact behavioral fix. Every insight in this report is backed by real trade data — more data means sharper guidance.`,
      confidence: 30,
    };
  }
  return {
    recommendation: `Focus on logging every trade with complete data — setup, session, mistakes, and discipline checks.`,
    rationale: `More complete data unlocks sharper pattern detection. Every insight in this report is backed by real trade data, not assumptions.`,
    confidence: 30,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function formatMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/* ------------------------------------------------------------------ */
/* Main report generator                                               */
/* ------------------------------------------------------------------ */

export function generateEdgeReport(trades: Trade[]): EdgeReport {
  const closed = trades.filter((t) => t.exit_time !== null && t.pnl !== null);
  const totalTrades = closed.length;
  const overallPnl = totalPnl(closed);

  const hasSufficientData = totalTrades >= 8;
  if (!hasSufficientData) {
    return {
      totalTrades,
      hasSufficientData: false,
      insufficientNote: `You have ${totalTrades} closed trade${totalTrades === 1 ? "" : "s"}. At least 8 closed trades are needed for statistically meaningful pattern detection. The insights below are based on limited data — interpret them with caution.`,
      bestSetup: null,
      worstSetup: null,
      bestTime: null,
      worstTime: null,
      bestInstrument: null,
      longVsShort: null,
      avgWinnerVsLoser: null,
      mostExpensiveMistake: null,
      ruleCompliance: null,
      bestDay: null,
      worstDay: null,
      biggestOpportunity: null,
      focus: null,
    };
  }

  // Best / worst setup
  const setups = bestAndWorst(closed, setupLabel);
  // Best / worst time
  const times = bestAndWorst(closed, timeBucket);
  // Best / worst day
  const days = bestAndWorst(closed, dayName);
  // Best instrument
  const instruments = bestAndWorst(closed, (t) => t.instrument);
  const bestInstrument = instruments.best;

  // Long vs short
  const longs = closed.filter((t) => t.direction === "long");
  const shorts = closed.filter((t) => t.direction === "short");
  let longVsShort: DirectionalInsight | null = null;
  if (longs.length >= MIN_SAMPLE && shorts.length >= MIN_SAMPLE) {
    const longMetric = toMetric("Long", longs);
    const shortMetric = toMetric("Short", shorts);
    const diff = longMetric.expectancy - shortMetric.expectancy;
    longVsShort = {
      long: longMetric,
      short: shortMetric,
      edge: Math.abs(diff) < Math.abs(avgPnl(closed)) * 0.15 ? "neutral" : (diff > 0 ? "long" : "short"),
      expectancyDifference: diff,
      confidence: confidenceScore(Math.min(longs.length, shorts.length)),
      sufficientData: longs.length >= SUFFICIENT_SAMPLE && shorts.length >= SUFFICIENT_SAMPLE,
    };
  }

  // Average winner vs average loser
  const winners = closed.filter((t) => netPnl(t) > 0);
  const losers = closed.filter((t) => netPnl(t) < 0);
  let avgWinnerVsLoser: WinLossInsight | null = null;
  if (winners.length >= MIN_SAMPLE && losers.length >= MIN_SAMPLE) {
    const avgWin = avgPnl(winners);
    const avgLoss = Math.abs(avgPnl(losers));
    avgWinnerVsLoser = {
      avgWinner: avgWin,
      avgLoser: -avgLoss,
      winnerCount: winners.length,
      loserCount: losers.length,
      payoffRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
      confidence: confidenceScore(winners.length + losers.length),
      sufficientData: winners.length >= SUFFICIENT_SAMPLE && losers.length >= SUFFICIENT_SAMPLE,
    };
  }

  // Most expensive recurring mistake
  let mostExpensiveMistake: MistakeInsight | null = null;
  const mistakeGroups = Array.from(groupBy(closed, (t) => mistakeCategory(t) ?? "__none__").entries())
    .filter(([label, ts]) => label !== "__none__" && ts.length >= MIN_SAMPLE);
  if (mistakeGroups.length > 0) {
    const ranked = mistakeGroups
      .map(([label, ts]) => ({
        label,
        tradeCount: ts.length,
        totalPnl: totalPnl(ts),
        avgPnl: avgPnl(ts),
        confidence: confidenceScore(ts.length),
        sufficientData: ts.length >= SUFFICIENT_SAMPLE,
      }))
      .sort((a, b) => a.totalPnl - b.totalPnl); // most negative first
    mostExpensiveMistake = ranked[0];
  }

  // Rule compliance
  let ruleCompliance: RuleComplianceInsight | null = null;
  const withRules = closed.filter((t) => t.rule_compliance && Object.keys(t.rule_compliance).length > 0);
  if (withRules.length >= MIN_SAMPLE) {
    let followed = 0;
    let total = 0;
    const followedTrades: Trade[] = [];
    const violatedTrades: Trade[] = [];
    for (const t of withRules) {
      let tradeFollowed = true;
      for (const [, compliant] of Object.entries(t.rule_compliance)) {
        total++;
        if (compliant) followed++;
        else tradeFollowed = false;
      }
      if (tradeFollowed) followedTrades.push(t);
      else violatedTrades.push(t);
    }
    const followedRate = total > 0 ? (followed / total) * 100 : 0;
    ruleCompliance = {
      followedRate,
      followedCount: followed,
      totalCount: total,
      followedExpectancy: followedTrades.length > 0 ? avgPnl(followedTrades) : 0,
      violatedExpectancy: violatedTrades.length > 0 ? avgPnl(violatedTrades) : 0,
      confidence: confidenceScore(withRules.length),
      sufficientData: withRules.length >= SUFFICIENT_SAMPLE,
    };
  }

  // Build partial report for opportunity detection
  const partial: Omit<EdgeReport, "biggestOpportunity" | "focus"> = {
    totalTrades,
    hasSufficientData: true,
    insufficientNote: null,
    bestSetup: setups.best,
    worstSetup: setups.worst,
    bestTime: times.best,
    worstTime: times.worst,
    bestInstrument,
    longVsShort,
    avgWinnerVsLoser,
    mostExpensiveMistake,
    ruleCompliance,
    bestDay: days.best,
    worstDay: days.worst,
  };

  const biggestOpportunity = findBiggestOpportunity(closed, partial, overallPnl);
  const reportWithOpp: EdgeReport = { ...partial, biggestOpportunity, focus: null };
  const focus = deriveFocus(reportWithOpp, closed);

  return { ...reportWithOpp, focus };
}
