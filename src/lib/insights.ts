import type { Trade } from "./types";
import { toNyParts, nyDayName as nyDayNameUtil } from "./timezone";

export interface Insight {
  id: string;
  title: string;
  detail: string;
  category: "time" | "setup" | "day" | "behavior" | "risk" | "instrument";
  impact: "positive" | "negative" | "neutral";
  metric?: string;
  sampleSize?: number;
  supportingTradeIds?: string[];
}

function netPnlOf(t: Trade): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

/**
 * Minimum sample size for a claim to be considered reliable.
 * Below this, insights include an explicit small-sample warning.
 */
const MIN_RELIABLE_SAMPLE = 5;

function sampleDisclaimer(count: number): string {
  if (count < MIN_RELIABLE_SAMPLE) {
    return ` Note: this is based on only ${count} trade${count === 1 ? "" : "s"} — a small sample. Treat as a tentative observation, not a confirmed pattern.`;
  }
  return "";
}

function samplePrefix(count: number): string {
  return `Based on ${count} trade${count === 1 ? "" : "s"}`;
}

/**
 * Generate top insights from the trade history.
 * Analyzes time-of-day patterns, setup performance, day-of-week patterns,
 * and behavioral tendencies (cutting winners, holding losers).
 */
export function generateInsights(trades: Trade[]): Insight[] {
  const closed = trades.filter((t) => t.exit_time !== null);
  if (closed.length < 3) return [];

  const insights: Insight[] = [];

  // 1. Time-of-day analysis: before 10:00 AM vs after 10:00 AM
  const before10Trades: Trade[] = [];
  const after10Trades: Trade[] = [];
  for (const t of closed) {
    const hour = toNyParts(t.entry_time).hour;
    if (hour < 10) before10Trades.push(t);
    else after10Trades.push(t);
  }
  if (before10Trades.length >= 2 && after10Trades.length >= 2) {
    const avgBefore = before10Trades.reduce((s, t) => s + netPnlOf(t), 0) / before10Trades.length;
    const avgAfter = after10Trades.reduce((s, t) => s + netPnlOf(t), 0) / after10Trades.length;
    if (avgAfter > avgBefore && avgBefore !== 0) {
      const pct = Math.round(((avgAfter - avgBefore) / Math.abs(avgBefore)) * 100);
      if (pct > 5) {
        insights.push({
          id: "time-after-10",
          title: `You perform ${pct}% better after 10:00 AM`,
          detail: `${samplePrefix(before10Trades.length + after10Trades.length)}: your average trade before 10 AM nets $${avgBefore.toFixed(0)} (${before10Trades.length} trades), while trades after 10 AM average $${avgAfter.toFixed(0)} (${after10Trades.length} trades). Consider waiting for the morning session to settle before taking entries.${sampleDisclaimer(before10Trades.length + after10Trades.length)}`,
          category: "time",
          impact: "positive",
          metric: `+${pct}%`,
          sampleSize: before10Trades.length + after10Trades.length,
          supportingTradeIds: [...before10Trades, ...after10Trades].map((t) => t.id),
        });
      }
    } else if (avgBefore > avgAfter && avgAfter !== 0) {
      const pct = Math.round(((avgBefore - avgAfter) / Math.abs(avgAfter)) * 100);
      if (pct > 5) {
        insights.push({
          id: "time-before-10",
          title: `Morning sessions are ${pct}% more profitable for you`,
          detail: `${samplePrefix(before10Trades.length + after10Trades.length)}: your average trade before 10 AM nets $${avgBefore.toFixed(0)} (${before10Trades.length} trades), while trades after 10 AM average $${avgAfter.toFixed(0)} (${after10Trades.length} trades). Your edge is strongest in the first hour of the session.${sampleDisclaimer(before10Trades.length + after10Trades.length)}`,
          category: "time",
          impact: "positive",
          metric: `+${pct}%`,
          sampleSize: before10Trades.length + after10Trades.length,
          supportingTradeIds: [...before10Trades, ...after10Trades].map((t) => t.id),
        });
      }
    }
  }

  // 2. Best setup by expectancy
  const setupMap = new Map<string, Trade[]>();
  for (const t of closed) {
    if (!t.setup) continue;
    const arr = setupMap.get(t.setup) ?? [];
    arr.push(t);
    setupMap.set(t.setup, arr);
  }
  const setupEntries = Array.from(setupMap.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([setup, arr]) => ({
      setup,
      avg: arr.reduce((s, t) => s + netPnlOf(t), 0) / arr.length,
      count: arr.length,
      trades: arr,
    }))
    .sort((a, b) => b.avg - a.avg);
  if (setupEntries.length >= 2) {
    const best = setupEntries[0];
    if (best.avg > 0) {
      insights.push({
        id: "best-setup",
        title: `${best.setup} setups have your highest expectancy`,
        detail: `Based on ${best.count} ${best.setup} trades, this setup averages $${best.avg.toFixed(0)} per trade. This is your strongest edge — consider focusing more capital here.${sampleDisclaimer(best.count)}`,
        category: "setup",
        impact: "positive",
        metric: `$${best.avg.toFixed(0)}/trade`,
        sampleSize: best.count,
        supportingTradeIds: best.trades.map((t) => t.id),
      });
    }
    const worst = setupEntries[setupEntries.length - 1];
    if (worst.avg < 0) {
      insights.push({
        id: "worst-setup",
        title: `${worst.setup} setups are dragging your performance`,
        detail: `Based on ${worst.count} ${worst.setup} trades, this setup averages $${worst.avg.toFixed(0)} per trade. Consider reviewing your entry criteria or pausing this setup.${sampleDisclaimer(worst.count)}`,
        category: "setup",
        impact: "negative",
        metric: `$${worst.avg.toFixed(0)}/trade`,
        sampleSize: worst.count,
        supportingTradeIds: worst.trades.map((t) => t.id),
      });
    }
  }

  // 3. Day-of-week analysis
  const dayMap = new Map<number, Trade[]>();
  for (const t of closed) {
    const day = toNyParts(t.entry_time).weekday;
    const arr = dayMap.get(day) ?? [];
    arr.push(t);
    dayMap.set(day, arr);
  }
  const dayEntries = Array.from(dayMap.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([day, arr]) => ({
      day,
      label: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day],
      avg: arr.reduce((s, t) => s + netPnlOf(t), 0) / arr.length,
      count: arr.length,
      trades: arr,
    }));
  if (dayEntries.length >= 3) {
    const sorted = [...dayEntries].sort((a, b) => a.avg - b.avg);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    if (worst.avg < 0) {
      insights.push({
        id: "worst-day",
        title: `${worst.label}s are your least profitable day`,
        detail: `Based on ${worst.count} trade${worst.count === 1 ? "" : "s"} on ${worst.label}s, you average $${worst.avg.toFixed(0)} per trade. Consider reducing position size or sitting out this day entirely.${sampleDisclaimer(worst.count)}`,
        category: "day",
        impact: "negative",
        metric: `$${worst.avg.toFixed(0)}/trade`,
        sampleSize: worst.count,
        supportingTradeIds: worst.trades.map((t) => t.id),
      });
    }
    if (best.avg > 0) {
      insights.push({
        id: "best-day",
        title: `${best.label}s are your most profitable day`,
        detail: `Based on ${best.count} trade${best.count === 1 ? "" : "s"} on ${best.label}s, you average $${best.avg.toFixed(0)} per trade. This is your strongest trading day.${sampleDisclaimer(best.count)}`,
        category: "day",
        impact: "positive",
        metric: `$${best.avg.toFixed(0)}/trade`,
        sampleSize: best.count,
        supportingTradeIds: best.trades.map((t) => t.id),
      });
    }
  }

  // 4. Cutting winners too early vs holding losers too long
  const winners = closed.filter((t) => netPnlOf(t) > 0);
  const losers = closed.filter((t) => netPnlOf(t) < 0);
  if (winners.length >= 3 && losers.length >= 3) {
    const avgWinHold = winners
      .filter((t) => t.entry_time && t.exit_time)
      .map((t) => (new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime()) / 60000);
    const avgLossHold = losers
      .filter((t) => t.entry_time && t.exit_time)
      .map((t) => (new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime()) / 60000);
    if (avgWinHold.length >= 2 && avgLossHold.length >= 2) {
      const winAvg = avgWinHold.reduce((s, m) => s + m, 0) / avgWinHold.length;
      const lossAvg = avgLossHold.reduce((s, m) => s + m, 0) / avgLossHold.length;
      const totalSample = winners.length + losers.length;
      if (lossAvg > winAvg * 1.5 && winAvg > 0) {
        insights.push({
          id: "cutting-winners",
          title: "You are cutting winners too early",
          detail: `Based on ${winners.length} winning trades and ${losers.length} losing trades: your winners average ${Math.round(winAvg)}m hold time, while losers average ${Math.round(lossAvg)}m. You're letting losers run nearly ${Math.round(lossAvg / winAvg)}x longer than winners. Let your winners breathe.${sampleDisclaimer(totalSample)}`,
          category: "behavior",
          impact: "negative",
          metric: `${Math.round(winAvg)}m vs ${Math.round(lossAvg)}m`,
          sampleSize: totalSample,
          supportingTradeIds: [...winners, ...losers].map((t) => t.id),
        });
      } else if (winAvg > lossAvg * 1.5 && lossAvg > 0) {
        insights.push({
          id: "disciplined-exits",
          title: "You cut losers faster than winners",
          detail: `Based on ${winners.length} winning trades and ${losers.length} losing trades: your winners average ${Math.round(winAvg)}m while losers average ${Math.round(lossAvg)}m. This is disciplined behavior — you're letting winners run and cutting losses short.${sampleDisclaimer(totalSample)}`,
          category: "behavior",
          impact: "positive",
          metric: `${Math.round(winAvg)}m vs ${Math.round(lossAvg)}m`,
          sampleSize: totalSample,
          supportingTradeIds: [...winners, ...losers].map((t) => t.id),
        });
      }
    }
  }

  // 5. Direction bias: long vs short performance
  const longTrades = closed.filter((t) => t.direction === "long");
  const shortTrades = closed.filter((t) => t.direction === "short");
  if (longTrades.length >= 2 && shortTrades.length >= 2) {
    const avgLong = longTrades.reduce((s, t) => s + netPnlOf(t), 0) / longTrades.length;
    const avgShort = shortTrades.reduce((s, t) => s + netPnlOf(t), 0) / shortTrades.length;
    if (Math.abs(avgLong - avgShort) > 50) {
      if (avgLong > avgShort) {
        insights.push({
          id: "long-bias",
          title: "Your long trades outperform your shorts",
          detail: `Based on ${longTrades.length} long trades and ${shortTrades.length} short trades: longs average $${avgLong.toFixed(0)} while shorts average $${avgShort.toFixed(0)}. Consider whether your short setups need refinement or if you should favor longs.${sampleDisclaimer(longTrades.length + shortTrades.length)}`,
          category: "behavior",
          impact: avgShort < 0 ? "negative" : "neutral",
          metric: `L $${avgLong.toFixed(0)} / S $${avgShort.toFixed(0)}`,
          sampleSize: longTrades.length + shortTrades.length,
          supportingTradeIds: [...longTrades, ...shortTrades].map((t) => t.id),
        });
      } else {
        insights.push({
          id: "short-bias",
          title: "Your short trades outperform your longs",
          detail: `Based on ${shortTrades.length} short trades and ${longTrades.length} long trades: shorts average $${avgShort.toFixed(0)} while longs average $${avgLong.toFixed(0)}. You may have a stronger edge reading bearish market structure.${sampleDisclaimer(longTrades.length + shortTrades.length)}`,
          category: "behavior",
          impact: avgLong < 0 ? "negative" : "neutral",
          metric: `S $${avgShort.toFixed(0)} / L $${avgLong.toFixed(0)}`,
          sampleSize: longTrades.length + shortTrades.length,
          supportingTradeIds: [...longTrades, ...shortTrades].map((t) => t.id),
        });
      }
    }
  }

  // Sort: negative-impact first (actionable warnings), then positive, then neutral
  const orderMap = { negative: 0, positive: 1, neutral: 2 };
  return insights.sort((a, b) => orderMap[a.impact] - orderMap[b.impact]).slice(0, 6);
}

/** Static demo insights shown when there is no real data yet. */
export function demoInsights(): Insight[] {
  return [
    {
      id: "demo-1",
      title: "You perform 28% better after 10:00 AM",
      detail: "Based on 47 trades: your average trade before 10 AM nets $42, while trades after 10 AM average $54. Consider waiting for the morning session to settle before taking entries.",
      category: "time",
      impact: "positive",
      metric: "+28%",
      sampleSize: 47,
    },
    {
      id: "demo-2",
      title: "Liquidity Sweep setups have your highest expectancy",
      detail: "Based on 14 Liquidity Sweep trades, this setup averages $187 per trade. This is your strongest edge — consider focusing more capital here.",
      category: "setup",
      impact: "positive",
      metric: "$187/trade",
      sampleSize: 14,
    },
    {
      id: "demo-3",
      title: "Thursdays are your least profitable day",
      detail: "Based on 9 trades on Thursdays, you average -$94 per trade. Consider reducing position size or sitting out this day entirely.",
      category: "day",
      impact: "negative",
      metric: "-$94/trade",
      sampleSize: 9,
    },
    {
      id: "demo-4",
      title: "You are cutting winners too early",
      detail: "Based on 22 winning trades and 18 losing trades: your winners average 12m hold time, while losers average 38m. You're letting losers run over 3x longer than winners. Let your winners breathe.",
      category: "behavior",
      impact: "negative",
      metric: "12m vs 38m",
      sampleSize: 40,
    },
  ];
}
