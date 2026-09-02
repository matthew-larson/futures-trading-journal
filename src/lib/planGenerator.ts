import type { Trade } from "./types";
import { discoverEdge } from "./edgeDiscovery";
import {
  computeStats,
  computeCurrentStreak,
  ruleBreakdown,
  type ExpectancyStats,
} from "./stats";
import { toNyParts, nyDateString, nyDayName as nyDayNameTz } from "./timezone";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  id: string;
  text: string;
  category: "preparation" | "rules" | "execution" | "psychology";
}

export interface TomorrowsPlan {
  date: string;
  todaySummary: TodaySummary;
  biggestImprovement: ImprovementArea;
  bestSetup: SetupFocus;
  setupsToAvoid: SetupFocus[];
  maxTrades: number;
  bestTimeWindow: TimeWindow;
  psychologyReminder: string;
  highestPriorityRule: PriorityRule;
  confidenceLevel: number;
  sampleNote?: string;
  expectedMarketConditions: MarketConditions;
  checklist: ChecklistItem[];
  hasRealData: boolean;
  tradeCount: number;
}

export interface TodaySummary {
  tradesTaken: number;
  netPnl: number;
  winRate: number;
  expectancy: number;
  streak: { value: number; type: "winning" | "losing" | "none" };
  topStrength: string;
  topWeakness: string;
}

export interface ImprovementArea {
  title: string;
  detail: string;
  estimatedImpact: number;
  action: string;
}

export interface SetupFocus {
  name: string;
  expectancy: number;
  winRate: number;
  tradeCount: number;
  profitFactor: number;
  rationale: string;
}

export interface TimeWindow {
  label: string;
  timeRange: string;
  expectancy: number;
  winRate: number;
  tradeCount: number;
  rationale: string;
}

export interface PriorityRule {
  name: string;
  description: string;
  violationCount: number;
  followedCount: number;
  impact: string;
}

export interface MarketConditions {
  trendBias: string;
  volatility: string;
  sessionFocus: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function netPnl(t: Trade): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return (trades.filter((t) => netPnl(t) > 0).length / trades.length) * 100;
}

function avgPnl(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + netPnl(t), 0) / trades.length;
}

function expectancy(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => netPnl(t) > 0);
  const losses = trades.filter((t) => netPnl(t) < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length)
    : 0;
  const wr = winRate(trades) / 100;
  return wr * avgWin - (1 - wr) * avgLoss;
}

function profitFactor(trades: Trade[]): number {
  const gross = trades.filter((t) => netPnl(t) > 0).reduce((s, t) => s + netPnl(t), 0);
  const loss = Math.abs(trades.filter((t) => netPnl(t) < 0).reduce((s, t) => s + netPnl(t), 0));
  if (loss === 0) return gross > 0 ? 99 : 0;
  return gross / loss;
}

function isSameDay(a: Date, b: Date): boolean {
  return nyDateString(a.toISOString()) === nyDateString(b.toISOString());
}

function startOfDay(d: Date): Date {
  const parts = toNyParts(d.toISOString());
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
}

function entryMinuteOfDay(t: Trade): number {
  return toNyParts(t.entry_time).minuteOfDay;
}

function timeBucketLabel(t: Trade): string {
  const m = entryMinuteOfDay(t);
  if (m < 600) return "Pre-Market";
  if (m < 645) return "NY Open";
  if (m < 720) return "Late Morning";
  if (m < 840) return "Lunch";
  if (m < 960) return "Afternoon";
  return "Evening";
}

function timeRange(label: string): string {
  switch (label) {
    case "Pre-Market": return "Before 10:00";
    case "NY Open": return "10:00 – 10:45";
    case "Late Morning": return "10:45 – 12:00";
    case "Lunch": return "12:00 – 14:00";
    case "Afternoon": return "14:00 – 16:00";
    default: return "16:00+";
  }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
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

function formatEv(n: number): string {
  return `${n >= 0 ? "+" : ""}$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Main generator                                                     */
/* ------------------------------------------------------------------ */

export function generatePlan(trades: Trade[], rules: { id: string; name: string; description: string | null }[]): TomorrowsPlan {
  const closed = trades.filter((t) => t.exit_time !== null);
  const hasRealData = closed.length >= 8;

  if (!hasRealData) {
    return samplePlan(closed.length);
  }

  const stats: ExpectancyStats = computeStats(trades);
  const streak = computeCurrentStreak(trades);
  const edge = discoverEdge(trades);

  /* ---- Today's Summary ---- */
  const today = startOfDay(new Date());
  const todayTrades = closed.filter((t) => isSameDay(new Date(t.entry_time), today));
  const todayNetPnl = todayTrades.reduce((s, t) => s + netPnl(t), 0);
  const todayWinRate = winRate(todayTrades);
  const todayExpectancy = expectancy(todayTrades);

  const topStrength = edge.strengths[0]?.title ?? "No dominant strength detected yet";
  const topWeakness = edge.weaknesses[0]?.title ?? "No critical weakness detected";

  /* ---- Biggest Improvement Area ---- */
  const biggestWeakness = edge.weaknesses.sort(
    (a, b) => Math.abs(b.pnlImpact) - Math.abs(a.pnlImpact)
  )[0];
  const biggestImprovement: ImprovementArea = biggestWeakness
    ? {
        title: biggestWeakness.title,
        detail: biggestWeakness.detail,
        estimatedImpact: Math.abs(biggestWeakness.pnlImpact),
        action: biggestWeakness.recommendation,
      }
    : {
        title: "Maintain your current discipline",
        detail: "No critical weakness detected. Your edge is stable — focus on consistency and gradual position size increases.",
        estimatedImpact: 0,
        action: "Continue your current routine. Look for marginal improvements in entry timing.",
      };

  /* ---- Best Setup To Focus On ---- */
  const allTags = new Set<string>();
  closed.forEach((t) => t.strategy_tags?.forEach((tag) => allTags.add(tag)));
  const setupStats = Array.from(allTags)
    .map((tag) => {
      const ts = closed.filter((t) => t.strategy_tags?.includes(tag));
      return {
        name: tag,
        expectancy: expectancy(ts),
        winRate: winRate(ts),
        tradeCount: ts.length,
        profitFactor: profitFactor(ts),
        trades: ts,
      };
    })
    .filter((s) => s.tradeCount >= 4);

  const bestSetupData = setupStats
    .filter((s) => s.expectancy > 0)
    .sort((a, b) => b.expectancy - a.expectancy)[0];

  const bestSetup: SetupFocus = bestSetupData
    ? {
        name: bestSetupData.name,
        expectancy: bestSetupData.expectancy,
        winRate: bestSetupData.winRate,
        tradeCount: bestSetupData.tradeCount,
        profitFactor: bestSetupData.profitFactor,
        rationale: `Your ${bestSetupData.name} setup produces ${formatEv(bestSetupData.expectancy)}/trade with a ${bestSetupData.winRate.toFixed(0)}% win rate across ${bestSetupData.tradeCount} trades. Profit factor: ${bestSetupData.profitFactor.toFixed(2)}.`,
      }
    : {
        name: "Your highest-grade setup",
        expectancy: stats.expectancy,
        winRate: stats.winRate,
        tradeCount: stats.totalTrades,
        profitFactor: stats.profitFactor === Infinity ? 99 : stats.profitFactor,
        rationale: "No single setup has enough data to isolate. Focus on the setup you execute most consistently and only take A-grade entries.",
      };

  /* ---- Setups To Avoid ---- */
  const setupsToAvoidData = setupStats
    .filter((s) => s.expectancy < 0)
    .sort((a, b) => a.expectancy - b.expectancy)
    .slice(0, 3);

  const setupsToAvoid: SetupFocus[] = setupsToAvoidData.map((s) => ({
    name: s.name,
    expectancy: s.expectancy,
    winRate: s.winRate,
    tradeCount: s.tradeCount,
    profitFactor: s.profitFactor,
    rationale: `This setup loses ${formatMoney(Math.abs(s.expectancy))}/trade across ${s.tradeCount} trades with a ${s.winRate.toFixed(0)}% win rate. Avoid until you've reviewed and revised your entry criteria.`,
  }));

  /* ---- Max Trades ---- */
  // Based on historical daily trade count distribution and win rate
  const dailyCounts = new Map<string, number>();
  for (const t of closed) {
    const key = nyDateString(t.entry_time);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const dailyCountValues = Array.from(dailyCounts.values());
  const avgDailyTrades = dailyCountValues.length
    ? dailyCountValues.reduce((s, n) => s + n, 0) / dailyCountValues.length
    : 3;
  // Find the trade count threshold where expectancy stays positive
  const bestDailyCount = dailyCountValues.length
    ? (() => {
        const byCount = new Map<number, number[]>();
        for (const [day, count] of dailyCounts) {
          const dayPnl = closed
            .filter((t) => isSameDay(new Date(t.entry_time), new Date(day)))
            .reduce((s, t) => s + netPnl(t), 0);
          const arr = byCount.get(count) ?? [];
          arr.push(dayPnl);
          byCount.set(count, arr);
        }
        const stats = Array.from(byCount.entries()).map(([count, pnls]) => ({
          count,
          avg: pnls.reduce((s, p) => s + p, 0) / pnls.length,
        }));
        const positive = stats.filter((s) => s.avg > 0).sort((a, b) => b.avg - a.avg);
        return positive[0]?.count ?? Math.max(2, Math.round(avgDailyTrades));
      })()
    : 3;
  const maxTrades = Math.max(2, Math.min(6, bestDailyCount));

  /* ---- Best Time Window ---- */
  const timeGroups = Array.from(groupBy(closed, timeBucketLabel).entries())
    .map(([label, ts]) => ({
      label,
      timeRange: timeRange(label),
      expectancy: expectancy(ts),
      winRate: winRate(ts),
      tradeCount: ts.length,
    }))
    .filter((g) => g.tradeCount >= 4)
    .sort((a, b) => b.expectancy - a.expectancy);

  const bestTime = timeGroups[0];
  const bestTimeWindow: TimeWindow = bestTime
    ? {
        label: bestTime.label,
        timeRange: bestTime.timeRange,
        expectancy: bestTime.expectancy,
        winRate: bestTime.winRate,
        tradeCount: bestTime.tradeCount,
        rationale: `During ${bestTime.label} (${bestTime.timeRange}) you average ${formatEv(bestTime.expectancy)}/trade with a ${bestTime.winRate.toFixed(0)}% win rate across ${bestTime.tradeCount} trades.`,
      }
    : {
        label: "NY Open",
        timeRange: "10:00 – 10:45",
        expectancy: stats.expectancy,
        winRate: stats.winRate,
        tradeCount: stats.totalTrades,
        rationale: "Focus on the opening 45 minutes when volume and momentum are highest. This is when most retail edges appear.",
      };

  /* ---- Psychology Reminder ---- */
  let psychologyReminder: string;
  if (streak.type === "losing" && streak.value >= 2) {
    psychologyReminder = `You're on a ${streak.value}-trade losing streak. Tomorrow is a fresh start — trade smaller, take only your highest-grade setups, and remember: one good day erases two bad ones. The goal is not to make it back, it's to trade well.`;
  } else if (streak.type === "winning" && streak.value >= 3) {
    psychologyReminder = `You're on a ${streak.value}-trade winning streak. Stay humble — winning streaks breed overconfidence. Stick to your normal position size and don't loosen your entry criteria. Confidence is good; complacency is expensive.`;
  } else if (stats.winRate < 40) {
    psychologyReminder = "Your win rate is below 40%. Focus on trade quality over quantity — wait for setups that meet every criterion. One A-grade trade is worth more than three C-grade ones.";
  } else if (todayNetPnl < 0) {
    psychologyReminder = "Today was a red day. Before tomorrow's session, review your losing trades without judgment — what did the market tell you that you didn't hear? Come back with a clear head and a smaller size.";
  } else {
    psychologyReminder = "Your discipline is solid. Tomorrow, focus on presence — be fully engaged for each setup and avoid autopilot. The best traders trade less and see more.";
  }

  /* ---- Highest Priority Rule ---- */
  const breakdown = ruleBreakdown(trades, rules as never);
  const mostViolated = breakdown
    .filter((b) => b.total >= 3 && b.violated > 0)
    .sort((a, b) => b.violated - a.violated)[0];

  const highestPriorityRule: PriorityRule = mostViolated
    ? {
        name: mostViolated.rule.name,
        description: mostViolated.rule.description ?? "",
        violationCount: mostViolated.violated,
        followedCount: mostViolated.followed,
        impact: `You've violated this rule ${mostViolated.violated} time${mostViolated.violated === 1 ? "" : "s"} out of ${mostViolated.total} applicable trades. Following it consistently is your highest-leverage discipline fix.`,
      }
    : {
        name: "Follow your trading plan",
        description: "Enter only when all criteria are met. No exceptions.",
        violationCount: 0,
        followedCount: 0,
        impact: "No specific rule violations detected. Your highest priority is maintaining this standard — do not let consistency slip.",
      };

  /* ---- Confidence Level ---- */
  const tradeCount = closed.length;
  let confidence: number;
  if (tradeCount >= 100) confidence = 90;
  else if (tradeCount >= 50) confidence = 80;
  else if (tradeCount >= 30) confidence = 68;
  else if (tradeCount >= 20) confidence = 55;
  else if (tradeCount >= 10) confidence = 42;
  else confidence = 30;
  // Adjust based on consistency
  if (stats.profitFactor >= 1.5) confidence = Math.min(95, confidence + 8);
  if (stats.profitFactor < 1.0) confidence = Math.max(20, confidence - 10);
  if (streak.type === "losing" && streak.value >= 3) confidence = Math.max(20, confidence - 8);

  /* ---- Sample-size note ---- */
  const sampleNote =
    tradeCount < 10
      ? `This plan is based on ${tradeCount} trades — a small sample. Treat recommendations as tentative hypotheses, not confirmed patterns. Log at least 20 trades for more reliable guidance.`
      : tradeCount < 20
        ? `This plan is based on ${tradeCount} trades. Patterns are emerging but not yet statistically robust. Continue logging trades to strengthen these insights.`
        : `Based on ${tradeCount} trades.`;

  /* ---- Expected Market Conditions (placeholder) ---- */
  const dayOfWeek = new Date(tomorrowDate()).getDay();
  const expectedMarketConditions: MarketConditions = {
    trendBias: "Confirm at open — check overnight session and pre-market futures.",
    volatility: "Monitor VIX and ATR. Adjust position size if volatility expands.",
    sessionFocus: bestTimeWindow.label,
    notes: dayOfWeek === 1 || dayOfWeek === 5
      ? "Monday/Friday — be aware of weekend risk and position bias."
      : "Mid-week — typically the most trending sessions.",
  };

  /* ---- Checklist ---- */
  const checklist: ChecklistItem[] = [
    // Preparation
    { id: "chk-1", text: `Review ${bestSetup.name} setup examples from past winners`, category: "preparation" },
    { id: "chk-2", text: "Check overnight session and pre-market levels", category: "preparation" },
    { id: "chk-3", text: "Define invalidation levels for each potential setup", category: "preparation" },
    // Rules
    { id: "chk-4", text: `Priority rule: ${highestPriorityRule.name}`, category: "rules" },
    { id: "chk-5", text: `Max ${maxTrades} trades for the session`, category: "rules" },
    ...setupsToAvoid.slice(0, 2).map((s, i) => ({
      id: `chk-avoid-${i}`,
      text: `Skip ${s.name} setups`,
      category: "rules" as const,
    })),
    // Execution
    { id: "chk-6", text: `Only trade during ${bestTimeWindow.label} (${bestTimeWindow.timeRange})`, category: "execution" },
    { id: "chk-7", text: "Wait for A-grade entries only — no forcing", category: "execution" },
    { id: "chk-8", text: "Set stop and target before entry — no adjustments after", category: "execution" },
    // Psychology
    { id: "chk-9", text: "Pre-session meditation or breathing exercise (3 min)", category: "psychology" },
    { id: "chk-10", text: psychologyReminder, category: "psychology" },
  ];

  if (streak.type === "losing" && streak.value >= 2) {
    checklist.push({
      id: "chk-streak",
      text: `After 2 consecutive losses, stop trading for the day`,
      category: "psychology",
    });
  }

  return {
    date: tomorrowDate(),
    todaySummary: {
      tradesTaken: todayTrades.length,
      netPnl: todayNetPnl,
      winRate: todayWinRate,
      expectancy: todayExpectancy,
      streak,
      topStrength,
      topWeakness,
    },
    biggestImprovement,
    bestSetup,
    setupsToAvoid,
    maxTrades,
    bestTimeWindow,
    psychologyReminder,
    highestPriorityRule,
    confidenceLevel: confidence,
    sampleNote,
    expectedMarketConditions,
    checklist,
    hasRealData: true,
    tradeCount,
  };
}

/* ------------------------------------------------------------------ */
/* Sample plan (insufficient data)                                    */
/* ------------------------------------------------------------------ */

function samplePlan(currentCount: number): TomorrowsPlan {
  return {
    date: tomorrowDate(),
    todaySummary: {
      tradesTaken: 0,
      netPnl: 0,
      winRate: 0,
      expectancy: 0,
      streak: { value: 0, type: "none" },
      topStrength: "Sample — 72% win rate on Liquidity Sweep setups (illustrative)",
      topWeakness: "Sample — Lunch session expectancy is -0.7R (illustrative)",
    },
    biggestImprovement: {
      title: "[Sample] Lunch session expectancy is -0.7R",
      detail: "This is an illustrative example of what your plan will look like. Once you log 8+ trades, this will show your real highest-impact improvement area. Example: between 12:00–14:00, 12 trades averaged -0.7R with a 33% win rate.",
      estimatedImpact: 840,
      action: "Log at least 8 closed trades to unlock your personalized improvement area based on your actual trading data.",
    },
    bestSetup: {
      name: "Trend Pullback (sample)",
      expectancy: 187,
      winRate: 68,
      tradeCount: 22,
      profitFactor: 2.4,
      rationale: "Illustrative example — your real plan will show actual setup stats once you have 8+ trades logged.",
    },
    setupsToAvoid: [
      {
        name: "VWAP Reversal (sample)",
        expectancy: -94,
        winRate: 35,
        tradeCount: 11,
        profitFactor: 0.6,
        rationale: "Illustrative example — your real plan will identify setups to avoid from your actual trade history.",
      },
      {
        name: "News Trade (sample)",
        expectancy: -72,
        winRate: 28,
        tradeCount: 8,
        profitFactor: 0.4,
        rationale: "Illustrative example — once you have enough data, this will show your real worst-performing setups.",
      },
    ],
    maxTrades: 3,
    bestTimeWindow: {
      label: "NY Open",
      timeRange: "10:00 – 10:45",
      expectancy: 214,
      winRate: 71,
      tradeCount: 18,
      rationale: "Illustrative example — your real plan will identify your actual best time window from your trade data.",
    },
    psychologyReminder: "Your discipline is solid. Tomorrow, focus on presence — be fully engaged for each setup and avoid autopilot. The best traders trade less and see more.",
    highestPriorityRule: {
      name: "Wait for confirmation before entering",
      description: "Wait for your setup to confirm before entering. Do not anticipate.",
      violationCount: 7,
      followedCount: 15,
      impact: "Illustrative example — once you log trades with rule compliance, this will show your real most-violated rule.",
    },
    confidenceLevel: 0,
    expectedMarketConditions: {
      trendBias: "Confirm at open — check overnight session and pre-market futures.",
      volatility: "Monitor VIX and ATR. Adjust position size if volatility expands.",
      sessionFocus: "NY Open",
      notes: "Mid-week — typically the most trending sessions.",
    },
    checklist: [
      { id: "s-1", text: "Review Trend Pullback setup examples from past winners", category: "preparation" },
      { id: "s-2", text: "Check overnight session and pre-market levels", category: "preparation" },
      { id: "s-3", text: "Define invalidation levels for each potential setup", category: "preparation" },
      { id: "s-4", text: "Priority rule: Wait for confirmation before entering", category: "rules" },
      { id: "s-5", text: "Max 3 trades for the session", category: "rules" },
      { id: "s-6", text: "Skip VWAP Reversal setups", category: "rules" },
      { id: "s-7", text: "Skip News Trade setups", category: "rules" },
      { id: "s-8", text: "Only trade during NY Open (10:00 – 10:45)", category: "execution" },
      { id: "s-9", text: "Wait for A-grade entries only — no forcing", category: "execution" },
      { id: "s-10", text: "Set stop and target before entry — no adjustments after", category: "execution" },
      { id: "s-11", text: "Pre-session meditation or breathing exercise (3 min)", category: "psychology" },
      { id: "s-12", text: "Your discipline is solid. Tomorrow, focus on presence — be fully engaged for each setup and avoid autopilot.", category: "psychology" },
    ],
    hasRealData: false,
    tradeCount: currentCount,
  };
}
