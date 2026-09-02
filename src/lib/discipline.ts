import type {
  Trade,
  DisciplineChecks,
  DisciplineKey,
  DisciplineScoreResult,
  PeriodScore,
  Achievement,
  DISCIPLINE_RULES as _DR,
} from "./types";
import { DISCIPLINE_RULES } from "./types";
import { nyDateString, nyDayName as nyDayNameTz } from "./timezone";

const MAX_WEIGHT = DISCIPLINE_RULES.reduce((s, r) => s + r.weight, 0); // 100

export function scoreTradeDiscipline(
  checks: DisciplineChecks
): DisciplineScoreResult {
  const evaluated = DISCIPLINE_RULES.filter((r) => r.key in checks);
  if (evaluated.length === 0) {
    return { score: null, followed: 0, total: 0, checks };
  }
  const earned = evaluated.reduce((sum, r) => {
    return sum + (checks[r.key] === true ? r.weight : 0);
  }, 0);
  const total = evaluated.reduce((sum, r) => sum + r.weight, 0);
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const followed = evaluated.filter((r) => checks[r.key] === true).length;
  return { score, followed, total: evaluated.length, checks };
}

export function tradeDisciplineScore(trade: Trade): number | null {
  if (trade.discipline_score !== null && trade.discipline_score !== undefined) {
    return trade.discipline_score;
  }
  const checks = trade.discipline_checks ?? {};
  const result = scoreTradeDiscipline(checks);
  return result.score;
}

export function isPerfectTrade(trade: Trade): boolean {
  const checks = trade.discipline_checks ?? {};
  const evaluated = DISCIPLINE_RULES.filter((r) => r.key in checks);
  if (evaluated.length < 5) return false; // need most checks evaluated
  return evaluated.every((r) => checks[r.key] === true);
}

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function dateKey(d: Date): string {
  return nyDateString(d.toISOString());
}

function getScoredTrades(trades: Trade[]): { trade: Trade; score: number }[] {
  return trades
    .filter((t) => t.exit_time !== null)
    .map((t) => ({ trade: t, score: tradeDisciplineScore(t) }))
    .filter((s) => s.score !== null) as { trade: Trade; score: number }[];
}

export function computeDailyDiscipline(trades: Trade[], days = 14): PeriodScore[] {
  const scored = getScoredTrades(trades);
  const now = new Date();
  const result: PeriodScore[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const key = dateKey(day);
    const dayTrades = scored.filter(
      (s) => dateKey(new Date(s.trade.entry_time)) === key
    );
    if (dayTrades.length === 0) {
      result.push({ label: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), score: 0, tradeCount: 0, perfectCount: 0 });
      continue;
    }
    const avg = Math.round(dayTrades.reduce((s, t) => s + t.score, 0) / dayTrades.length);
    const perfect = dayTrades.filter((s) => isPerfectTrade(s.trade)).length;
    result.push({
      label: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      score: avg,
      tradeCount: dayTrades.length,
      perfectCount: perfect,
    });
  }
  return result;
}

export function computeWeeklyDiscipline(trades: Trade[], weeks = 8): PeriodScore[] {
  const scored = getScoredTrades(trades);
  const now = new Date();
  const result: PeriodScore[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - w * 7);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekTrades = scored.filter((s) => {
      const d = new Date(s.trade.entry_time);
      return d >= weekStart && d <= weekEnd;
    });
    if (weekTrades.length === 0) {
      result.push({ label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: 0, tradeCount: 0, perfectCount: 0 });
      continue;
    }
    const avg = Math.round(weekTrades.reduce((s, t) => s + t.score, 0) / weekTrades.length);
    const perfect = weekTrades.filter((s) => isPerfectTrade(s.trade)).length;
    result.push({
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: avg,
      tradeCount: weekTrades.length,
      perfectCount: perfect,
    });
  }
  return result;
}

export function computeMonthlyDiscipline(trades: Trade[], months = 6): PeriodScore[] {
  const scored = getScoredTrades(trades);
  const now = new Date();
  const result: PeriodScore[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
    const monthTrades = scored.filter((s) => {
      const d = new Date(s.trade.entry_time);
      return d >= monthStart && d <= monthEnd;
    });
    if (monthTrades.length === 0) {
      result.push({ label: monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), score: 0, tradeCount: 0, perfectCount: 0 });
      continue;
    }
    const avg = Math.round(monthTrades.reduce((s, t) => s + t.score, 0) / monthTrades.length);
    const perfect = monthTrades.filter((s) => isPerfectTrade(s.trade)).length;
    result.push({
      label: monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      score: avg,
      tradeCount: monthTrades.length,
      perfectCount: perfect,
    });
  }
  return result;
}

export function computeOverallDiscipline(trades: Trade[]): number {
  const scored = getScoredTrades(trades);
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((s, t) => s + t.score, 0) / scored.length);
}

function countPerfectDays(trades: Trade[]): number {
  const scored = getScoredTrades(trades);
  const dayMap = new Map<string, { perfect: number; total: number }>();
  for (const s of scored) {
    const key = dateKey(new Date(s.trade.entry_time));
    const entry = dayMap.get(key) ?? { perfect: 0, total: 0 };
    entry.total++;
    if (isPerfectTrade(s.trade)) entry.perfect++;
    dayMap.set(key, entry);
  }
  let count = 0;
  for (const entry of dayMap.values()) {
    if (entry.perfect === entry.total && entry.total > 0) count++;
  }
  return count;
}

function countCompliantTrades(trades: Trade[]): number {
  const scored = getScoredTrades(trades);
  return scored.filter((s) => s.score >= 80).length;
}

function countNoRevengeStreak(trades: Trade[]): number {
  const scored = getScoredTrades(trades);
  const chrono = scored.sort(
    (a, b) => new Date(a.trade.entry_time).getTime() - new Date(b.trade.entry_time).getTime()
  );
  let streak = 0;
  let maxStreak = 0;
  for (const s of chrono) {
    if (s.trade.discipline_checks?.did_not_revenge_trade === true) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else if (s.trade.discipline_checks?.did_not_revenge_trade === false) {
      streak = 0;
    }
  }
  return maxStreak;
}

export function computeAchievements(trades: Trade[]): Achievement[] {
  const scored = getScoredTrades(trades);
  const perfectDays = countPerfectDays(trades);
  const compliantTrades = countCompliantTrades(trades);
  const revengeStreak = countNoRevengeStreak(trades);
  const overall = computeOverallDiscipline(trades);

  return [
    {
      id: "perfect-day-1",
      title: "First Perfect Day",
      description: "All trades in a single day had perfect discipline",
      icon: "star",
      unlocked: perfectDays >= 1,
      progress: Math.min(perfectDays, 1),
      target: 1,
      tier: "bronze",
    },
    {
      id: "perfect-days-7",
      title: "7 Perfect Days",
      description: "Seven days where every trade scored 100 on discipline",
      icon: "calendar-check",
      unlocked: perfectDays >= 7,
      progress: Math.min(perfectDays, 7),
      target: 7,
      tier: "silver",
    },
    {
      id: "perfect-days-30",
      title: "30 Perfect Days",
      description: "Thirty days of flawless discipline — elite consistency",
      icon: "crown",
      unlocked: perfectDays >= 30,
      progress: Math.min(perfectDays, 30),
      target: 30,
      tier: "platinum",
    },
    {
      id: "compliant-trades-20",
      title: "20 Rule-Compliant Trades",
      description: "Log 20 trades scoring 80 or above on discipline",
      icon: "shield-check",
      unlocked: compliantTrades >= 20,
      progress: Math.min(compliantTrades, 20),
      target: 20,
      tier: "silver",
    },
    {
      id: "compliant-trades-50",
      title: "50 Rule-Compliant Trades",
      description: "Fifty trades with strong discipline scores",
      icon: "medal",
      unlocked: compliantTrades >= 50,
      progress: Math.min(compliantTrades, 50),
      target: 50,
      tier: "gold",
    },
    {
      id: "no-revenge-30",
      title: "No Revenge Trades for 30 Days",
      description: "Go 30 consecutive trades without revenge trading",
      icon: "heart-shield",
      unlocked: revengeStreak >= 30,
      progress: Math.min(revengeStreak, 30),
      target: 30,
      tier: "gold",
    },
    {
      id: "no-revenge-10",
      title: "Revenge-Free Streak",
      description: "10 consecutive trades without revenge trading",
      icon: "flame",
      unlocked: revengeStreak >= 10,
      progress: Math.min(revengeStreak, 10),
      target: 10,
      tier: "bronze",
    },
    {
      id: "gold-discipline",
      title: "Gold Discipline Badge",
      description: "Maintain an overall discipline score of 85 or higher",
      icon: "award",
      unlocked: overall >= 85,
      progress: Math.min(overall, 85),
      target: 85,
      tier: "gold",
    },
    {
      id: "platinum-discipline",
      title: "Platinum Discipline Badge",
      description: "Maintain an overall discipline score of 95 or higher",
      icon: "gem",
      unlocked: overall >= 95,
      progress: Math.min(overall, 95),
      target: 95,
      tier: "platinum",
    },
    {
      id: "first-trade",
      title: "First Evaluation",
      description: "Log your first trade with discipline checks",
      icon: "flag",
      unlocked: scored.length >= 1,
      progress: Math.min(scored.length, 1),
      target: 1,
      tier: "bronze",
    },
  ];
}

export function scoreColor(score: number): string {
  if (score >= 90) return "text-bull-500";
  if (score >= 70) return "text-info-400";
  if (score >= 50) return "text-accent-500";
  if (score >= 30) return "text-warn-500";
  return "text-bear-500";
}

export function scoreBgColor(score: number): string {
  if (score >= 90) return "bg-bull-500";
  if (score >= 70) return "bg-info-500";
  if (score >= 50) return "bg-accent-500";
  if (score >= 30) return "bg-warn-500";
  return "bg-bear-500";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 70) return "Disciplined";
  if (score >= 50) return "Developing";
  if (score >= 30) return "Risky";
  return "Undisciplined";
}

export { DISCIPLINE_RULES };
