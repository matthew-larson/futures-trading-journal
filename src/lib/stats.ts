import type { Trade, TradingRule } from "./types";
import { toNyParts, nyDateString, nyStartOfToday } from "./timezone";

export interface ExpectancyStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  expectancyR: number;
  profitFactor: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  largestWin: number;
  largestLoss: number;
  avgHoldMinutes: number;
  bestStreak: number;
  worstStreak: number;
  currentStreak: number;
  avgCompliance: number;
}

function netPnlOf(t: Trade): number {
  const gross = Number(t.pnl ?? 0);
  return gross - Number(t.fees ?? 0);
}

export function computeStats(trades: Trade[]): ExpectancyStats {
  const closed = trades.filter((t) => t.exit_time !== null);
  const totalTrades = closed.length;
  const pnls = closed.map(netPnlOf);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const breakeven = pnls.filter((p) => p === 0).length;

  const totalPnl = pnls.reduce((s, p) => s + p, 0);
  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));

  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;

  // Expectancy = (WinRate% * AvgWin) - (LossRate% * AvgLoss)
  const lossRate = totalTrades ? (losses.length / totalTrades) * 100 : 0;
  const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;

  // Expectancy Ratio (R multiple): expectancy / avg risk (use avg loss as risk proxy)
  const expectancyR = avgLoss > 0 ? expectancy / avgLoss : 0;

  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const largestWin = wins.length ? Math.max(...wins) : 0;
  const largestLoss = losses.length ? Math.min(...losses) : 0;

  // Hold times
  const holdMinutes = closed
    .filter((t) => t.entry_time && t.exit_time)
    .map((t) => {
      const ms = new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime();
      return ms / 60000;
    });
  const avgHoldMinutes = holdMinutes.length
    ? holdMinutes.reduce((s, m) => s + m, 0) / holdMinutes.length
    : 0;

  // Streaks (in chronological order)
  const chrono = [...closed].sort(
    (a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime()
  );
  let bestStreak = 0;
  let worstStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  let currentStreak = 0;
  for (const t of chrono) {
    const p = netPnlOf(t);
    if (p > 0) {
      curWin++;
      curLoss = 0;
      bestStreak = Math.max(bestStreak, curWin);
      currentStreak = curWin;
    } else if (p < 0) {
      curLoss++;
      curWin = 0;
      worstStreak = Math.max(worstStreak, curLoss);
      currentStreak = -curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  const totalFees = closed.reduce((s, t) => s + Number(t.fees ?? 0), 0);

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    expectancyR,
    profitFactor,
    totalPnl: trades.reduce((s, t) => s + Number(t.pnl ?? 0), 0),
    totalFees,
    netPnl: totalPnl,
    largestWin,
    largestLoss,
    avgHoldMinutes,
    bestStreak,
    worstStreak,
    currentStreak,
    avgCompliance: 0,
  };
}

export function complianceScore(
  trade: Trade,
  rules: TradingRule[]
): { score: number; followed: number; total: number } {
  const compliance = trade.rule_compliance ?? {};
  const applicable = rules.filter((r) => r.id in compliance);
  if (applicable.length === 0) return { score: 0, total: 0, followed: 0 };
  const followed = applicable.filter((r) => compliance[r.id] === true).length;
  return {
    score: Math.round((followed / applicable.length) * 100),
    followed,
    total: applicable.length,
  };
}

export function overallCompliance(
  trades: Trade[],
  rules: TradingRule[]
): number {
  const scored = trades
    .map((t) => complianceScore(t, rules))
    .filter((s) => s.total > 0);
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length);
}

// Group rule violations across trades for analytics
export function ruleBreakdown(trades: Trade[], rules: TradingRule[]) {
  return rules.map((r) => {
    let followed = 0;
    let violated = 0;
    for (const t of trades) {
      if (r.id in (t.rule_compliance ?? {})) {
        if (t.rule_compliance[r.id]) followed++;
        else violated++;
      }
    }
    return { rule: r, followed, violated, total: followed + violated };
  });
}

// ---- Command-center dashboard helpers ----

/** Stats scoped to the current NY trading day (based on entry_time in NY). */
export function computeTodayStats(trades: Trade[]): {
  netPnl: number;
  winRate: number;
  rMultiple: number;
  tradeCount: number;
  wins: number;
  losses: number;
} {
  const todayNy = nyDateString(new Date().toISOString());
  const todays = trades.filter((t) => nyDateString(t.entry_time) === todayNy);
  const closed = todays.filter((t) => t.exit_time !== null);
  const pnls = closed.map(netPnlOf);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const netPnl = pnls.reduce((s, p) => s + p, 0);
  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const lossRate = closed.length ? (losses.length / closed.length) * 100 : 0;
  const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
  const rMultiple = avgLoss > 0 ? expectancy / avgLoss : 0;
  return {
    netPnl,
    winRate,
    rMultiple,
    tradeCount: todays.length,
    wins: wins.length,
    losses: losses.length,
  };
}

/** Weekly P&L — returns last N weeks as bar data. */
export function computeWeeklyPnl(
  trades: Trade[],
  weeks = 8
): { label: string; pnl: number; tradeCount: number }[] {
  const now = new Date();
  const result: { label: string; pnl: number; tradeCount: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - w * 7);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekTrades = trades.filter((t) => {
      if (!t.exit_time) return false;
      const d = new Date(t.exit_time);
      return d >= weekStart && d <= weekEnd;
    });
    const pnl = weekTrades.reduce((s, t) => s + netPnlOf(t), 0);
    const label = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    result.push({ label, pnl, tradeCount: weekTrades.length });
  }
  return result;
}

/** Monthly performance — returns last N months as summary rows. */
export function computeMonthlyPerformance(
  trades: Trade[],
  months = 6
): {
  label: string;
  pnl: number;
  winRate: number;
  tradeCount: number;
  bestDay: number;
  worstDay: number;
}[] {
  const now = new Date();
  const result: {
    label: string;
    pnl: number;
    winRate: number;
    tradeCount: number;
    bestDay: number;
    worstDay: number;
  }[] = [];

  for (let m = months - 1; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    const monthTrades = trades.filter((t) => {
      if (!t.exit_time) return false;
      const d = new Date(t.exit_time);
      return d >= monthStart && d <= monthEnd;
    });

    const pnls = monthTrades.map(netPnlOf);
    const pnl = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter((p) => p > 0).length;
    const winRate = pnls.length ? (wins / pnls.length) * 100 : 0;

    // best/worst day within the month
    const dayMap = new Map<string, number>();
    for (const t of monthTrades) {
      const key = nyDateString(t.exit_time!);
      dayMap.set(key, (dayMap.get(key) ?? 0) + netPnlOf(t));
    }
    const dayValues = Array.from(dayMap.values());
    const bestDay = dayValues.length ? Math.max(...dayValues) : 0;
    const worstDay = dayValues.length ? Math.min(...dayValues) : 0;

    result.push({
      label: monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      pnl,
      winRate,
      tradeCount: monthTrades.length,
      bestDay,
      worstDay,
    });
  }
  return result;
}

/** Current streak as a signed number (positive = winning, negative = losing). */
export function computeCurrentStreak(trades: Trade[]): {
  value: number;
  type: "winning" | "losing" | "none";
} {
  const chrono = trades
    .filter((t) => t.exit_time !== null)
    .sort(
      (a, b) =>
        new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime()
    );
  if (chrono.length === 0) return { value: 0, type: "none" };
  let streak = 0;
  let lastSign: "win" | "loss" | "flat" = "flat";
  for (let i = chrono.length - 1; i >= 0; i--) {
    const p = netPnlOf(chrono[i]);
    const sign = p > 0 ? "win" : p < 0 ? "loss" : "flat";
    if (sign === "flat") break;
    if (lastSign === "flat") {
      lastSign = sign;
      streak++;
    } else if (sign === lastSign) {
      streak++;
    } else {
      break;
    }
  }
  return {
    value: streak,
    type: lastSign === "win" ? "winning" : lastSign === "loss" ? "losing" : "none",
  };
}
