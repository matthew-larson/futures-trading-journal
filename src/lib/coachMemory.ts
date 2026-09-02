import { supabase } from "./supabase";
import { buildTraderProfile, type TraderProfile } from "./traderProfile";
import { runEdgeDiscoveryEngine } from "./edgeEngine";
import { loadDiscoveredPatterns, persistDiscoveredPatterns } from "./edgePersistence";
import type { Trade, TradingRule, DiscoveredPattern } from "./types";

/* ------------------------------------------------------------------ */
/* Save / load Trader Profile                                         */
/* ------------------------------------------------------------------ */

/**
 * Build the Trader Profile from trades + discovered patterns + rules,
 * then upsert it into the `trader_profiles` table (singleton row).
 * Also runs the Edge Discovery Engine if no patterns are loaded yet.
 */
export async function saveTraderProfile(
  trades: Trade[],
  rules: TradingRule[]
): Promise<TraderProfile> {
  // Load persisted patterns; if none, run the engine to generate them
  let patterns = await loadDiscoveredPatterns(true);

  if (patterns.length === 0 && trades.length >= 8) {
    await persistDiscoveredPatterns(trades);
    patterns = await loadDiscoveredPatterns(true);
  }

  const profile = buildTraderProfile(trades, patterns, rules);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("trader_profiles")
    .upsert({
      profile_key: "default",
      profile_data: profile,
      trade_count_at_build: profile.totalTrades,
      pattern_count_at_build: patterns.length,
      built_at: now,
      updated_at: now,
    }, { onConflict: "profile_key" });

  if (error) {
    console.error("Failed to save trader profile:", error.message);
  }

  return profile;
}

/**
 * Load the persisted Trader Profile from the database.
 * Returns null if no profile has been built yet.
 */
export async function loadTraderProfile(): Promise<TraderProfile | null> {
  const { data, error } = await supabase
    .from("trader_profiles")
    .select("profile_data")
    .eq("profile_key", "default")
    .maybeSingle();

  if (error) {
    console.error("Failed to load trader profile:", error.message);
    return null;
  }

  if (!data?.profile_data) return null;
  return data.profile_data as TraderProfile;
}

/* ------------------------------------------------------------------ */
/* Save / load Coach conversations                                    */
/* ------------------------------------------------------------------ */

export interface ConversationRecord {
  id: string;
  question: string;
  answer: string;
  data_sources: {
    tradeCount: number;
    patternCount: number;
    ruleCount: number;
    sources: string[];
  };
  created_at: string;
}

export interface SaveConversationInput {
  question: string;
  answer: string;
  dataSources: ConversationRecord["data_sources"];
  profileSnapshot: Partial<TraderProfile>;
}

/**
 * Save a coach conversation exchange to the database for long-term memory.
 */
export async function saveConversation(
  input: SaveConversationInput
): Promise<void> {
  const { error } = await supabase
    .from("coach_conversations")
    .insert({
      question: input.question,
      answer: input.answer,
      data_sources: input.dataSources,
      profile_snapshot: input.profileSnapshot,
    });

  if (error) {
    console.error("Failed to save conversation:", error.message);
  }
}

/**
 * Load recent coach conversations, ordered newest-first.
 * Used to give the Coach conversational memory.
 */
export async function loadRecentConversations(
  limit: number = 10
): Promise<ConversationRecord[]> {
  const { data, error } = await supabase
    .from("coach_conversations")
    .select("id, question, answer, data_sources, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load conversations:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    data_sources: row.data_sources ?? { tradeCount: 0, patternCount: 0, ruleCount: 0, sources: [] },
    created_at: row.created_at,
  }));
}

/**
 * Delete all coach conversations (for a "clear memory" action).
 */
export async function clearConversations(): Promise<void> {
  const { error } = await supabase
    .from("coach_conversations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error("Failed to clear conversations:", error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Ensure profile is fresh — rebuild if stale                         */
/* ------------------------------------------------------------------ */

/**
 * Check if the persisted profile is stale (built from fewer trades than
 * currently exist) and rebuild it if so. Returns the current profile.
 */
export async function ensureFreshProfile(
  trades: Trade[],
  rules: TradingRule[]
): Promise<TraderProfile> {
  const { data, error } = await supabase
    .from("trader_profiles")
    .select("trade_count_at_build, built_at")
    .eq("profile_key", "default")
    .maybeSingle();

  if (error || !data) {
    // No profile yet — build it
    return saveTraderProfile(trades, rules);
  }

  // Rebuild if trade count has grown by 5+ or it's been more than 7 days
  const currentCount = trades.length;
  const builtCount = data.trade_count_at_build ?? 0;
  const builtDate = new Date(data.built_at);
  const daysSinceBuild = (Date.now() - builtDate.getTime()) / 86400000;

  if (currentCount - builtCount >= 5 || daysSinceBuild > 7) {
    return saveTraderProfile(trades, rules);
  }

  // Load existing
  const profile = await loadTraderProfile();
  if (!profile) {
    return saveTraderProfile(trades, rules);
  }
  return profile;
}
