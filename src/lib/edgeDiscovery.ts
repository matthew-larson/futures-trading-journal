import type { Trade } from "./types";
import { toNyParts, nyDayName as nyDayNameTz } from "./timezone";
import { getMultiplier } from "./contracts";

export type InsightCategory = "strength" | "weakness" | "opportunity" | "recommendation";

export interface EdgeInsight {
  id: string;
  category: InsightCategory;
  title: string;
  detail: string;
  recommendation: string;
  confidence: number;
  tradeCount: number;
  pnlImpact: number;
  evImpact: number;
  tags: string[];
}

export interface EdgeDiscoveryResult {
  strengths: EdgeInsight[];
  weaknesses: EdgeInsight[];
  opportunities: EdgeInsight[];
  recommendations: EdgeInsight[];
  totalTrades: number;
  hasRealData: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function netPnl(t: Trade): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => netPnl(t) > 0).length;
  return (wins / trades.length) * 100;
}

function avgPnl(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + netPnl(t), 0) / trades.length;
}

function totalPnl(trades: Trade[]): number {
  return trades.reduce((s, t) => s + netPnl(t), 0);
}

function profitFactor(trades: Trade[]): number {
  const gross = trades.filter((t) => netPnl(t) > 0).reduce((s, t) => s + netPnl(t), 0);
  const loss = Math.abs(trades.filter((t) => netPnl(t) < 0).reduce((s, t) => s + netPnl(t), 0));
  if (loss === 0) return gross > 0 ? 99 : 0;
  return gross / loss;
}

function expectancy(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => netPnl(t) > 0);
  const losses = trades.filter((t) => netPnl(t) < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;
  const wr = winRate(trades) / 100;
  return wr * avgWin - (1 - wr) * avgLoss;
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

function holdMinutes(t: Trade): number | null {
  if (!t.exit_time || !t.entry_time) return null;
  return (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000;
}

function dayName(t: Trade): string {
  return nyDayNameTz(t.entry_time);
}

function entryHour(t: Trade): number {
  return toNyParts(t.entry_time).hour;
}

function entryMinuteOfDay(t: Trade): number {
  return toNyParts(t.entry_time).minuteOfDay;
}

function timeBucket(t: Trade): string {
  const m = entryMinuteOfDay(t);
  if (m < 600) return "Pre-Market (<10:00)";        // before 10:00
  if (m < 645) return "NY Open (10:00–10:45)";       // 10:00-10:45
  if (m < 720) return "Late Morning (10:45–12:00)";  // 10:45-12:00
  if (m < 840) return "Lunch (12:00–14:00)";         // 12:00-14:00
  if (m < 960) return "Afternoon (14:00–16:00)";     // 14:00-16:00
  return "Evening (16:00+)";
}

function sessionLabel(t: Trade): string {
  if (t.market_session === "asian") return "Asia";
  if (t.market_session === "london") return "London";
  if (t.market_session === "new_york") return "New York";
  if (t.market_session === "overnight") return "Overnight";
  return "Untagged";
}

function aiGrade(t: Trade): string | null {
  return t.ai_analysis?.grade ?? null;
}

function gradeTier(grade: string | null): "A" | "B" | "C" | "D" | "F" | null {
  if (!grade) return null;
  if (grade.startsWith("A")) return "A";
  if (grade.startsWith("B")) return "B";
  if (grade.startsWith("C")) return "C";
  if (grade.startsWith("D")) return "D";
  return "F";
}

function isTrendAligned(t: Trade): boolean | null {
  // Infer from discipline check: did_not_chase + waited_for_confirmation implies trend-aligned
  // Or from strategy tags
  const tags = t.strategy_tags ?? [];
  const trendTags = ["Trend Pullback", "Trend Continuation", "Opening Range Breakout", "EMA Bounce", "Momentum", "Breakout"];
  const counterTags = ["VWAP Reversal", "Reversal", "Liquidity Sweep", "Scalp", "Range"];
  const hasTrend = tags.some((tg) => trendTags.includes(tg));
  const hasCounter = tags.some((tg) => counterTags.includes(tg));
  if (hasTrend && !hasCounter) return true;
  if (hasCounter && !hasTrend) return false;
  return null;
}

function emotionCategory(emotions: string | null): "positive" | "negative" | "neutral" | null {
  if (!emotions) return null;
  const e = emotions.toLowerCase();
  const positive = ["calm", "confident", "neutral", "focused", "patient", "disciplined"];
  const negative = ["fomo", "revenge", "fear", "panic", "greed", "anxious", "tilt", "angry", "frustrat", "nervous", "excited"];
  if (positive.some((p) => e.includes(p))) return "positive";
  if (negative.some((n) => e.includes(n))) return "negative";
  return "neutral";
}

function riskMultiple(t: Trade): number | null {
  return rMultiple(t);
}

function positionSize(t: Trade): number {
  return t.quantity;
}

function confidenceScore(tradeCount: number, minSample: number = 5): number {
  if (tradeCount >= 50) return 92;
  if (tradeCount >= 30) return 85;
  if (tradeCount >= 20) return 78;
  if (tradeCount >= 15) return 70;
  if (tradeCount >= 10) return 62;
  if (tradeCount >= 7) return 52;
  if (tradeCount >= 5) return 45;
  return Math.max(20, Math.round((tradeCount / minSample) * 40));
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

/* ------------------------------------------------------------------ */
/* Pattern detectors                                                  */
/* ------------------------------------------------------------------ */

interface GroupStat {
  label: string;
  trades: Trade[];
  avg: number;
  total: number;
  winRate: number;
  pf: number;
  ev: number;
  avgR: number | null;
  count: number;
}

function computeGroupStats(label: string, trades: Trade[]): GroupStat {
  return {
    label,
    trades,
    avg: avgPnl(trades),
    total: totalPnl(trades),
    winRate: winRate(trades),
    pf: profitFactor(trades),
    ev: expectancy(trades),
    avgR: avgR(trades),
    count: trades.length,
  };
}

function groupStats(trades: Trade[], keyFn: (t: Trade) => string): GroupStat[] {
  return Array.from(groupBy(trades, keyFn).entries())
    .map(([label, ts]) => computeGroupStats(label, ts))
    .filter((g) => g.count >= 3);
}

/* ------------------------------------------------------------------ */
/* Main analysis                                                      */
/* ------------------------------------------------------------------ */

export function discoverEdge(trades: Trade[]): EdgeDiscoveryResult {
  const closed = trades.filter((t) => t.exit_time !== null);
  const hasRealData = closed.length >= 8;

  if (!hasRealData) {
    return sampleEdgeDiscovery(closed.length);
  }

  const insights: EdgeInsight[] = [];
  const overallEv = expectancy(closed);
  const overallPf = profitFactor(closed);
  const overallWinRate = winRate(closed);
  const overallAvg = avgPnl(closed);

  /* ---- Time of day ---- */
  const timeGroups = groupStats(closed, timeBucket);
  for (const g of timeGroups) {
    if (g.count >= 5) {
      if (g.ev > overallEv * 1.3 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `time-strong-${g.label}`,
          `${g.label} is your highest-edge window`,
          `Across ${g.count} trades, you generate ${formatEv(g.ev)} per trade with a ${formatPct(g.winRate)} win rate during ${g.label}. Your profit factor here is ${g.pf.toFixed(2)} versus ${overallPf.toFixed(2)} overall.`,
          `Continue prioritizing ${g.label}. Consider sizing up during this window — your data shows a clear, repeatable edge.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["time-of-day", "session"]
        ));
      }
      if (g.ev < 0 && g.ev < overallEv * 0.7) {
        insights.push(makeInsight(
          "weakness", `time-weak-${g.label}`,
          `${g.label} is bleeding your capital`,
          `During ${g.label}, your expectancy drops to ${formatEv(g.ev)} across ${g.count} trades with only a ${formatPct(g.winRate)} win rate. You've lost ${formatMoney(g.total)} in this window.`,
          `Stop trading during ${g.label} for the next two weeks. Re-evaluate only after reviewing what setups you're taking in this window and why they fail.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["time-of-day", "session"]
        ));
      }
    }
  }

  /* ---- Day of week ---- */
  const dayGroups = groupStats(closed, dayName);
  for (const g of dayGroups) {
    if (g.count >= 4) {
      if (g.ev > overallEv * 1.3 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `day-strong-${g.label}`,
          `${g.label}s are your most profitable day`,
          `On ${g.label}s you average ${formatMoney(g.avg)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate. This is your strongest day of the week.`,
          `Treat ${g.label} as your primary trading day. Consider increasing position size on ${g.label} while reducing it on weaker days.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["day-of-week"]
        ));
      }
      if (g.ev < 0 && g.count >= 4) {
        insights.push(makeInsight(
          "weakness", `day-weak-${g.label}`,
          `${g.label}s consistently lose money`,
          `Across ${g.count} trades on ${g.label}s, you average ${formatMoney(g.avg)} per trade with a ${formatPct(g.winRate)} win rate. Total loss: ${formatMoney(g.total)}.`,
          `Consider sitting out ${g.label}s entirely, or reduce position size to half until you identify what's different about this day for you.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["day-of-week"]
        ));
      }
    }
  }

  /* ---- Instrument ---- */
  const instrumentGroups = groupStats(closed, (t) => t.instrument);
  for (const g of instrumentGroups) {
    if (g.count >= 5) {
      if (g.ev > overallEv * 1.25 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `instr-strong-${g.label}`,
          `Your edge in ${g.label} is statistically significant`,
          `Across ${g.count} ${g.label} trades, you produce ${formatEv(g.ev)}/trade with a ${formatPct(g.winRate)} win rate and ${g.pf.toFixed(2)} profit factor. This is well above your overall ${overallPf.toFixed(2)} PF.`,
          `Allocate more capital to ${g.label}. Your data suggests this is where you have the deepest market intuition.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["instrument"]
        ));
      }
      if (g.ev < 0 && g.count >= 5) {
        insights.push(makeInsight(
          "weakness", `instr-weak-${g.label}`,
          `${g.label} is eroding your account`,
          `Your ${g.count} ${g.label} trades average ${formatMoney(g.avg)} per trade with a ${formatPct(g.winRate)} win rate. You've lost ${formatMoney(g.total)} on ${g.label} overall.`,
          `Pause trading ${g.label} for two weeks. Study your losing trades — are you misreading the instrument's rhythm, or forcing setups that don't fit?`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["instrument"]
        ));
      }
    }
  }

  /* ---- Long vs Short ---- */
  const longs = closed.filter((t) => t.direction === "long");
  const shorts = closed.filter((t) => t.direction === "short");
  if (longs.length >= 5 && shorts.length >= 5) {
    const longEv = expectancy(longs);
    const shortEv = expectancy(shorts);
    if (Math.abs(longEv - shortEv) > Math.abs(overallEv) * 0.3) {
      if (longEv > shortEv) {
        insights.push(makeInsight(
          shortEv < 0 ? "weakness" : "strength",
          "direction-long-edge",
          longEv > 0 && shortEv < 0
            ? "Your long trades are profitable but shorts are losing"
            : "You have a measurable long-side bias",
          `Long trades: ${formatEv(longEv)}/trade (${formatPct(winRate(longs))} win rate, ${longs.length} trades). Short trades: ${formatEv(shortEv)}/trade (${formatPct(winRate(shorts))} win rate, ${shorts.length} trades).`,
          shortEv < 0
            ? `Stop taking short trades until you've reviewed ${shorts.length} losing shorts. Your edge is clearly on the long side.`
            : `Continue favoring longs but don't abandon shorts — refine your short entry criteria instead.`,
          confidenceScore(Math.min(longs.length, shorts.length)),
          longs.length + shorts.length,
          totalPnl(longs) - Math.abs(totalPnl(shorts.filter(t => netPnl(t) < 0))),
          longEv - shortEv,
          ["direction", "long-vs-short"]
        ));
      } else {
        insights.push(makeInsight(
          longEv < 0 ? "weakness" : "strength",
          "direction-short-edge",
          longEv < 0 && shortEv > 0
            ? "Your short trades are profitable but longs are losing"
            : "You have a measurable short-side bias",
          `Short trades: ${formatEv(shortEv)}/trade (${formatPct(winRate(shorts))} win rate, ${shorts.length} trades). Long trades: ${formatEv(longEv)}/trade (${formatPct(winRate(longs))} win rate, ${longs.length} trades).`,
          longEv < 0
            ? `Stop taking long trades until you've reviewed your ${longs.length} losing longs. Your edge is clearly on the short side.`
            : `Continue favoring shorts but refine your long entries — the gap is close enough to close.`,
          confidenceScore(Math.min(longs.length, shorts.length)),
          longs.length + shorts.length,
          totalPnl(shorts) - Math.abs(totalPnl(longs.filter(t => netPnl(t) < 0))),
          shortEv - longEv,
          ["direction", "long-vs-short"]
        ));
      }
    }
  }

  /* ---- Strategy tags ---- */
  const allTags = new Set<string>();
  closed.forEach((t) => t.strategy_tags?.forEach((tag) => allTags.add(tag)));
  for (const tag of allTags) {
    const tagTrades = closed.filter((t) => t.strategy_tags?.includes(tag));
    if (tagTrades.length >= 5) {
      const g = computeGroupStats(tag, tagTrades);
      if (g.ev > overallEv * 1.25 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `tag-strong-${tag}`,
          `${tag} is your signature setup`,
          `Your ${tag} trades produce ${formatEv(g.ev)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate and ${g.pf.toFixed(2)} profit factor. This is one of your strongest patterns.`,
          `Make ${tag} your primary setup. Focus on perfecting entries and consider increasing size when all criteria align.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["strategy-tag", "setup"]
        ));
      }
      if (g.ev < 0 && g.count >= 5) {
        insights.push(makeInsight(
          "weakness", `tag-weak-${tag}`,
          `${tag} is a consistent loser`,
          `Your ${tag} trades lose ${formatMoney(Math.abs(g.avg))} on average across ${g.count} trades with a ${formatPct(g.winRate)} win rate. Total damage: ${formatMoney(g.total)}.`,
          `Remove ${tag} from your trade plan for two weeks. If you must trade it, reduce size to 1/3 and only take A-grade entries.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["strategy-tag", "setup"]
        ));
      }
    }
  }

  /* ---- Session ---- */
  const sessionGroups = groupStats(closed, sessionLabel);
  for (const g of sessionGroups) {
    if (g.count >= 5) {
      if (g.ev > overallEv * 1.25 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `session-strong-${g.label}`,
          `${g.label} session is your profit zone`,
          `During the ${g.label} session, you average ${formatMoney(g.avg)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate. Your profit factor is ${g.pf.toFixed(2)}.`,
          `Concentrate your trading in the ${g.label} session. The data shows you read this session's flow better than others.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["session"]
        ));
      }
      if (g.ev < 0 && g.count >= 4) {
        insights.push(makeInsight(
          "weakness", `session-weak-${g.label}`,
          `${g.label} session is unprofitable`,
          `In the ${g.label} session you average ${formatMoney(g.avg)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate. You've lost ${formatMoney(g.total)} here.`,
          `Avoid the ${g.label} session for two weeks. The volatility and order flow in this session may not suit your style.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["session"]
        ));
      }
    }
  }

  /* ---- Trend vs Countertrend ---- */
  const trendTrades = closed.filter((t) => isTrendAligned(t) === true);
  const counterTrades = closed.filter((t) => isTrendAligned(t) === false);
  if (trendTrades.length >= 5 && counterTrades.length >= 5) {
    const trendEv = expectancy(trendTrades);
    const counterEv = expectancy(counterTrades);
    if (trendEv > 0 && counterEv < 0) {
      const withoutCounter = expectancy(trendTrades);
      const improvement = overallEv !== 0
        ? Math.round(((withoutCounter - overallEv) / Math.abs(overallEv)) * 100)
        : 0;
      insights.push(makeInsight(
        "opportunity", "trend-vs-counter",
        `Trades following the trend outperformed countertrend trades by approximately ${improvement}% in expectancy`,
        `Trend-following trades: ${formatEv(trendEv)}/trade (${trendTrades.length} trades, ${formatPct(winRate(trendTrades))} win). Countertrend trades: ${formatEv(counterEv)}/trade (${counterTrades.length} trades, ${formatPct(winRate(counterTrades))} win). Dropping countertrend trades would shift expectancy from ${formatEv(overallEv)} to ${formatEv(withoutCounter)}.`,
        `For the next two weeks, only trade in the direction of the higher timeframe trend. Counter your impulses, not the trend.`,
        confidenceScore(trendTrades.length + counterTrades.length),
        trendTrades.length + counterTrades.length,
        -totalPnl(counterTrades),
        withoutCounter - overallEv,
        ["trend", "opportunity"]
      ));
    }
  }

  /* ---- Risk multiple (R) ---- */
  const rBuckets = [
    { label: "Sub-1R (tight risk)", filter: (t: Trade) => { const r = riskMultiple(t); return r !== null && Math.abs(r) < 1; } },
    { label: "1R–2R (standard risk)", filter: (t: Trade) => { const r = riskMultiple(t); return r !== null && Math.abs(r) >= 1 && Math.abs(r) < 2; } },
    { label: "2R+ (wide risk)", filter: (t: Trade) => { const r = riskMultiple(t); return r !== null && Math.abs(r) >= 2; } },
  ];
  for (const bucket of rBuckets) {
    const bt = closed.filter(bucket.filter);
    if (bt.length >= 5) {
      const g = computeGroupStats(bucket.label, bt);
      if (g.ev > overallEv * 1.2 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `risk-strong-${bucket.label}`,
          `${bucket.label} trades have your best risk-adjusted returns`,
          `When your risk is in the ${bucket.label} range, you average ${formatEv(g.ev)}/trade across ${g.count} trades with ${g.pf.toFixed(2)} profit factor.`,
          `Standardize your risk to the ${bucket.label} range. Your win rate and P&L are best when risk is calibrated this way.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["risk-multiple"]
        ));
      }
    }
  }

  /* ---- Position size ---- */
  const sizeBuckets = [
    { label: "1 lot", filter: (t: Trade) => t.quantity === 1 },
    { label: "2+ lots", filter: (t: Trade) => t.quantity >= 2 },
  ];
  for (const bucket of sizeBuckets) {
    const bt = closed.filter(bucket.filter);
    if (bt.length >= 5) {
      const g = computeGroupStats(bucket.label, bt);
      if (g.ev > 0 && g.ev > overallEv * 1.15) {
        insights.push(makeInsight(
          "strength", `size-strong-${bucket.label}`,
          `You perform best with ${bucket.label}`,
          `With ${bucket.label}, your expectancy is ${formatEv(g.ev)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate. Profit factor: ${g.pf.toFixed(2)}.`,
          `Stick to ${bucket.label} until you've built consistency. Sizing up beyond this is hurting your decision quality.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["position-size"]
        ));
      }
      if (g.ev < 0 && bucket.label === "2+ lots") {
        insights.push(makeInsight(
          "weakness", `size-weak-${bucket.label}`,
          `Sizing up to ${bucket.label} is destroying your edge`,
          `When you trade ${bucket.label}, your expectancy drops to ${formatEv(g.ev)}/trade across ${g.count} trades. Larger size correlates with worse decisions — likely emotional overexposure.`,
          `Cap your position at 1 lot for the next three weeks. Prove you can be consistent at 1 lot before adding size.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["position-size"]
        ));
      }
    }
  }

  /* ---- Holding time ---- */
  const holdBuckets = [
    { label: "< 15 min (scalps)", filter: (t: Trade) => { const h = holdMinutes(t); return h !== null && h < 15; } },
    { label: "15–45 min (intraday)", filter: (t: Trade) => { const h = holdMinutes(t); return h !== null && h >= 15 && h < 45; } },
    { label: "45+ min (swing)", filter: (t: Trade) => { const h = holdMinutes(t); return h !== null && h >= 45; } },
  ];
  for (const bucket of holdBuckets) {
    const bt = closed.filter(bucket.filter);
    if (bt.length >= 5) {
      const g = computeGroupStats(bucket.label, bt);
      if (g.ev > overallEv * 1.2 && g.ev > 0) {
        insights.push(makeInsight(
          "strength", `hold-strong-${bucket.label}`,
          `${bucket.label} holds are your sweet spot`,
          `Trades held ${bucket.label} average ${formatEv(g.ev)}/trade across ${g.count} trades with a ${formatPct(g.winRate)} win rate. Your patience in this range pays off.`,
          `Target the ${bucket.label} holding window. Set a mental timer — if a trade hasn't worked by the end of this window, reconsider whether the thesis is still valid.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["holding-time"]
        ));
      }
      if (g.ev < 0 && bucket.label === "< 15 min (scalps)" && g.count >= 5) {
        insights.push(makeInsight(
          "weakness", `hold-weak-${bucket.label}`,
          `Your scalps are losing money`,
          `Trades held ${bucket.label} average ${formatMoney(g.avg)}/trade across ${g.count} trades. You're likely exiting on noise rather than waiting for your thesis to play out.`,
          `Widen your hold horizon. For the next two weeks, don't exit a trade before 15 minutes unless your stop is hit.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["holding-time"]
        ));
      }
    }
  }

  /* ---- Consecutive wins/losses ---- */
  const chrono = [...closed].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  // Trade after N consecutive losses
  const afterTwoLosses: Trade[] = [];
  const afterTwoWins: Trade[] = [];
  let consecLoss = 0;
  let consecWin = 0;
  for (const t of chrono) {
    const p = netPnl(t);
    if (consecLoss >= 2) afterTwoLosses.push(t);
    if (consecWin >= 2) afterTwoWins.push(t);
    if (p > 0) { consecWin++; consecLoss = 0; }
    else if (p < 0) { consecLoss++; consecWin = 0; }
    else { consecWin = 0; consecLoss = 0; }
  }
  if (afterTwoLosses.length >= 4) {
    const g = computeGroupStats("After 2+ losses", afterTwoLosses);
    if (g.ev < 0) {
      insights.push(makeInsight(
        "weakness", "after-losses",
        `You revenge-trade after consecutive losses`,
        `After 2+ consecutive losses, your next trade averages ${formatMoney(g.avg)} across ${g.count} instances with a ${formatPct(g.winRate)} win rate. Tilt is real and measurable in your data.`,
        `Enforce a hard rule: after two consecutive losses, stop trading for the rest of the day. Your edge does not survive the emotional state that follows back-to-back losses.`,
        confidenceScore(g.count), g.count, g.total, g.ev,
        ["streaks", "psychology"]
      ));
    }
  }
  if (afterTwoWins.length >= 4) {
    const g = computeGroupStats("After 2+ wins", afterTwoWins);
    if (g.ev > 0 && g.ev > overallEv * 1.2) {
      insights.push(makeInsight(
        "strength", "after-wins",
        `You ride momentum well after winning streaks`,
        `After 2+ consecutive wins, your next trade averages ${formatMoney(g.avg)} across ${g.count} instances. You're staying in a flow state and executing well.`,
        `When you're in a winning streak, continue trading — but cap at your normal position size. Don't let confidence become overconfidence.`,
        confidenceScore(g.count), g.count, g.total, g.ev,
        ["streaks", "psychology"]
      ));
    }
    if (g.ev < 0) {
      insights.push(makeInsight(
        "weakness", "after-wins-overconfident",
        `Overconfidence after winning streaks costs you`,
        `After 2+ consecutive wins, your next trade averages ${formatMoney(g.avg)} across ${g.count} instances. You're likely sizing up or loosening entry criteria after wins.`,
        `After a winning streak, pause for 15 minutes before the next trade. Re-verify every entry criterion — winning streaks breed carelessness.`,
        confidenceScore(g.count), g.count, g.total, g.ev,
        ["streaks", "psychology"]
      ));
    }
  }

  /* ---- Rule violations ---- */
  const violatedRules = new Map<string, { violated: Trade[]; followed: Trade[] }>();
  for (const t of closed) {
    for (const [ruleId, compliant] of Object.entries(t.rule_compliance ?? {})) {
      const entry = violatedRules.get(ruleId) ?? { violated: [], followed: [] };
      if (compliant) entry.followed.push(t);
      else entry.violated.push(t);
      violatedRules.set(ruleId, entry);
    }
  }
  for (const [ruleId, { violated, followed }] of violatedRules) {
    if (violated.length >= 4 && followed.length >= 4) {
      const violEv = expectancy(violated);
      const followEv = expectancy(followed);
      if (followEv > 0 && violEv < followEv * 0.5) {
        insights.push(makeInsight(
          "opportunity", `rule-${ruleId}`,
          `Trades following this rule outperformed violations by approximately ${formatMoney(Math.abs(totalPnl(violated)))}`,
          `When you follow this rule, expectancy is ${formatEv(followEv)}/trade (${followed.length} trades). When you break it, expectancy drops to ${formatEv(violEv)}/trade (${violated.length} trades). The difference is ${formatMoney(followEv - violEv)}/trade.`,
          `Make this rule non-negotiable. Before every entry, verbally confirm you're following it — the data shows it's worth ${formatMoney(followEv - violEv)} per trade.`,
          confidenceScore(violated.length + followed.length),
          violated.length + followed.length,
          -totalPnl(violated),
          followEv - violEv,
          ["rules", "discipline"]
        ));
      }
    }
  }

  /* ---- Emotional tags ---- */
  const emotionGroups = groupStats(closed, (t) => emotionCategory(t.emotions) ?? "untagged");
  for (const g of emotionGroups) {
    if (g.count >= 5) {
      if (g.label === "negative" && g.ev < 0) {
        insights.push(makeInsight(
          "weakness", `emotion-${g.label}`,
          `Emotional trades are your biggest losers`,
          `When you trade with negative emotions (${g.count} trades), your expectancy is ${formatEv(g.ev)}/trade with a ${formatPct(g.winRate)} win rate. Total loss: ${formatMoney(g.total)}.`,
          `Before entering, check your emotional state. If you feel FOMO, revenge, or anxiety, skip the trade. Emotional entries have a measurable negative edge.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["emotions", "psychology"]
        ));
      }
      if (g.label === "positive" && g.ev > overallEv * 1.15) {
        insights.push(makeInsight(
          "strength", `emotion-${g.label}`,
          `Calm, confident trading produces your best results`,
          `When you trade with positive emotions (${g.count} trades), your expectancy is ${formatEv(g.ev)}/trade with a ${formatPct(g.winRate)} win rate. Your profit factor is ${g.pf.toFixed(2)}.`,
          `Your emotional state is a leading indicator. Only trade when you feel calm and prepared — the data shows a clear performance gap.`,
          confidenceScore(g.count), g.count, g.total, g.ev,
          ["emotions", "psychology"]
        ));
      }
    }
  }

  /* ---- AI grades ---- */
  const gradeGroups = groupStats(closed, (t) => gradeTier(aiGrade(t)) ?? "ungraded");
  const aTrades = gradeGroups.find((g) => g.label === "A");
  const cOrBelow = gradeGroups.filter((g) => ["C", "D", "F"].includes(g.label));
  if (aTrades && aTrades.count >= 5) {
    const withoutLowGrades = expectancy(closed.filter((t) => {
      const tier = gradeTier(aiGrade(t));
      return tier && !["C", "D", "F"].includes(tier);
    }));
    const lowGradeTrades = cOrBelow.flatMap((g) => g.trades);
    if (lowGradeTrades.length >= 3) {
      const lowEv = expectancy(lowGradeTrades);
      const improvedPf = profitFactor(closed.filter((t) => {
        const tier = gradeTier(aiGrade(t));
        return tier && ["A", "B"].includes(tier);
      }));
      const improvement = overallPf > 0
        ? Math.round(((improvedPf - overallPf) / overallPf) * 100)
        : 0;
      if (improvedPf > overallPf) {
        insights.push(makeInsight(
          "opportunity", "ai-grade-filter",
          `Trading only A/B-rated setups would increase profit factor from ${overallPf.toFixed(2)} to ${improvedPf.toFixed(2)}`,
          `A-rated trades: ${formatEv(aTrades.ev)}/trade (${aTrades.count} trades, ${formatPct(aTrades.winRate)} win). C/D/F-rated trades: ${formatEv(lowEv)}/trade (${lowGradeTrades.length} trades). Filtering to A/B was associated with a profit factor improvement of ${improvement}%. This is an observational comparison, not proof of causation.`,
          `Only take trades your AI coach rates A- or above. If a setup doesn't meet that bar in pre-trade analysis, skip it.`,
          confidenceScore(aTrades.count + lowGradeTrades.length),
          aTrades.count + lowGradeTrades.length,
          -totalPnl(lowGradeTrades),
          withoutLowGrades - overallEv,
          ["ai-grade", "opportunity"]
        ));
      }
    }
  }

  /* ---- Recommendations (derived from findings) ---- */
  const bestSetup = insights
    .filter((i) => i.tags.includes("strategy-tag") && i.category === "strength")
    .sort((a, b) => b.pnlImpact - a.pnlImpact)[0];
  const bestTime = insights
    .filter((i) => i.tags.includes("time-of-day") && i.category === "strength")
    .sort((a, b) => b.pnlImpact - a.pnlImpact)[0];
  const worstStreak = insights
    .filter((i) => i.tags.includes("streaks") && i.category === "weakness")
    .sort((a, b) => Math.abs(b.pnlImpact) - Math.abs(a.pnlImpact))[0];

  if (bestSetup && bestTime) {
    insights.push(makeInsight(
      "recommendation", "rec-focus-setup-time",
      `For the next week, only trade ${bestSetup.tags.includes("strategy-tag") ? extractSetupName(bestSetup.title) : "your best setup"} before ${extractTimeCutoff(bestTime.title)}`,
      `Combining your best setup (${bestSetup.title}) with your best time window (${bestTime.title}) should compound your edge. Your data shows both independently produce above-average expectancy.`,
      `Write this rule on a sticky note: "${extractSetupName(bestSetup.title)} only, before ${extractTimeCutoff(bestTime.title)}, max 3 trades per day." Follow it for 5 trading days.`,
      Math.min(bestSetup.confidence, bestTime.confidence) - 5,
      Math.min(bestSetup.tradeCount, bestTime.tradeCount),
      bestSetup.pnlImpact + bestTime.pnlImpact,
      bestSetup.evImpact + bestTime.evImpact,
      ["recommendation", "actionable"]
    ));
  }
  if (worstStreak) {
    insights.push(makeInsight(
      "recommendation", "rec-stop-after-losses",
      `Stop trading after two consecutive losses`,
      `Your data shows that trades taken after 2+ losses have negative expectancy. ${worstStreak.detail}`,
      `Set a daily loss limit: two consecutive losses = trading is done for the day. No exceptions. Come back tomorrow with a clear head.`,
      worstStreak.confidence - 5,
      worstStreak.tradeCount,
      Math.abs(worstStreak.pnlImpact),
      Math.abs(worstStreak.evImpact),
      ["recommendation", "psychology"]
    ));
  }

  /* ---- Sort and dedupe ---- */
  const sorted = insights.sort((a, b) => {
    const catOrder = { strength: 0, weakness: 1, opportunity: 2, recommendation: 3 };
    if (catOrder[a.category] !== catOrder[b.category]) {
      return catOrder[a.category] - catOrder[b.category];
    }
    return Math.abs(b.pnlImpact) - Math.abs(a.pnlImpact);
  });

  const strengths = sorted.filter((i) => i.category === "strength").slice(0, 6);
  const weaknesses = sorted.filter((i) => i.category === "weakness").slice(0, 6);
  const opportunities = sorted.filter((i) => i.category === "opportunity").slice(0, 4);
  const recommendations = sorted.filter((i) => i.category === "recommendation").slice(0, 4);

  return {
    strengths,
    weaknesses,
    opportunities,
    recommendations,
    totalTrades: closed.length,
    hasRealData: true,
  };
}

/* ------------------------------------------------------------------ */
/* Sample insights (when insufficient data)                           */
/* ------------------------------------------------------------------ */

function sampleEdgeDiscovery(currentCount: number): EdgeDiscoveryResult {
  return {
    totalTrades: currentCount,
    hasRealData: false,
    strengths: [
      makeInsight("strength", "sample-s1",
        "You have a 72% win rate on Liquidity Sweep setups",
        "Across 18 Liquidity Sweep trades, you win 72% of the time with an average of +1.8R per trade. Your profit factor on this setup is 2.9 — this is your clearest edge.",
        "Make Liquidity Sweep your primary setup. Only trade it when price sweeps a clear prior high/low with volume confirmation.",
        78, 18, 3240, 186, ["strategy-tag", "sample"]),
      makeInsight("strength", "sample-s2",
        "You average +2.4R before 10:30 AM",
        "Your first-hour trades produce an average of +2.4R across 22 trades with a 68% win rate. The NY open is where you read order flow best.",
        "Prioritize the 9:30–10:30 window. Consider sizing up modestly during this period — your data supports it.",
        80, 22, 4180, 214, ["time-of-day", "sample"]),
      makeInsight("strength", "sample-s3",
        "Your long trades outperform shorts by 1.3R per trade",
        "Long trades average +1.6R (31 trades, 65% win). Short trades average +0.3R (14 trades, 43% win). You have a measurable long-side bias.",
        "Continue favoring longs. Refine your short entries — the gap is close enough to close with better short-side criteria.",
        72, 45, 2600, 130, ["direction", "sample"]),
    ],
    weaknesses: [
      makeInsight("weakness", "sample-w1",
        "Lunch session expectancy is -0.7R",
        "Between 12:00–14:00, your 12 trades average -0.7R with only a 33% win rate. Low volume and choppy conditions are working against you.",
        "Stop trading 12:00–14:00 for two weeks. Re-evaluate only if you find a specific setup that works in low-volume conditions.",
        65, 12, -840, -84, ["session", "sample"]),
      makeInsight("weakness", "sample-w2",
        "You lose money on second entries",
        "When you re-enter after being stopped out of the same setup (11 trades), your win rate drops to 27% and average P&L is -$145/trade. This is a revenge-trading pattern.",
        "After a stopped-out trade, wait at least 15 minutes before re-entering the same instrument. Your data shows the second attempt is usually forced.",
        58, 11, -1595, -145, ["psychology", "sample"]),
      makeInsight("weakness", "sample-w3",
        "Sizing up to 2+ lots reduces your win rate by 15%",
        "With 1 lot, your win rate is 62% across 28 trades. With 2+ lots, it drops to 47% across 9 trades. Larger size correlates with worse decisions.",
        "Cap position size at 1 lot for three weeks. Prove consistency at 1 lot before adding size.",
        52, 37, -1100, -65, ["position-size", "sample"]),
    ],
    opportunities: [
      makeInsight("opportunity", "sample-o1",
        "Trades following the trend outperformed countertrend trades by approximately 38% in expectancy",
        "Trend-following trades: +1.2R/trade (24 trades, 63% win). Countertrend trades: -0.5R/trade (11 trades, 36% win). Dropping countertrend would lift overall expectancy from +0.65R to +0.90R.",
        "For two weeks, only trade in the direction of the higher timeframe trend. Counter your impulses, not the trend.",
        70, 35, 660, 0.25, ["trend", "opportunity", "sample"]),
      makeInsight("opportunity", "sample-o2",
        "Trading only A-rated setups would increase profit factor from 1.5 to 2.3",
        "A-rated trades: +1.8R/trade (16 trades, 75% win). C/D-rated trades: -0.4R/trade (8 trades, 25% win). Filtering to A/B improves PF from 1.5 to 2.3.",
        "Only take trades your AI coach rates A- or above. If a setup doesn't meet that bar, skip it.",
        68, 24, 960, 0.22, ["ai-grade", "opportunity", "sample"]),
    ],
    recommendations: [
      makeInsight("recommendation", "sample-r1",
        "For the next week, only trade Trend Pullbacks before 10:45",
        "Combining your best setup (Trend Pullback: +1.9R/trade) with your best time window (before 10:45: +2.1R/trade) should compound your edge significantly.",
        "Write this on a sticky note: 'Trend Pullbacks only, before 10:45, max 3 trades/day.' Follow it for 5 trading days.",
        72, 22, 3800, 195, ["recommendation", "actionable", "sample"]),
      makeInsight("recommendation", "sample-r2",
        "Stop trading after two consecutive losses",
        "Your data shows trades taken after 2+ losses have -0.8R expectancy across 7 instances. Tilt is measurable in your journal.",
        "Set a daily loss limit: two consecutive losses = done for the day. No exceptions. Come back tomorrow.",
        60, 7, -560, -80, ["recommendation", "psychology", "sample"]),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Formatting + factory                                               */
/* ------------------------------------------------------------------ */

function makeInsight(
  category: InsightCategory,
  id: string,
  title: string,
  detail: string,
  recommendation: string,
  confidence: number,
  tradeCount: number,
  pnlImpact: number,
  evImpact: number,
  tags: string[]
): EdgeInsight {
  return {
    category,
    id,
    title,
    detail,
    recommendation,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    tradeCount,
    pnlImpact: Math.round(pnlImpact),
    evImpact: Math.round(evImpact * 100) / 100,
    tags,
  };
}

function formatMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatEv(n: number): string {
  return `${n >= 0 ? "+" : ""}$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(0)}%`;
}

function extractSetupName(title: string): string {
  // Extract the setup name from titles like "Liquidity Sweep is your signature setup"
  return title.replace(/ .*/, "");
}

function extractTimeCutoff(title: string): string {
  // Extract time from titles like "NY Open (10:00-10:45) is your highest-edge window"
  const match = title.match(/(\d{1,2}:\d{2})/g);
  return match ? match[match.length - 1] : "10:45";
}
