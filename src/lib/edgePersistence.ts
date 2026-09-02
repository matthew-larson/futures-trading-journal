import { supabase } from "./supabase";
import type { DiscoveredPattern, DiscoveredPatternInput } from "./types";
import { runEdgeDiscoveryEngine, type EngineResult } from "./edgeEngine";

/* ------------------------------------------------------------------ */
/* Save patterns to Supabase (upsert by pattern_key)                  */
/* ------------------------------------------------------------------ */

/**
 * Run the Edge Discovery Engine against the given trades, then upsert all
 * discovered patterns into the `discovered_patterns` table. Patterns that
 * were previously stored but are no longer detected are marked inactive
 * (is_active = false) rather than deleted, preserving history.
 *
 * Returns the engine result (patterns + metadata) for the caller to use
 * immediately without a second round-trip.
 */
export async function persistDiscoveredPatterns(
  trades: Array<{ id: string }>
): Promise<EngineResult> {
  const result = runEdgeDiscoveryEngine(trades as any);

  if (result.patterns.length === 0) {
    // Mark all existing patterns inactive if we found nothing
    await supabase
      .from("discovered_patterns")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);
    return result;
  }

  const now = new Date().toISOString();
  const inputs: DiscoveredPatternInput[] = result.patterns.map((p) => ({
    ...p,
    is_active: true,
    degradation_note: null,
  }));

  // Fetch existing patterns to determine first_seen_at and degradation
  const existingKeys = inputs.map((p) => p.pattern_key);
  const { data: existing } = await supabase
    .from("discovered_patterns")
    .select("pattern_key, first_seen_at, is_active, expectancy, win_rate, confidence_score, confidence_tier")
    .in("pattern_key", existingKeys);

  const existingMap = new Map<string, any>(
    (existing ?? []).map((e) => [e.pattern_key, e])
  );

  // Build upsert rows, preserving first_seen_at for existing patterns
  const upsertRows = inputs.map((p) => {
    const prev = existingMap.get(p.pattern_key);
    const firstSeen = prev?.first_seen_at ?? now;

    // Detect degradation: was active, now has lower confidence or worse expectancy
    let degradationNote: string | null = null;
    if (prev && prev.is_active) {
      const prevTier = prev.confidence_tier;
      const currTier = p.confidence_tier;
      const tierOrder = { emerging: 0, strong: 1, high_confidence: 2 };
      if (tierOrder[currTier as keyof typeof tierOrder] < tierOrder[prevTier as keyof typeof tierOrder]) {
        degradationNote = `Confidence dropped from ${prevTier} to ${currTier}. The pattern is weakening as more data arrived.`;
      }
      if (prev.expectancy !== null && p.expectancy !== null) {
        if (p.expectancy < prev.expectancy * 0.6 && p.expectancy < prev.expectancy) {
          degradationNote = (degradationNote ?? "") + ` Expectancy declined from ${prev.expectancy} to ${p.expectancy}/trade.`;
        }
      }
    }

    return {
      pattern_key: p.pattern_key,
      category: p.category,
      dimension: p.dimension,
      label: p.label,
      description: p.description,
      recommended_action: p.recommended_action,
      trade_count: p.trade_count,
      win_rate: p.win_rate,
      net_pnl: p.net_pnl,
      avg_r: p.avg_r,
      expectancy: p.expectancy,
      confidence_score: p.confidence_score,
      confidence_tier: p.confidence_tier,
      estimated_pnl_impact: p.estimated_pnl_impact,
      is_active: p.is_active,
      supporting_trade_ids: p.supporting_trade_ids,
      first_seen_at: firstSeen,
      last_verified_at: now,
      degradation_note: degradationNote,
      updated_at: now,
    };
  });

  // Upsert
  const { error } = await supabase
    .from("discovered_patterns")
    .upsert(upsertRows, { onConflict: "pattern_key" });

  if (error) {
    console.error("Failed to persist discovered patterns:", error.message);
  }

  // Mark patterns that were active but are no longer detected as inactive
  const newKeys = new Set(existingKeys);
  if (existing && existing.length > 0) {
    const staleKeys = existing
      .filter((e) => e.is_active && !newKeys.has(e.pattern_key))
      .map((e) => e.pattern_key);
    if (staleKeys.length > 0) {
      await supabase
        .from("discovered_patterns")
        .update({
          is_active: false,
          degradation_note: "Pattern no longer detected after latest analysis. The supporting trades may have been supplemented by new data that dilutes this pattern.",
          updated_at: now,
        })
        .in("pattern_key", staleKeys);
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Load persisted patterns from Supabase                              */
/* ------------------------------------------------------------------ */

export async function loadDiscoveredPatterns(
  activeOnly: boolean = true
): Promise<DiscoveredPattern[]> {
  let query = supabase
    .from("discovered_patterns")
    .select("*")
    .order("confidence_score", { ascending: false })
    .order("estimated_pnl_impact", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load discovered patterns:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    pattern_key: row.pattern_key,
    category: row.category,
    dimension: row.dimension,
    label: row.label,
    description: row.description,
    recommended_action: row.recommended_action,
    trade_count: row.trade_count,
    win_rate: row.win_rate,
    net_pnl: row.net_pnl,
    avg_r: row.avg_r,
    expectancy: row.expectancy,
    confidence_score: row.confidence_score,
    confidence_tier: row.confidence_tier,
    estimated_pnl_impact: row.estimated_pnl_impact,
    is_active: row.is_active,
    supporting_trade_ids: row.supporting_trade_ids ?? [],
    first_seen_at: row.first_seen_at,
    last_verified_at: row.last_verified_at,
    degradation_note: row.degradation_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/* ------------------------------------------------------------------ */
/* Load patterns by category (for feature-specific consumers)         */
/* ------------------------------------------------------------------ */

export async function loadPatternsByCategory(
  category: DiscoveredPattern["category"]
): Promise<DiscoveredPattern[]> {
  const { data, error } = await supabase
    .from("discovered_patterns")
    .select("*")
    .eq("is_active", true)
    .eq("category", category)
    .order("confidence_score", { ascending: false })
    .order("estimated_pnl_impact", { ascending: false });

  if (error) {
    console.error("Failed to load patterns by category:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    pattern_key: row.pattern_key,
    category: row.category,
    dimension: row.dimension,
    label: row.label,
    description: row.description,
    recommended_action: row.recommended_action,
    trade_count: row.trade_count,
    win_rate: row.win_rate,
    net_pnl: row.net_pnl,
    avg_r: row.avg_r,
    expectancy: row.expectancy,
    confidence_score: row.confidence_score,
    confidence_tier: row.confidence_tier,
    estimated_pnl_impact: row.estimated_pnl_impact,
    is_active: row.is_active,
    supporting_trade_ids: row.supporting_trade_ids ?? [],
    first_seen_at: row.first_seen_at,
    last_verified_at: row.last_verified_at,
    degradation_note: row.degradation_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
