import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface TradeRow {
  id: string;
  instrument: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  quantity: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  fees: number;
  setup: string | null;
  market_session: string | null;
  emotions: string | null;
  mistakes: string | null;
  notes: string | null;
  rule_compliance: Record<string, boolean> | null;
  discipline_score: number | null;
  strategy_tags: string[] | null;
  ai_analysis: {
    grade?: string;
    scores?: {
      setupQuality?: number;
      entryTiming?: number;
      exitTiming?: number;
      riskManagement?: number;
      emotionalDiscipline?: number;
      ruleCompliance?: number;
    };
  } | null;
}

interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

interface PatternRef {
  patternKey: string;
  label: string;
  category: string;
  confidenceTier: string;
  tradeCount: number;
  expectancy: number | null;
  netPnl: number | null;
  recommendedAction: string;
}

interface TraderProfile {
  builtAt: string;
  totalTrades: number;
  closedTrades: number;
  primaryInstruments: { name: string; tradeCount: number; winRate: number; netPnl: number }[];
  preferredSessions: { name: string; tradeCount: number; winRate: number; netPnl: number }[];
  favoriteSetups: { name: string; tradeCount: number; winRate: number; netPnl: number; expectancy: number; avgR: number | null }[];
  bestPerformingSetups: { name: string; tradeCount: number; winRate: number; netPnl: number; expectancy: number; avgR: number | null }[];
  worstPerformingSetups: { name: string; tradeCount: number; winRate: number; netPnl: number; expectancy: number; avgR: number | null }[];
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
  tradingRules: {
    id: string; name: string; category: string;
    followedRate: number; violatedCount: number; violatedPnl: number; followedPnl: number;
  }[];
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
  performanceTrend: { label: string; firstHalf: number; secondHalf: number; change: string; improving: boolean }[];
  edgeDiscoveryReady: boolean;
}

interface ConversationRecord {
  id: string;
  question: string;
  answer: string;
  data_sources: { tradeCount: number; patternCount: number; ruleCount: number; sources: string[] };
  created_at: string;
}

interface CoachRequest {
  question: string;
  trades: TradeRow[];
  rules: RuleRow[];
  profile: TraderProfile | null;
  conversations: ConversationRecord[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function nyDateString(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(iso));
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return `${m.year}-${m.month}-${m.day}`;
}

function netPnl(t: TradeRow): number {
  return Number(t.pnl ?? 0) - Number(t.fees ?? 0);
}

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function fmtMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtMoney2(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMultiplier(instrument: string): number | null {
  const key = instrument.trim().toUpperCase();
  const mult: Record<string, number> = { ES: 50, MES: 5, NQ: 20, MNQ: 2 };
  if (mult[key] !== undefined) return mult[key];
  for (const sym of Object.keys(mult)) {
    if (key.startsWith(sym)) return mult[sym];
  }
  return null;
}

function rMultiple(t: TradeRow): number | null {
  if (t.stop_price === null || t.entry_price === null) return null;
  const mult = getMultiplier(t.instrument);
  if (mult === null) return null;
  const risk = Math.abs(t.entry_price - t.stop_price) * mult * t.quantity;
  if (risk === 0) return null;
  return netPnl(t) / risk;
}

function fmtR(r: number | null): string {
  if (r === null) return "N/A";
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;
}

function setupLabel(t: TradeRow): string {
  if (t.strategy_tags && t.strategy_tags.length > 0) return t.strategy_tags[0];
  return t.setup ?? "Unspecified";
}

function isTrendAligned(t: TradeRow): boolean | null {
  const tags = t.strategy_tags ?? [];
  const trendTags = ["Trend Pullback", "Trend Continuation", "Opening Range Breakout", "EMA Bounce", "Momentum", "Breakout"];
  const counterTags = ["VWAP Reversal", "Reversal", "Liquidity Sweep", "Scalp", "Range"];
  const hasTrend = tags.some((tg) => trendTags.includes(tg));
  const hasCounter = tags.some((tg) => counterTags.includes(tg));
  if (hasTrend && !hasCounter) return true;
  if (hasCounter && !hasTrend) return false;
  return null;
}

function tierLabel(tier: string): string {
  if (tier === "high_confidence") return "High-Confidence Pattern";
  if (tier === "strong") return "Strong Pattern";
  return "Emerging Pattern";
}

function tierConfidencePhrase(tier: string): string {
  if (tier === "high_confidence") return "This is a high-confidence pattern backed by 20+ trades.";
  if (tier === "strong") return "This is a strong pattern backed by 10+ trades.";
  return "This is an emerging pattern — the signal is there but the sample is still small.";
}

/* ------------------------------------------------------------------ */
/* Today's trades analysis                                            */
/* ------------------------------------------------------------------ */

function getTodayTrades(trades: TradeRow[]): TradeRow[] {
  const today = nyDateString(new Date().toISOString());
  return trades.filter((t) => nyDateString(t.entry_time) === today && t.exit_time !== null);
}

function getRecentTrades(trades: TradeRow[], days: number): TradeRow[] {
  const cutoff = Date.now() - days * 86400000;
  return trades.filter((t) => t.exit_time !== null && new Date(t.entry_time).getTime() >= cutoff);
}

/* ------------------------------------------------------------------ */
/* Data source tracking                                               */
/* ------------------------------------------------------------------ */

function classifySources(
  profile: TraderProfile | null,
  usesTrades: boolean,
  usesPatterns: boolean,
  usesTrend: boolean
): { sources: string[]; tradeCount: number; patternCount: number; ruleCount: number } {
  const sources: string[] = [];
  if (usesTrades) sources.push("verified_data");
  if (usesPatterns && profile && profile.discoveredPatterns.length > 0) {
    const hasStrong = profile.discoveredPatterns.some((p) => p.confidenceTier === "high_confidence" || p.confidenceTier === "strong");
    const hasEmerging = profile.discoveredPatterns.some((p) => p.confidenceTier === "emerging");
    if (hasStrong) sources.push("strong_pattern");
    if (hasEmerging) sources.push("emerging_pattern");
  }
  if (usesTrend && profile && profile.performanceTrend.length > 0) sources.push("trend_analysis");
  if (sources.length === 0) sources.push("ai_interpretation");

  return {
    sources,
    tradeCount: profile?.closedTrades ?? 0,
    patternCount: profile?.discoveredPatterns.length ?? 0,
    ruleCount: profile?.tradingRules.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Answer generation                                                  */
/* ------------------------------------------------------------------ */

function generateAnswer(
  question: string,
  trades: TradeRow[],
  rules: RuleRow[],
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources>; supportingTradeIds?: string[] } {
  const q = question.toLowerCase().trim();
  const closed = trades.filter((t) => t.exit_time !== null && t.pnl !== null);
  const lines: string[] = [];
  let usesPatterns = false;
  let usesTrend = false;

  /* ----- "Why did I lose money today?" / "Why am I losing?" ----- */
  if (q.includes("today") && (q.includes("loss") || q.includes("lose") || q.includes("lost") || q.includes("losing"))) {
    return answerWhyLoseToday(trades, profile, conversations);
  }
  if (q.includes("losing") || q.includes("lose money") || q.includes("why am i losing") || (q.includes("loss") && q.includes("why"))) {
    return answerWhyLosing(closed, profile, conversations);
  }

  /* ----- "Am I getting better?" / "Am I improving?" ----- */
  if (q.includes("getting better") || q.includes("improving") || q.includes("am i improving") || q.includes("progress")) {
    return answerImproving(profile, conversations);
  }

  /* ----- "What should I work on tomorrow?" / "What to work on" ----- */
  if (q.includes("tomorrow") || q.includes("work on") || q.includes("what should i do") || q.includes("next session") || q.includes("focus on")) {
    return answerTomorrow(profile, closed, conversations);
  }

  /* ----- "What is my best setup?" ----- */
  if (q.includes("best setup") || q.includes("which setup") || (q.includes("setup") && q.includes("best"))) {
    return answerBestSetup(profile, closed);
  }

  /* ----- "What mistakes do I repeat?" ----- */
  if (q.includes("mistake") || q.includes("repeat") || q.includes("same mistake")) {
    return answerMistakes(closed, trades, profile);
  }

  /* ----- "When do I trade best?" ----- */
  if (q.includes("when do i trade best") || q.includes("best time") || (q.includes("when") && q.includes("best"))) {
    return answerBestTime(closed, profile);
  }

  /* ----- "What rule costs me the most?" ----- */
  if (q.includes("rule") && (q.includes("cost") || q.includes("money") || q.includes("expensive") || q.includes("most"))) {
    return answerRuleCost(profile, closed, rules);
  }

  /* ----- "How am I doing overall?" ----- */
  if (q.includes("overview") || q.includes("how am i doing") || q.includes("summary") || q.includes("performance") || q.includes("overall")) {
    return answerOverview(closed, profile, conversations);
  }

  /* ----- "What are my strengths?" ----- */
  if (q.includes("strength") || q.includes("good at") || q.includes("what am i best")) {
    return answerStrengths(profile);
  }

  /* ----- "What is my profile?" / "What do you know about me?" ----- */
  if (q.includes("profile") || q.includes("know about me") || q.includes("remember") || q.includes("my profile")) {
    return answerProfileSummary(profile, conversations);
  }

  /* ----- Default: comprehensive answer using profile + patterns ----- */
  return answerDefault(closed, profile, conversations);
}

/* ------------------------------------------------------------------ */
/* Specific answer functions                                          */
/* ------------------------------------------------------------------ */

function answerWhyLoseToday(
  trades: TradeRow[],
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const today = getTodayTrades(trades);
  const lines: string[] = [];

  if (today.length === 0) {
    lines.push("I don't see any closed trades for today. If you have open positions, let me know once they close and I can analyze them.");
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  const todayPnl = today.reduce((s, t) => s + netPnl(t), 0);
  const winners = today.filter((t) => netPnl(t) > 0);
  const losers = today.filter((t) => netPnl(t) < 0);

  if (todayPnl >= 0) {
    lines.push(`Actually, today you're **${fmtMoney(todayPnl)}** across ${today.length} trade${today.length > 1 ? "s" : ""} — so you're in the green.`);
    if (losers.length > 0) {
      lines.push(`\nThat said, you did have ${losers.length} losing trade${losers.length > 1 ? "s" : ""} today. Here's what I see:`);
    }
  } else {
    lines.push(`Today you lost **${fmtMoney(todayPnl)}** across ${today.length} trade${today.length > 1 ? "s" : ""} (${winners.length} winner${winners.length !== 1 ? "s" : ""}, ${losers.length} loser${losers.length !== 1 ? "s" : ""}).`);
    lines.push(`\nHere's what I see caused the damage:`);
  }

  // Analyze today's losers
  const causes: string[] = [];

  // Countertrend
  const counterToday = today.filter((t) => isTrendAligned(t) === false);
  if (counterToday.length > 0) {
    const counterPnl = counterToday.reduce((s, t) => s + netPnl(t), 0);
    causes.push(`${counterToday.length} countertrend trade${counterToday.length > 1 ? "s" : ""} (${fmtMoney(counterPnl)})`);
    // Reference pattern if available
    const trendPattern = profile?.discoveredPatterns.find((p) => p.patternKey.includes("trend_vs_counter"));
    if (trendPattern) {
      causes.push(`This is consistent with a pattern we've identified across your last ${profile.closedTrades} trades: ${trendPattern.label}. ${tierConfidencePhrase(trendPattern.confidenceTier)}`);
    }
  }

  // Emotional
  const negEmotions = ["fomo", "revenge", "fear", "panic", "greed", "anxious", "tilt", "angry", "frustrat"];
  const emotionalToday = today.filter((t) => {
    const e = (t.emotions ?? "").toLowerCase();
    return negEmotions.some((n) => e.includes(n));
  });
  if (emotionalToday.length > 0) {
    const emPnl = emotionalToday.reduce((s, t) => s + netPnl(t), 0);
    causes.push(`${emotionalToday.length} emotionally-driven trade${emotionalToday.length > 1 ? "s" : ""} (${fmtMoney(emPnl)})`);
    if (profile && profile.psychologicalPatterns.emotionalTradeCount > 0) {
      causes.push(`Across your full history, emotional trades are associated with ${fmtMoney(profile.psychologicalPatterns.emotionalPnl)} in net P&L over ${profile.psychologicalPatterns.emotionalTradeCount} trades — today fits that pattern. This is an observational association, not proof of causation.`);
    }
  }

  // Rule violations
  const violatedToday: string[] = [];
  for (const t of today) {
    const comp = t.rule_compliance ?? {};
    for (const [ruleId, compliant] of Object.entries(comp)) {
      if (!compliant) {
        const rule = profile?.tradingRules.find((r) => r.id === ruleId);
        violatedToday.push(rule?.name ?? "a trading rule");
      }
    }
  }
  if (violatedToday.length > 0) {
    const unique = [...new Set(violatedToday)];
    causes.push(`You violated ${violatedToday.length} rule${violatedToday.length > 1 ? "s" : ""} today: ${unique.join(", ")}`);
  }

  // No stop
  const noStopToday = today.filter((t) => t.stop_price === null);
  if (noStopToday.length > 0) {
    causes.push(`${noStopToday.length} trade${noStopToday.length > 1 ? "s" : ""} without a defined stop loss`);
  }

  // Oversized
  const oversized = today.filter((t) => t.quantity >= 3);
  if (oversized.length > 0) {
    causes.push(`${oversized.length} oversized position${oversized.length > 1 ? "s" : ""} (3+ lots)`);
    const sizePattern = profile?.discoveredPatterns.find((p) => p.patternKey.includes("position_size:oversized"));
    if (sizePattern) {
      causes.push(`Your data shows 3+ lot sizing consistently loses — ${tierConfidencePhrase(sizePattern.confidenceTier)}`);
    }
  }

  if (causes.length === 0) {
    lines.push(`\nI don't see an obvious behavioral cause in today's trades. Sometimes the market just doesn't cooperate — review your entries to make sure your thesis was sound, then let it go.`);
  } else {
    lines.push(`\n${causes.join("\n\n")}`);
  }

  // Reference conversation history
  const prevLossDiscussion = conversations.find((c) =>
    c.question.toLowerCase().includes("losing") || c.question.toLowerCase().includes("lost")
  );
  if (prevLossDiscussion && profile) {
    lines.push(`\nWe've discussed your losses before. Based on your profile, your highest-impact fix remains: ${profile.currentImprovementGoal ?? "improving discipline"}`);
  }

  lines.push(`\n_Based on ${today.length} of today's trades and ${profile?.closedTrades ?? 0} total closed trades in your profile._`);

  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerWhyLosing(
  closed: TradeRow[],
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];
  const totalNet = closed.reduce((s, t) => s + netPnl(t), 0);

  if (totalNet >= 0) {
    lines.push(`Good news — you're actually net positive at ${fmtMoney(totalNet)} across ${closed.length} closed trades. But let's look at where the leaks are:`);
  } else {
    lines.push(`You're net ${fmtMoney(totalNet)} across ${closed.length} closed trades. Here's a breakdown of what's costing you:`);
  }

  // Use discovered patterns for the primary explanation
  const leakPatterns = profile?.discoveredPatterns
    .filter((p) => p.category === "behavioral_leak" || p.category === "weakness" || p.category === "risk_pattern")
    .sort((a, b) => Math.abs(b.netPnl ?? 0) - Math.abs(a.netPnl ?? 0))
    .slice(0, 3) ?? [];

  if (leakPatterns.length > 0) {
    lines.push(`\nYour Edge Discovery Engine has identified these patterns across your trade history:`);
    for (const p of leakPatterns) {
      lines.push(`• **${p.label}** — ${p.tradeCount} trades, ${fmtMoney(p.netPnl ?? 0)} net P&L. ${tierLabel(p.confidenceTier)}.`);
    }
    lines.push(`\nYour single highest-impact fix: ${profile?.currentImprovementGoal ?? "addressing your top behavioral leak"}`);
  } else {
    // Fall back to direct analysis
    const wins = closed.filter((t) => netPnl(t) > 0);
    const losses = closed.filter((t) => netPnl(t) < 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;

    if (avgLoss > avgWin) {
      lines.push(`\nYour average loss ($${avgLoss.toFixed(0)}) is larger than your average win ($${avgWin.toFixed(0)}). Your winners don't cover your losers.`);
    }
    if (profile && profile.psychologicalPatterns.emotionalTradeCount > 0) {
      lines.push(`\n${profile.psychologicalPatterns.emotionalTradeCount} trades were taken under negative emotions, costing ${fmtMoney(profile.psychologicalPatterns.emotionalPnl)}.`);
    }
    if (profile && profile.riskPreferences.noStopCount > 0) {
      lines.push(`\n${profile.riskPreferences.noStopCount} trades had no stop loss — those netted ${fmtMoney(profile.riskPreferences.noStopPnl)}.`);
    }
  }

  lines.push(`\n_Based on ${closed.length} closed trades${profile && profile.discoveredPatterns.length > 0 ? ` and ${profile.discoveredPatterns.length} discovered patterns` : ""}._`);

  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, leakPatterns.length > 0, false) };
}

function answerImproving(
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  if (!profile || profile.performanceTrend.length === 0) {
    lines.push("I don't have enough data to measure your improvement trend yet. I need at least 16 closed trades to split your history into two halves and compare. Keep logging trades and I'll be able to show you exactly how you're progressing.");
    lines.push(`\n_Based on ${profile?.closedTrades ?? 0} closed trades — insufficient for trend analysis._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  const trends = profile.performanceTrend;
  const improving = trends.filter((t) => t.improving);
  const declining = trends.filter((t) => !t.improving);

  if (improving.length > declining.length) {
    lines.push("**Yes, you're getting better.** Here's what the data shows:");
  } else if (improving.length < declining.length) {
    lines.push("Your performance is actually **declining** in several areas. Here's the data:");
  } else {
    lines.push("Your performance is **mixed** — some metrics are improving, others aren't. Here's the breakdown:");
  }

  lines.push("");
  for (const t of trends) {
    const arrow = t.improving ? "↗" : "↘";
    lines.push(`• ${t.label}: ${t.firstHalf.toFixed(1)} → ${t.secondHalf.toFixed(1)} (${arrow} ${t.change})`);
  }

  // Reference a specific example
  const wrTrend = trends.find((t) => t.label === "Win rate");
  const evTrend = trends.find((t) => t.label === "Expectancy per trade");
  const rcTrend = trends.find((t) => t.label === "Rule compliance");

  if (rcTrend && rcTrend.improving) {
    lines.push(`\nYour rule compliance increased from ${rcTrend.firstHalf.toFixed(0)}% to ${rcTrend.secondHalf.toFixed(0)}% over your most recent trades. That's a meaningful behavioral improvement.`);
  }
  if (evTrend) {
    lines.push(`Your average expectancy shifted from ${fmtMoney2(evTrend.firstHalf)} to ${fmtMoney2(evTrend.secondHalf)} per trade.`);
  }

  // Check for previous conversations about improvement
  const prevProgressQ = conversations.find((c) =>
    c.question.toLowerCase().includes("improving") || c.question.toLowerCase().includes("getting better")
  );
  if (prevProgressQ) {
    lines.push(`\nYou've asked about your progress before. Comparing to your full history, the trend above reflects your most recent trades vs. your earlier ones.`);
  }

  if (profile.currentImprovementGoal) {
    lines.push(`\nYour current improvement focus: ${profile.currentImprovementGoal}`);
  }

  lines.push(`\n_Based on ${profile.closedTrades} closed trades, split into first and second halves for trend analysis._`);

  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, true) };
}

function answerTomorrow(
  profile: TraderProfile | null,
  closed: TradeRow[],
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  if (!profile || profile.closedTrades < 5) {
    lines.push("I need more trade data before I can give you a specific plan for tomorrow. Log at least 5 closed trades and I'll be able to identify your highest-impact improvement area.");
    lines.push(`\n_Based on ${profile?.closedTrades ?? 0} trades — insufficient for targeted recommendations._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  // Highest-impact behavioral leak
  const behavioralLeaks = profile.discoveredPatterns
    .filter((p) => p.category === "behavioral_leak")
    .sort((a, b) => Math.abs(b.netPnl ?? 0) - Math.abs(a.netPnl ?? 0));

  if (behavioralLeaks.length > 0) {
    const top = behavioralLeaks[0];
    lines.push(`Your highest-impact improvement area is **${top.label}**.`);
    lines.push(`\n${top.recommendedAction}`);
    lines.push(`\nThis pattern is associated with ${fmtMoney(top.netPnl ?? 0)} in net P&L across ${top.tradeCount} trades. ${tierConfidencePhrase(top.confidenceTier)}`);
  } else if (profile.currentImprovementGoal) {
    lines.push(`Your highest-impact improvement area right now:`);
    lines.push(`\n${profile.currentImprovementGoal}`);
  } else {
    // Fall back to rule analysis
    const costlyRule = profile.tradingRules
      .filter((r) => r.violatedCount > 0 && r.violatedPnl < 0)
      .sort((a, b) => a.violatedPnl - b.violatedPnl)[0];

    if (costlyRule) {
      lines.push(`Your highest-impact improvement area is **following "${costlyRule.name}"**.`);
      lines.push(`\nYou've violated it ${costlyRule.violatedCount} times, costing ${fmtMoney(costlyRule.violatedPnl)}. When you follow it, you make ${fmtMoney(costlyRule.followedPnl)}.`);
      lines.push(`\nBefore every entry tomorrow, confirm: "Am I following ${costlyRule.name}?" If the answer is no, don't take the trade.`);
    } else {
      lines.push("Your trade data looks clean — no major behavioral leaks detected. Focus on executing your plan consistently and logging every trade with full detail so I can find finer-grained patterns.");
    }
  }

  // Add context from recent week
  const recentWeek = getRecentTrades(closed as any, 7) as unknown as TradeRow[];
  if (recentWeek.length > 0) {
    const recentPnl = recentWeek.reduce((s, t) => s + netPnl(t), 0);
    lines.push(`\nIn the last 7 days, you've taken ${recentWeek.length} trade${recentWeek.length > 1 ? "s" : ""} (${fmtMoney(recentPnl)}).`);
  }

  // Reference previous recommendation
  if (profile.recentRecommendations.length > 0) {
    lines.push(`\nThis aligns with what I've recommended before: ${profile.recentRecommendations[0]}`);
  }

  lines.push(`\n_Based on ${profile.closedTrades} closed trades and ${profile.discoveredPatterns.length} discovered patterns._`);

  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerBestSetup(
  profile: TraderProfile | null,
  closed: TradeRow[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  if (!profile || profile.bestPerformingSetups.length === 0) {
    // Fall back to direct computation
    const setupMap = new Map<string, TradeRow[]>();
    for (const t of closed) {
      const s = setupLabel(t);
      if (s === "Unspecified") continue;
      const list = setupMap.get(s) ?? [];
      list.push(t);
      setupMap.set(s, list);
    }
    if (setupMap.size === 0) {
      lines.push("You haven't tagged any trades with a setup type yet. Without setup labels, I can't tell which setups perform best. Start tagging your trades with setup names and I'll be able to analyze this.");
      lines.push(`\n_Based on ${closed.length} closed trades — no setup tags found._`);
      return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
    }
    const ranked = Array.from(setupMap.entries())
      .map(([name, ts]) => ({ name, count: ts.length, pnl: ts.reduce((s, t) => s + netPnl(t), 0), wr: ts.filter((t) => netPnl(t) > 0).length / ts.length * 100 }))
      .sort((a, b) => b.pnl - a.pnl);
    const best = ranked[0];
    lines.push(`Your best setup is **${best.name}**.`);
    lines.push(`It has generated ${fmtMoney(best.pnl)} across ${best.count} trades with a ${best.wr.toFixed(0)}% win rate.`);
    if (ranked.length > 1) {
      lines.push(`\nAll setups ranked by P&L:`);
      for (const r of ranked) {
        lines.push(`• ${r.name}: ${fmtMoney(r.pnl)} | ${r.count} trades | ${r.wr.toFixed(0)}% WR`);
      }
    }
    lines.push(`\n_Based on ${closed.length} closed trades._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  // Use profile
  const best = profile.bestPerformingSetups[0];
  lines.push(`Your best setup is **${best.name}**.`);
  lines.push(`It has generated ${fmtMoney(best.netPnl)} across ${best.tradeCount} trades with a ${best.winRate.toFixed(0)}% win rate and ${fmtR(best.avgR)} average.`);

  if (profile.bestPerformingSetups.length > 1) {
    lines.push(`\nYour top setups:`);
    for (const s of profile.bestPerformingSetups) {
      lines.push(`• **${s.name}**: ${fmtMoney(s.netPnl)} | ${s.tradeCount} trades | ${s.winRate.toFixed(0)}% WR | ${fmtR(s.avgR)}`);
    }
  }

  // Reference pattern if available
  const setupPattern = profile.discoveredPatterns.find((p) => p.patternKey.includes("setup:strong"));
  if (setupPattern) {
    lines.push(`\nThe Edge Discovery Engine has flagged this as a strength: ${tierLabel(setupPattern.confidenceTier)}.`);
  }

  if (profile.worstPerformingSetups.length > 0) {
    const worst = profile.worstPerformingSetups[0];
    lines.push(`\nYour worst setup is **${worst.name}** at ${fmtMoney(worst.netPnl)} across ${worst.tradeCount} trades. Consider dropping it or refining your entry criteria.`);
  }

  lines.push(`\n_Based on ${profile.closedTrades} closed trades._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerMistakes(
  closed: TradeRow[],
  allTrades: TradeRow[],
  profile: TraderProfile | null
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];
  const usesPatterns = profile !== null && profile.discoveredPatterns.length > 0;

  // From patterns
  const leakPatterns = profile?.discoveredPatterns
    .filter((p) => p.category === "behavioral_leak" || p.category === "risk_pattern")
    .sort((a, b) => Math.abs(b.netPnl ?? 0) - Math.abs(a.netPnl ?? 0))
    .slice(0, 3) ?? [];

  if (leakPatterns.length > 0) {
    lines.push("Your Edge Discovery Engine has identified these recurring mistakes:");
    lines.push("");
    for (const p of leakPatterns) {
      lines.push(`• **${p.label}** — ${p.tradeCount} trades, ${fmtMoney(p.netPnl ?? 0)}. ${tierLabel(p.confidenceTier)}.`);
      lines.push(`  Action: ${p.recommendedAction}`);
    }
  }

  // Self-identified mistakes
  const mistakeMap = new Map<string, number>();
  for (const t of allTrades) {
    if (t.mistakes && t.mistakes.trim().length > 0) {
      const key = t.mistakes.trim().toLowerCase().slice(0, 60);
      mistakeMap.set(key, (mistakeMap.get(key) ?? 0) + 1);
    }
  }
  if (mistakeMap.size > 0) {
    lines.push(`\nFrom your own journal notes, the mistakes you've recorded most:`);
    for (const [m, count] of Array.from(mistakeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      lines.push(`• "${m}" — logged ${count} time${count > 1 ? "s" : ""}`);
    }
  }

  // Rule violations
  const violatedRules = profile?.tradingRules
    .filter((r) => r.violatedCount > 0)
    .sort((a, b) => b.violatedCount - a.violatedCount) ?? [];

  if (violatedRules.length > 0) {
    lines.push(`\nRules you repeatedly violate:`);
    for (const r of violatedRules.slice(0, 3)) {
      lines.push(`• **${r.name}** — violated ${r.violatedCount}x, costing ${fmtMoney(r.violatedPnl)}`);
    }
  }

  if (lines.length === 0) {
    lines.push("You haven't logged any specific mistakes, and your rule compliance looks clean. Keep journaling your mistakes honestly — the more you record, the clearer your patterns become.");
  }

  lines.push(`\n_Based on ${closed.length} closed trades${usesPatterns ? ` and ${profile!.discoveredPatterns.length} discovered patterns` : ""}._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, usesPatterns, false) };
}

function answerBestTime(
  closed: TradeRow[],
  profile: TraderProfile | null
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  const sessionNames: Record<string, string> = {
    asian: "Asia", london: "London", new_york: "New York", overnight: "Overnight",
  };

  const bySession = new Map<string, TradeRow[]>();
  for (const t of closed) {
    const s = t.market_session ? (sessionNames[t.market_session] ?? t.market_session) : null;
    if (!s) continue;
    const list = bySession.get(s) ?? [];
    list.push(t);
    bySession.set(s, list);
  }

  const byHour = new Map<string, TradeRow[]>();
  for (const t of closed) {
    const h = `${new Date(t.entry_time).getHours()}:00`;
    const list = byHour.get(h) ?? [];
    list.push(t);
    byHour.set(h, list);
  }

  if (bySession.size === 0 && byHour.size === 0) {
    lines.push("I need more closed trades with entry times to identify your best trading windows. Keep logging trades and I'll be able to tell you which sessions and hours are most profitable for you.");
    lines.push(`\n_Based on ${closed.length} closed trades — insufficient time data._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  const candidates: { label: string; netPnl: number; count: number; winRate: number }[] = [];
  for (const [name, ts] of bySession) {
    candidates.push({ label: `${name} session`, netPnl: ts.reduce((s, t) => s + netPnl(t), 0), count: ts.length, winRate: ts.filter((t) => netPnl(t) > 0).length / ts.length * 100 });
  }
  for (const [h, ts] of byHour) {
    candidates.push({ label: `${h}`, netPnl: ts.reduce((s, t) => s + netPnl(t), 0), count: ts.length, winRate: ts.filter((t) => netPnl(t) > 0).length / ts.length * 100 });
  }

  const sorted = candidates.sort((a, b) => b.netPnl - a.netPnl);
  const best = sorted[0];
  lines.push(`You trade best during the **${best.label}**.`);
  lines.push(`That's where you've made ${fmtMoney(best.netPnl)} across ${best.count} trade${best.count > 1 ? "s" : ""} with a ${best.winRate.toFixed(0)}% win rate.`);
  lines.push(`\nYour top time windows:`);
  for (const c of sorted.slice(0, 5)) {
    lines.push(`• ${c.label}: ${fmtMoney(c.netPnl)} | ${c.count} trades | ${c.winRate.toFixed(0)}% WR`);
  }
  const worst = sorted[sorted.length - 1];
  if (worst.netPnl < 0) {
    lines.push(`\nYour worst time is ${worst.label} (${fmtMoney(worst.netPnl)}). Consider avoiding it until you understand why.`);
  }

  // Reference time pattern
  const timePattern = profile?.discoveredPatterns.find((p) => p.dimension === "entry_time" || p.dimension === "session");
  if (timePattern) {
    lines.push(`\nYour Edge Discovery Engine has flagged this as a time-of-day pattern: ${tierLabel(timePattern.confidenceTier)}.`);
  }

  lines.push(`\n_Based on ${closed.length} closed trades._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerRuleCost(
  profile: TraderProfile | null,
  closed: TradeRow[],
  rules: RuleRow[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  const ruleRefs = profile?.tradingRules ?? [];
  const violated = ruleRefs.filter((r) => r.violatedCount > 0).sort((a, b) => a.violatedPnl - b.violatedPnl);

  if (violated.length === 0) {
    lines.push("You haven't logged any rule violations on your trades. Either you're following all your rules (great!) or you haven't started tracking compliance yet. Start marking which rules you followed or violated on each trade and I'll show you exactly which violations are costing you.");
    lines.push(`\n_Based on ${closed.length} closed trades — no rule violations logged._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  const worst = violated[0];
  lines.push(`**"${worst.name}"** is the rule that costs you the most.`);
  lines.push(`When you violate it, you've lost ${fmtMoney(worst.violatedPnl)} across ${worst.violatedCount} trades.`);
  if (worst.followedPnl !== 0 || worst.violatedCount > 0) {
    lines.push(`When you follow it, you've made ${fmtMoney(worst.followedPnl)} across ${profile!.tradingRules.find(r => r.id === worst.id)?.followedRate ? "your compliant trades" : "your followed trades"}.`);
    const diff = worst.followedPnl - worst.violatedPnl;
    lines.push(`That's a swing of ${fmtMoney(diff)} between following and breaking this rule.`);
  }
  lines.push(`\nAll rule violations ranked by cost:`);
  for (const r of violated) {
    lines.push(`• "${r.name}": ${fmtMoney(r.violatedPnl)} lost across ${r.violatedCount} violations`);
  }

  // Reference rule compliance pattern
  const rulePattern = profile?.discoveredPatterns.find((p) => p.dimension === "rule_compliance");
  if (rulePattern) {
    lines.push(`\n${tierLabel(rulePattern.confidenceTier)}: ${rulePattern.label}`);
  }

  lines.push(`\nThe fix: treat "${worst.name}" as non-negotiable. It's associated with ${fmtMoney(worst.violatedPnl)} in losses across ${worst.violatedCount} violations.`);
  lines.push(`\n_Based on ${closed.length} closed trades and ${rules.length} active rules._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerOverview(
  closed: TradeRow[],
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];
  const totalNet = closed.reduce((s, t) => s + netPnl(t), 0);
  const wins = closed.filter((t) => netPnl(t) > 0);
  const losses = closed.filter((t) => netPnl(t) < 0);
  const wr = closed.length > 0 ? wins.length / closed.length * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;
  const pf = losses.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / Math.abs(losses.reduce((s, t) => s + netPnl(t), 0)) : 0;
  const ev = closed.length > 0 ? totalNet / closed.length : 0;

  lines.push(`Here's your performance overview across **${closed.length} closed trades**:`);
  lines.push(`• Net P&L: ${fmtMoney(totalNet)}`);
  lines.push(`• Win rate: ${wr.toFixed(0)}% (${wins.length}W / ${losses.length}L)`);
  lines.push(`• Average win: ${fmtMoney(avgWin)} | Average loss: ${fmtMoney(avgLoss)}`);
  lines.push(`• Profit factor: ${pf.toFixed(2)}`);
  lines.push(`• Expectancy: ${fmtMoney2(ev)} per trade`);

  if (profile) {
    if (profile.primaryInstruments.length > 0) {
      lines.push(`\n**Your instruments:** ${profile.primaryInstruments.map((i) => `${i.name} (${fmtMoney(i.netPnl)}, ${i.tradeCount}T)`).join(", ")}`);
    }
    if (profile.bestPerformingSetups.length > 0) {
      lines.push(`**Best setup:** ${profile.bestPerformingSetups[0].name} (${fmtMoney(profile.bestPerformingSetups[0].netPnl)}, ${profile.bestPerformingSetups[0].winRate.toFixed(0)}% WR)`);
    }
    if (profile.tradingStrengths.length > 0) {
      lines.push(`\n**Your strengths:**`);
      for (const s of profile.tradingStrengths.slice(0, 3)) {
        lines.push(`• ${s}`);
      }
    }
    if (profile.recurringWeaknesses.length > 0) {
      lines.push(`\n**Recurring weaknesses:**`);
      for (const w of profile.recurringWeaknesses.slice(0, 3)) {
        lines.push(`• ${w}`);
      }
    }
    if (profile.performanceTrend.length > 0) {
      const improving = profile.performanceTrend.filter((t) => t.improving).length;
      const total = profile.performanceTrend.length;
      lines.push(`\n**Trend:** ${improving}/${total} metrics improving. ${improving > total / 2 ? "You're heading in the right direction." : "Some areas need attention."}`);
    }
    if (profile.currentImprovementGoal) {
      lines.push(`\n**Current focus:** ${profile.currentImprovementGoal}`);
    }
  }

  if (totalNet > 0) {
    lines.push(`\nYou're profitable. Focus on repeating what works — your best setup, best session, and highest-compliance trades.`);
  } else {
    lines.push(`\nYou're not profitable yet. Focus on cutting your biggest leak — whether that's oversized losses, emotional trades, or repeated rule violations.`);
  }

  lines.push(`\n_Based on ${closed.length} closed trades${profile && profile.discoveredPatterns.length > 0 ? ` and ${profile.discoveredPatterns.length} discovered patterns` : ""}._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, profile !== null, profile !== null) };
}

function answerStrengths(
  profile: TraderProfile | null
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  if (!profile || profile.tradingStrengths.length === 0) {
    lines.push("I haven't identified any statistically significant strengths in your trading yet. This could mean you're still building your edge, or that you need more trade data for patterns to emerge. Keep logging trades with full detail — setups, sessions, emotions, and discipline checks — and your strengths will surface.");
    lines.push(`\n_Based on ${profile?.closedTrades ?? 0} closed trades — no strengths identified yet._`);
    return { answer: lines.join("\n"), dataSources: classifySources(profile, true, false, false) };
  }

  lines.push("Your Edge Discovery Engine has identified these trading strengths:");
  lines.push("");
  for (let i = 0; i < profile.tradingStrengths.length; i++) {
    lines.push(`**${i + 1}. ${profile.tradingStrengths[i]}**`);
    const pattern = profile.discoveredPatterns.find((p) => p.label === profile.tradingStrengths[i]);
    if (pattern) {
      lines.push(`${pattern.tradeCount} trades | ${fmtMoney(pattern.netPnl ?? 0)} net P&L | ${tierLabel(pattern.confidenceTier)}`);
    }
  }

  if (profile.bestPerformingSetups.length > 0) {
    lines.push(`\nYour best-performing setup is **${profile.bestPerformingSetups[0].name}** — ${fmtMoney(profile.bestPerformingSetups[0].netPnl)} across ${profile.bestPerformingSetups[0].tradeCount} trades.`);
  }

  lines.push(`\n_Based on ${profile.closedTrades} closed trades and ${profile.discoveredPatterns.length} discovered patterns._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerProfileSummary(
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];

  if (!profile) {
    lines.push("I don't have a Trader Profile built yet. Once you log some trades, I'll build a complete profile covering your instruments, sessions, setups, strengths, weaknesses, risk preferences, rules, discipline patterns, and psychological patterns.");
    lines.push(`\n_Based on 0 trades — no profile built._`);
    return { answer: lines.join("\n"), dataSources: classifySources(null, false, false, false) };
  }

  lines.push(`Here's what I know about you as a trader:`);
  lines.push(`\n**Profile built:** ${new Date(profile.builtAt).toLocaleDateString()} from ${profile.closedTrades} closed trades`);

  if (profile.primaryInstruments.length > 0) {
    lines.push(`\n**Primary instruments:** ${profile.primaryInstruments.map((i) => i.name).join(", ")}`);
  }
  if (profile.preferredSessions.length > 0) {
    lines.push(`**Preferred sessions:** ${profile.preferredSessions.map((s) => s.name).join(", ")}`);
  }
  if (profile.favoriteSetups.length > 0) {
    lines.push(`**Favorite setups:** ${profile.favoriteSetups.map((s) => s.name).join(", ")}`);
  }
  if (profile.bestPerformingSetups.length > 0) {
    lines.push(`**Best-performing setups:** ${profile.bestPerformingSetups.map((s) => `${s.name} (${fmtMoney(s.netPnl)})`).join(", ")}`);
  }
  if (profile.worstPerformingSetups.length > 0) {
    lines.push(`**Worst-performing setups:** ${profile.worstPerformingSetups.map((s) => `${s.name} (${fmtMoney(s.netPnl)})`).join(", ")}`);
  }
  if (profile.tradingStrengths.length > 0) {
    lines.push(`\n**Strengths:** ${profile.tradingStrengths.length} identified`);
  }
  if (profile.recurringWeaknesses.length > 0) {
    lines.push(`**Recurring weaknesses:** ${profile.recurringWeaknesses.length} identified`);
  }
  lines.push(`**Risk profile:** Avg ${profile.riskPreferences.avgPositionSize.toFixed(1)} lots${profile.riskPreferences.avgRRRatio !== null ? `, ${profile.riskPreferences.avgRRRatio.toFixed(1)}:1 avg R:R` : ""}${profile.riskPreferences.noStopCount > 0 ? `, ${profile.riskPreferences.noStopCount} trades without stops` : ""}`);

  if (profile.disciplinePatterns.avgDisciplineScore !== null) {
    lines.push(`**Discipline:** Avg score ${profile.disciplinePatterns.avgDisciplineScore.toFixed(0)}/100`);
  }
  if (profile.psychologicalPatterns.emotionalTradeCount > 0) {
    lines.push(`**Psychology:** ${profile.psychologicalPatterns.emotionalTradeCount} emotional trades (${fmtMoney(profile.psychologicalPatterns.emotionalPnl)})`);
  }

  if (profile.currentImprovementGoal) {
    lines.push(`\n**Current improvement goal:** ${profile.currentImprovementGoal}`);
  }

  lines.push(`\n**Conversation history:** We've had ${conversations.length} previous conversation${conversations.length !== 1 ? "s" : ""}.`);

  lines.push(`\n_Based on ${profile.closedTrades} closed trades and ${profile.discoveredPatterns.length} discovered patterns._`);
  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, true, false) };
}

function answerDefault(
  closed: TradeRow[],
  profile: TraderProfile | null,
  conversations: ConversationRecord[]
): { answer: string; dataSources: ReturnType<typeof classifySources> } {
  const lines: string[] = [];
  const totalNet = closed.reduce((s, t) => s + netPnl(t), 0);

  lines.push(`I've analyzed your trading history. Here's what stands out:`);
  lines.push("");
  lines.push(`**Performance:** ${fmtMoney(totalNet)} net P&L across ${closed.length} closed trades.`);

  if (profile) {
    if (profile.bestPerformingSetups.length > 0) {
      lines.push(`\n**Best setup:** ${profile.bestPerformingSetups[0].name} — ${fmtMoney(profile.bestPerformingSetups[0].netPnl)} across ${profile.bestPerformingSetups[0].tradeCount} trades.`);
    }
    if (profile.recurringWeaknesses.length > 0) {
      lines.push(`\n**Top weakness:** ${profile.recurringWeaknesses[0]}`);
    }
    if (profile.currentImprovementGoal) {
      lines.push(`\n**What to work on:** ${profile.currentImprovementGoal}`);
    }
    if (profile.performanceTrend.length > 0) {
      const improving = profile.performanceTrend.filter((t) => t.improving).length;
      lines.push(`**Trend:** ${improving}/${profile.performanceTrend.length} metrics improving.`);
    }
  }

  lines.push(`\nAsk me more specific questions like "Why did I lose money today?", "Am I getting better?", or "What should I work on tomorrow?" for deeper analysis.`);
  lines.push(`\n_Based on ${closed.length} closed trades${profile && profile.discoveredPatterns.length > 0 ? ` and ${profile.discoveredPatterns.length} discovered patterns` : ""}._`);

  return { answer: lines.join("\n"), dataSources: classifySources(profile, true, profile !== null, profile !== null) };
}

/* ------------------------------------------------------------------ */
/* Main handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify the caller is authenticated — the frontend sends the user's
  // trades/rules/profile in the body, but we still require a valid JWT
  // so anonymous callers can't abuse the endpoint.
  //
  // The token must be VERIFIED, not merely present: the project's anon key is
  // itself a valid JWT and is published in the browser bundle, so a prefix
  // check would let anyone through. auth.getUser() resolves the token to a
  // real end user and fails for the anon key, which carries no user identity.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authentication required." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: authUser, error: authUserError } = await authClient.auth.getUser(
    authHeader.replace("Bearer ", "").trim()
  );
  if (authUserError || !authUser?.user) {
    return new Response(
      JSON.stringify({ error: "Authentication required." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const question = body.question;
    const trades = body.trades;
    const rules = body.rules;
    const profile = body.profile ?? null;
    const conversations = body.conversations ?? [];

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (question.length > 2000) {
      return new Response(
        JSON.stringify({ error: "question is too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!Array.isArray(trades)) {
      return new Response(
        JSON.stringify({ error: "trades array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allClosedTradeIds = (trades as TradeRow[])
      .filter((t) => t.exit_time !== null && t.pnl !== null)
      .map((t) => t.id);

    const result = generateAnswer(
      question,
      trades as TradeRow[],
      Array.isArray(rules) ? rules as RuleRow[] : [],
      profile as TraderProfile | null,
      conversations as ConversationRecord[]
    );

    return new Response(
      JSON.stringify({
        answer: result.answer,
        dataSources: result.dataSources,
        supportingTradeIds: result.supportingTradeIds ?? allClosedTradeIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("coach-chat failed", err);
    return new Response(
      JSON.stringify({ error: "The coach is unavailable right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
