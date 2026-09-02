import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradeRow {
  id: string;
  instrument: string;
  direction: string;
  entry_price: number | null;
  exit_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  quantity: number | null;
  entry_time: string | null;
  exit_time: string | null;
  pnl: number | null;
  fees: number | null;
  setup: string | null;
  market_session: string | null;
  emotions: string | null;
  mistakes: string | null;
  notes: string | null;
  rule_compliance: Record<string, boolean> | null;
}

interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

// Creates a Supabase client scoped to the requesting user's JWT.
// RLS policies enforce that only the user's own rows are visible.
function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function analyzeTrade(
  trade: TradeRow,
  rules: RuleRow[]
): {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  riskRating: "low" | "moderate" | "high";
  patternRecognition: string[];
  grade: string;
  scores: {
    setupQuality: number;
    entryTiming: number;
    exitTiming: number;
    riskManagement: number;
    emotionalDiscipline: number;
    ruleCompliance: number;
  };
  coaching: {
    whatYouDidWell: string[];
    mistakes: string[];
    howToImprove: string[];
    whatToRepeat: string[];
  };
  timeline: {
    entry: string;
    management: string;
    exit: string;
  };
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  const patternRecognition: string[] = [];
  const didWell: string[] = [];
  const mistakesList: string[] = [];
  const howToImprove: string[] = [];
  const whatToRepeat: string[] = [];

  const pnl = Number(trade.pnl ?? 0);
  const fees = Number(trade.fees ?? 0);
  const netPnl = pnl - fees;
  const isWin = netPnl > 0;
  const direction = trade.direction;
  const entry = Number(trade.entry_price ?? 0);
  const exit = Number(trade.exit_price ?? 0);
  const stop = trade.stop_price ? Number(trade.stop_price) : null;
  const target = trade.target_price ? Number(trade.target_price) : null;
  const qty = Number(trade.quantity ?? 1);

  // ---- Score components ----
  let setupQuality = 70;
  let entryTiming = 65;
  let exitTiming = 60;
  let riskManagement = 55;
  let emotionalDiscipline = 70;
  let ruleComplianceScore = 75;

  // ---- Price move ----
  const priceMove = exit - entry;
  const expectedMove = direction === "long" ? priceMove > 0 : priceMove < 0;
  if (exit && entry) {
    if (expectedMove) {
      strengths.push(
        `Captured a favorable ${direction} move of ${Math.abs(priceMove).toFixed(2)} points on ${trade.instrument}.`
      );
      didWell.push(`Entered a ${direction} position that moved in your favor by ${Math.abs(priceMove).toFixed(2)} points.`);
      whatToRepeat.push(`Your directional bias was correct — the ${direction} thesis played out as expected.`);
      entryTiming += 15;
      exitTiming += 10;
    } else {
      weaknesses.push(
        `The trade moved against the ${direction} thesis by ${Math.abs(priceMove).toFixed(2)} points.`
      );
      mistakesList.push(`The trade moved against your ${direction} thesis by ${Math.abs(priceMove).toFixed(2)} points.`);
      entryTiming -= 20;
      exitTiming -= 10;
    }
  }

  // ---- Risk management: stop/target ----
  if (stop !== null && entry > 0) {
    const riskPts = direction === "long"
      ? Math.abs(entry - stop)
      : Math.abs(stop - entry);
    if (riskPts > 0) {
      riskManagement += 20;
      didWell.push(`You defined a stop loss at ${stop.toFixed(2)}, risking ${riskPts.toFixed(2)} points per contract.`);
      whatToRepeat.push(`Always define your stop before entry — this trade had a clear risk plan of ${riskPts.toFixed(2)} points.`);

      // R multiple
      if (exit && exit !== entry) {
        const rewardPts = direction === "long"
          ? Math.abs(exit - entry)
          : Math.abs(entry - exit);
        const rMultiple = rewardPts / riskPts;
        if (isWin && rMultiple >= 2) {
          strengths.push(`Excellent R multiple of ${rMultiple.toFixed(1)}R — you captured more than 2x your risk.`);
          didWell.push(`Achieved a ${rMultiple.toFixed(1)}R multiple — your reward far exceeded your risk.`);
          whatToRepeat.push(`Aim for this kind of R multiple on every trade. You let the winner run to ${rMultiple.toFixed(1)}x your risk.`);
          exitTiming += 15;
          riskManagement += 10;
        } else if (isWin && rMultiple >= 1) {
          strengths.push(`Positive R multiple of ${rMultiple.toFixed(1)}R.`);
          exitTiming += 5;
        } else if (!isWin) {
          weaknesses.push(`Trade hit a loss of ${Math.abs(netPnl).toFixed(2)} despite having a stop defined.`);
          mistakesList.push(`Your stop at ${stop.toFixed(2)} was hit — review whether it was placed too tight or too loose.`);
          howToImprove.push(`Review your stop placement: ${riskPts.toFixed(2)} points of risk may have been too ${riskPts < 2 ? "tight" : "loose"} for ${trade.instrument}'s volatility.`);
        }
      }

      // Risk/reward ratio
      if (target !== null && entry && target > 0) {
        const rewardPts = direction === "long"
          ? Math.abs(target - entry)
          : Math.abs(entry - target);
        const rr = rewardPts / riskPts;
        if (rr >= 2) {
          setupQuality += 15;
          didWell.push(`Planned a ${rr.toFixed(1)}:1 reward-to-risk ratio before entry.`);
          whatToRepeat.push(`Your pre-trade planning was solid — ${rr.toFixed(1)}:1 R:R is a quality setup.`);
        } else if (rr < 1) {
          weaknesses.push(`Reward-to-risk ratio was only ${rr.toFixed(1)}:1 — below the recommended 2:1 minimum.`);
          mistakesList.push(`Your planned R:R was ${rr.toFixed(1)}:1, which is below the recommended 2:1.`);
          howToImprove.push(`Only take setups with at least 2:1 reward-to-risk. This trade was ${rr.toFixed(1)}:1.`);
          riskManagement -= 15;
          setupQuality -= 10;
        }
      }
    }
  } else {
    weaknesses.push("No stop loss recorded — risk was undefined before entry.");
    mistakesList.push("No stop loss was defined before entering this trade.");
    howToImprove.push("Always define your stop loss before entry. Undefined risk is the most common cause of large losses.");
    riskManagement -= 25;
  }

  // ---- Duration / hold time ----
  let holdMin: number | null = null;
  if (trade.entry_time && trade.exit_time) {
    const durationMs = new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime();
    holdMin = Math.round(durationMs / 60000);
    if (holdMin < 2) {
      weaknesses.push(`Very short hold time (${holdMin} min) may indicate impulsive scalping.`);
      mistakesList.push(`Very short hold time of ${holdMin} minutes — this looks like impulsive scalping.`);
      howToImprove.push("If you exited in under 2 minutes, ask whether you had a real plan or reacted to noise.");
      patternRecognition.push("Scalping bias — consider whether this aligns with your plan.");
      exitTiming -= 10;
      emotionalDiscipline -= 10;
    } else if (holdMin > 240) {
      patternRecognition.push(
        `Extended hold (${Math.round(holdMin / 60)} hrs) — check if the thesis remained valid throughout.`
      );
      if (!isWin) {
        mistakesList.push(`Held this trade for ${Math.round(holdMin / 60)} hours while it was losing — possible hope bias.`);
        howToImprove.push("Set a time-based exit rule. Holding losers for hours often indicates hope bias rather than analysis.");
        exitTiming -= 10;
      }
    } else {
      strengths.push(`Reasonable hold time of ${holdMin} minutes.`);
      didWell.push(`Held the trade for ${holdMin} minutes — a reasonable duration that aligns with your setup.`);
      whatToRepeat.push(`Your hold time of ${holdMin}m was appropriate for this setup. Maintain this patience.`);
      exitTiming += 5;
    }
  }

  // ---- Fees impact ----
  if (fees > 0) {
    const feePct = Math.abs(netPnl) > 0 ? (fees / Math.abs(pnl)) * 100 : 0;
    if (feePct > 10) {
      weaknesses.push(
        `Commissions (${fees.toFixed(2)}) consumed ${feePct.toFixed(1)}% of gross P&L — consider fee efficiency.`
      );
      mistakesList.push(`Commissions of ${fees.toFixed(2)} consumed ${feePct.toFixed(1)}% of your gross P&L.`);
      howToImprove.push("Consider your fee efficiency: small trades with high commission ratios erode your edge.");
    }
  }

  // ---- Emotional discipline ----
  const emo = (trade.emotions ?? "").toLowerCase();
  const negativeEmotions = ["fomo", "revenge", "fear", "panic", "greed", "anxious", "tilt"];
  const positiveEmotions = ["calm", "confident", "disciplined", "patient", "focused"];
  const flagged = negativeEmotions.filter((e) => emo.includes(e));
  const positive = positiveEmotions.filter((e) => emo.includes(e));
  if (flagged.length > 0) {
    weaknesses.push(
      `Emotional state flagged: ${flagged.join(", ")}. These states correlate with lower-edge trading.`
    );
    mistakesList.push(`You traded while feeling ${flagged.join(", ")} — these emotional states correlate with lower-edge trading.`);
    howToImprove.push("Implement a pre-trade emotional checkpoint. If you feel fomo, revenge, or anxiety, step away for 15 minutes before entering.");
    recommendations.push("Implement a pre-trade emotional checkpoint before the next entry.");
    emotionalDiscipline -= 25;
  }
  if (positive.length > 0) {
    strengths.push(`Positive emotional state: ${positive.join(", ")}.`);
    didWell.push(`You maintained a ${positive.join(", ")} emotional state during this trade.`);
    whatToRepeat.push(`Your ${positive.join(", ")} mindset served you well. Replicate this mental state before every trade.`);
    emotionalDiscipline += 15;
  }
  if (flagged.length === 0 && positive.length === 0 && emo.trim().length > 0) {
    emotionalDiscipline += 0;
  }

  // ---- Mistakes field ----
  if (trade.mistakes && trade.mistakes.trim().length > 0) {
    weaknesses.push(`Self-identified mistake: "${trade.mistakes.trim()}"`);
    mistakesList.push(`You identified this mistake: "${trade.mistakes.trim()}"`);
    howToImprove.push(`Add a specific rule to prevent this mistake from recurring: "${trade.mistakes.trim()}"`);
    recommendations.push("Add a specific rule to prevent this mistake from recurring.");
    emotionalDiscipline -= 10;
    setupQuality -= 5;
  }

  // ---- Rule compliance ----
  const compliance = trade.rule_compliance ?? {};
  const applicableRules = rules.filter((r) => r.id in compliance);
  if (applicableRules.length > 0) {
    const followed = applicableRules.filter((r) => compliance[r.id] === true);
    const violated = applicableRules.filter((r) => compliance[r.id] === false);
    const score = Math.round((followed.length / applicableRules.length) * 100);
    ruleComplianceScore = score;
    if (score >= 80) {
      strengths.push(`Strong rule compliance: ${score}% (${followed.length}/${applicableRules.length} rules followed).`);
      didWell.push(`Followed ${followed.length} of ${applicableRules.length} trading rules (${score}% compliance).`);
      whatToRepeat.push(`Your rule discipline was ${score}% on this trade. This level of compliance is what creates consistency.`);
    } else if (score >= 50) {
      weaknesses.push(`Moderate rule compliance: ${score}% (${followed.length}/${applicableRules.length}).`);
      mistakesList.push(`Only followed ${followed.length} of ${applicableRules.length} rules (${score}% compliance).`);
    } else {
      weaknesses.push(`Poor rule compliance: ${score}% — only ${followed.length} of ${applicableRules.length} rules followed.`);
      mistakesList.push(`Poor rule compliance: only ${followed.length} of ${applicableRules.length} rules followed (${score}%).`);
      howToImprove.push(`Review your rules before each session. ${violated.length} rule(s) were violated on this trade alone.`);
    }
    for (const v of violated) {
      recommendations.push(`Revisit rule: "${v.name}" — ${v.description ?? ""}`);
      howToImprove.push(`Revisit your rule "${v.name}" — ${v.description ?? ""}`);
    }
  } else {
    ruleComplianceScore = 50;
  }

  // ---- Session patterns ----
  if (trade.market_session) {
    const sessionMap: Record<string, string> = {
      asian: "Asian session",
      london: "London session",
      new_york: "New York session",
      overnight: "Overnight session",
    };
    patternRecognition.push(`Executed during the ${sessionMap[trade.market_session] ?? trade.market_session}.`);
  }

  // ---- Setup ----
  if (trade.setup && trade.setup.trim().length > 0) {
    patternRecognition.push(`Setup type: ${trade.setup.trim()}.`);
    setupQuality += 5;
  } else {
    setupQuality -= 10;
    howToImprove.push("Tag your trades with a setup type so you can track which setups perform best over time.");
  }

  // ---- Net P&L framing ----
  if (isWin) {
    strengths.push(`Profitable trade with net P&L of ${netPnl.toFixed(2)} after fees.`);
    didWell.push(`Closed green with a net P&L of ${netPnl.toFixed(2)} after fees.`);
  } else if (netPnl < 0) {
    weaknesses.push(`Losing trade with net P&L of ${netPnl.toFixed(2)} after fees.`);
    recommendations.push("Review whether the loss size was within your risk parameters.");
    if (stop === null) {
      howToImprove.push("This loss could have been larger without a stop. Define your risk before every entry.");
    }
  }

  // ---- Risk rating ----
  let riskRating: "low" | "moderate" | "high" = "low";
  const flags =
    (flagged.length > 0 ? 1 : 0) +
    (expectedMove === false ? 1 : 0) +
    (trade.mistakes ? 1 : 0) +
    (Object.values(compliance).filter((v) => v === false).length > 0 ? 1 : 0) +
    (stop === null ? 1 : 0);
  if (flags >= 3) riskRating = "high";
  else if (flags >= 1) riskRating = "moderate";

  // ---- Clamp scores ----
  setupQuality = clamp(Math.round(setupQuality), 0, 100);
  entryTiming = clamp(Math.round(entryTiming), 0, 100);
  exitTiming = clamp(Math.round(exitTiming), 0, 100);
  riskManagement = clamp(Math.round(riskManagement), 0, 100);
  emotionalDiscipline = clamp(Math.round(emotionalDiscipline), 0, 100);
  ruleComplianceScore = clamp(Math.round(ruleComplianceScore), 0, 100);

  const overall = Math.round(
    (setupQuality + entryTiming + exitTiming + riskManagement + emotionalDiscipline + ruleComplianceScore) / 6
  );
  const grade = scoreToGrade(overall);

  // ---- Summary ----
  const summaryParts: string[] = [];
  summaryParts.push(
    `${direction.toUpperCase()} ${qty} ${trade.instrument} from ${entry.toFixed(2)}${exit ? ` to ${exit.toFixed(2)}` : ""}.`
  );
  summaryParts.push(
    isWin
      ? `Net result: +${netPnl.toFixed(2)} (winner).`
      : netPnl === 0
        ? `Net result: breakeven.`
        : `Net result: ${netPnl.toFixed(2)} (loser).`
  );
  if (applicableRules.length > 0) {
    const followed = applicableRules.filter((r) => compliance[r.id] === true).length;
    summaryParts.push(`Rule compliance: ${followed}/${applicableRules.length}.`);
  }
  summaryParts.push(`Overall grade: ${grade}.`);

  // ---- Timeline ----
  const entryTimeStr = trade.entry_time
    ? new Date(trade.entry_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const exitTimeStr = trade.exit_time
    ? new Date(trade.exit_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Open";

  const entryTimeline = `Entered ${direction} ${qty} ${trade.instrument} at ${entry.toFixed(2)} on ${entryTimeStr}${trade.setup ? ` using a ${trade.setup} setup` : ""}.`;
  const managementTimeline = holdMin !== null
    ? `Held for ${holdMin < 60 ? `${holdMin}m` : `${Math.floor(holdMin / 60)}h ${holdMin % 60}m`}. ${stop !== null ? `Stop at ${stop.toFixed(2)}.${target !== null ? ` Target at ${target.toFixed(2)}.` : ""}` : "No stop defined."}`
    : "Position still open.";
  const exitTimeline = trade.exit_time
    ? isWin
      ? `Closed at ${exit.toFixed(2)} for a net profit of +${netPnl.toFixed(2)}. ${holdMin !== null && holdMin < 5 ? "Quick scalp." : "Patient exit."}`
      : `Closed at ${exit.toFixed(2)} for a net loss of ${netPnl.toFixed(2)}.`
    : "Position still open — no exit recorded yet.";

  return {
    summary: summaryParts.join(" "),
    strengths: strengths.length ? strengths : ["No notable strengths flagged."],
    weaknesses: weaknesses.length ? weaknesses : ["No notable weaknesses flagged."],
    recommendations: recommendations.length
      ? recommendations
      : ["Maintain your current discipline and continue logging trades."],
    riskRating,
    patternRecognition,
    grade,
    scores: {
      setupQuality,
      entryTiming,
      exitTiming,
      riskManagement,
      emotionalDiscipline,
      ruleCompliance: ruleComplianceScore,
    },
    coaching: {
      whatYouDidWell: didWell.length ? didWell : ["No specific positive actions identified. Log more detail to get better coaching."],
      mistakes: mistakesList.length ? mistakesList : ["No specific mistakes identified on this trade."],
      howToImprove: howToImprove.length ? howToImprove : ["Keep logging your trades with setup, emotions, and rule compliance to unlock personalized improvement suggestions."],
      whatToRepeat: whatToRepeat.length ? whatToRepeat : ["Continue your current process — the more detail you log, the more patterns we can identify to repeat."],
    },
    timeline: {
      entry: entryTimeline,
      management: managementTimeline,
      exit: exitTimeline,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Create a user-scoped client so RLS enforces ownership
    const userClient = createUserClient(req);
    if (!userClient) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const tradeId = body && typeof body === "object" ? body.tradeId : null;
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof tradeId !== "string" || !UUID_RE.test(tradeId)) {
      return new Response(
        JSON.stringify({ error: "A valid tradeId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query with user-scoped client — RLS ensures only the caller's trade is returned
    const { data: trade, error: tradeError } = await userClient
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .maybeSingle();

    if (tradeError) throw tradeError;
    if (!trade) {
      return new Response(
        JSON.stringify({ error: "Trade not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load rules scoped to the same user
    const { data: rules, error: rulesError } = await userClient
      .from("trading_rules")
      .select("id, name, description, category")
      .eq("is_active", true);

    if (rulesError) throw rulesError;

    const analysis = analyzeTrade(trade as TradeRow, (rules ?? []) as RuleRow[]);

    // Update trade with user-scoped client — RLS ensures ownership
    const { error: updateError } = await userClient
      .from("trades")
      .update({ ai_analysis: analysis, updated_at: new Date().toISOString() })
      .eq("id", tradeId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-trade failed", err);
    return new Response(
      JSON.stringify({ error: "Analysis is unavailable right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
