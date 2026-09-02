import type { Trade } from "./types";
import { toNyParts } from "./timezone";
import { getMultiplier } from "./contracts";

function netPnlOf(t: Trade): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

function holdMinutes(t: Trade): number | null {
  if (!t.entry_time || !t.exit_time) return null;
  return (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000;
}

function avgR(trades: Trade[]): number | null {
  const rs: number[] = [];
  for (const t of trades) {
    const r = computeR(t);
    if (r !== null) rs.push(r);
  }
  return rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : null;
}

export function computeR(t: Trade): number | null {
  const net = netPnlOf(t);
  const entry = Number(t.entry_price);
  const stop = Number(t.stop_price);
  const qty = Number(t.quantity);
  if (!t.stop_price || stop === entry || qty <= 0) return null;
  const mult = getMultiplier(t.instrument);
  if (mult === null) return null;
  const riskPerShare = Math.abs(entry - stop);
  if (riskPerShare === 0) return null;
  const risk = riskPerShare * mult * qty;
  if (risk === 0) return null;
  return net / risk;
}

export interface StrategyStats {
  tag: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number | null;
  expectancy: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldMinutes: number;
}

export function computeStrategyStats(trades: Trade[]): StrategyStats[] {
  const closed = trades.filter((t) => t.exit_time !== null);
  const tagMap = new Map<string, Trade[]>();

  for (const t of closed) {
    const tags = t.strategy_tags ?? [];
    if (tags.length === 0) continue;
    for (const tag of tags) {
      const arr = tagMap.get(tag) ?? [];
      arr.push(t);
      tagMap.set(tag, arr);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, tagTrades]) => {
      const pnls = tagTrades.map(netPnlOf);
      const wins = pnls.filter((p) => p > 0);
      const losses = pnls.filter((p) => p < 0);
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const grossWin = wins.reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
      const avgWin = wins.length ? grossWin / wins.length : 0;
      const avgLoss = losses.length ? grossLoss / losses.length : 0;
      const winRate = tagTrades.length ? (wins.length / tagTrades.length) * 100 : 0;
      const lossRate = 100 - winRate;
      const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;

      const holds = tagTrades.map(holdMinutes).filter((m): m is number => m !== null);
      const avgHoldMinutes = holds.length
        ? holds.reduce((s, m) => s + m, 0) / holds.length
        : 0;

      return {
        tag,
        trades: tagTrades.length,
        wins: wins.length,
        losses: losses.length,
        winRate,
        avgR: avgR(tagTrades),
        expectancy,
        totalPnl,
        avgWin,
        avgLoss,
        largestWin: wins.length ? Math.max(...wins) : 0,
        largestLoss: losses.length ? Math.min(...losses) : 0,
        avgHoldMinutes,
      };
    })
    .sort((a, b) => b.expectancy - a.expectancy);
}

export interface TimeOfDayStats {
  label: string;
  hour: number;
  trades: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
}

export function computeTimeOfDayStats(trades: Trade[]): TimeOfDayStats[] {
  const closed = trades.filter((t) => t.exit_time !== null);
  const buckets = new Map<number, Trade[]>();

  for (const t of closed) {
    const h = toNyParts(t.entry_time).hour;
    const arr = buckets.get(h) ?? [];
    arr.push(t);
    buckets.set(h, arr);
  }

  const labels: Record<number, string> = {};
  for (let h = 0; h < 24; h++) {
    const period = h < 12 ? "AM" : "PM";
    const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
    labels[h] = `${display}:00 ${period}`;
  }

  return Array.from(buckets.entries())
    .map(([hour, bucketTrades]) => {
      const pnls = bucketTrades.map(netPnlOf);
      const wins = pnls.filter((p) => p > 0).length;
      return {
        label: labels[hour],
        hour,
        trades: bucketTrades.length,
        wins,
        winRate: bucketTrades.length ? (wins / bucketTrades.length) * 100 : 0,
        avgPnl: pnls.reduce((s, p) => s + p, 0) / pnls.length,
        totalPnl: pnls.reduce((s, p) => s + p, 0),
      };
    })
    .sort((a, b) => a.hour - b.hour);
}

export interface DayOfWeekStats {
  label: string;
  day: number;
  trades: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
}

export function computeDayOfWeekStats(trades: Trade[]): DayOfWeekStats[] {
  const closed = trades.filter((t) => t.exit_time !== null);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets = new Map<number, Trade[]>();

  for (const t of closed) {
    const d = toNyParts(t.entry_time).weekday;
    const arr = buckets.get(d) ?? [];
    arr.push(t);
    buckets.set(d, arr);
  }

  return Array.from(buckets.entries())
    .map(([day, bucketTrades]) => {
      const pnls = bucketTrades.map(netPnlOf);
      const wins = pnls.filter((p) => p > 0).length;
      return {
        label: names[day],
        day,
        trades: bucketTrades.length,
        wins,
        winRate: bucketTrades.length ? (wins / bucketTrades.length) * 100 : 0,
        avgPnl: pnls.reduce((s, p) => s + p, 0) / pnls.length,
        totalPnl: pnls.reduce((s, p) => s + p, 0),
      };
    })
    .sort((a, b) => a.day - b.day);
}

export interface StrategyOverview {
  totalTagged: number;
  totalUntagged: number;
  uniqueTags: number;
  largestWin: number;
  largestLoss: number;
  avgHoldMinutes: number;
  bestTimeOfDay: TimeOfDayStats | null;
  bestDayOfWeek: DayOfWeekStats | null;
  bestStrategy: StrategyStats | null;
}

export function computeStrategyOverview(trades: Trade[]): StrategyOverview {
  const closed = trades.filter((t) => t.exit_time !== null);
  const tagged = closed.filter((t) => (t.strategy_tags ?? []).length > 0);

  const pnls = closed.map(netPnlOf);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const holds = closed.map(holdMinutes).filter((m): m is number => m !== null);
  const avgHoldMinutes = holds.length
    ? holds.reduce((s, m) => s + m, 0) / holds.length
    : 0;

  const strategyStats = computeStrategyStats(trades);
  const timeStats = computeTimeOfDayStats(trades);
  const dayStats = computeDayOfWeekStats(trades);

  const bestTime = timeStats.length
    ? [...timeStats].sort((a, b) => b.avgPnl - a.avgPnl)[0] ?? null
    : null;
  const bestDay = dayStats.length
    ? [...dayStats].sort((a, b) => b.avgPnl - a.avgPnl)[0] ?? null
    : null;
  const bestStrat = strategyStats.length ? strategyStats[0] : null;

  const uniqueTags = new Set<string>();
  for (const t of tagged) {
    for (const tag of t.strategy_tags ?? []) uniqueTags.add(tag);
  }

  return {
    totalTagged: tagged.length,
    totalUntagged: closed.length - tagged.length,
    uniqueTags: uniqueTags.size,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    avgHoldMinutes,
    bestTimeOfDay: bestTime,
    bestDayOfWeek: bestDay,
    bestStrategy: bestStrat,
  };
}
