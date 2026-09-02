/*
# Create discovered_patterns table — Edge Discovery Engine persistence

1. New Tables
- `discovered_patterns`: one row per statistically meaningful pattern found
  by the Edge Discovery Engine when analyzing the user's trade history.
  Stores the pattern signature, supporting stats, confidence classification,
  and tracking metadata so the app can detect whether a pattern continues to
  hold or degrades as new trades are imported.

2. Columns
- `id` (uuid, primary key)
- `pattern_key` (text, not null, unique) — a stable deterministic key that
  identifies the pattern (e.g. "setup:Liquidity Sweep:strength"). Used to
  upsert so re-running the engine updates the same row instead of duplicating.
- `category` (text, not null) — "strength" | "weakness" | "opportunity" |
  "behavioral_leak" | "risk_pattern" | "time_effect" | "trend"
- `dimension` (text, not null) — the primary dimension analyzed:
  "instrument" | "direction" | "strategy" | "setup" | "entry_time" |
  "exit_time" | "day_of_week" | "session" | "holding_time" | "r_multiple" |
  "win_loss" | "position_size" | "stop_size" | "target_size" |
  "rule_compliance" | "discipline_score" | "emotional_tag" | "trade_grade" |
  "consecutive_wins" | "consecutive_losses" | "combination"
- `label` (text, not null) — human-readable pattern description
- `description` (text, not null) — detailed explanation with supporting numbers
- `recommended_action` (text, not null) — what the trader should do about it
- `trade_count` (integer, not null) — number of supporting trades
- `win_rate` (numeric) — win rate percentage of supporting trades
- `net_pnl` (numeric) — total net P&L of supporting trades
- `avg_r` (numeric) — average R multiple
- `expectancy` (numeric) — average P&L per trade
- `confidence_score` (integer, not null) — 0-100 confidence score
- `confidence_tier` (text, not null) — "emerging" | "strong" | "high_confidence"
- `estimated_pnl_impact` (numeric) — estimated dollar impact on overall P&L
- `is_active` (boolean, default true) — whether the pattern is currently holding
- `supporting_trade_ids` (jsonb) — array of trade UUIDs that support this pattern
- `first_seen_at` (timestamptz) — when the pattern was first discovered
- `last_verified_at` (timestamptz) — when the engine last re-verified the pattern
- `degradation_note` (text) — if the pattern degraded, explains how
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

3. Security
- Single-tenant app (no sign-in). RLS enabled with anon+authenticated full CRUD.

4. Indexes
- Unique index on `pattern_key` for upserts.
- Index on `category` for filtering by pattern type.
- Index on `is_active` for fetching only currently-holding patterns.
- Index on `last_verified_at` for finding stale patterns.

5. Notes
- The `pattern_key` enables idempotent re-runs: the engine can upsert by key
  so re-analysis after new imports updates existing patterns rather than
  creating duplicates.
- `supporting_trade_ids` is stored as a JSONB array so the app can show which
  specific trades back a pattern without recomputing.
- `confidence_tier` maps the numeric `confidence_score` to the three labels:
  Emerging Pattern (< 55), Strong Pattern (55-74), High-Confidence Pattern (≥ 75).
*/

CREATE TABLE IF NOT EXISTS discovered_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN (
    'strength', 'weakness', 'opportunity',
    'behavioral_leak', 'risk_pattern', 'time_effect', 'trend'
  )),
  dimension text NOT NULL CHECK (dimension IN (
    'instrument', 'direction', 'strategy', 'setup', 'entry_time',
    'exit_time', 'day_of_week', 'session', 'holding_time', 'r_multiple',
    'win_loss', 'position_size', 'stop_size', 'target_size',
    'rule_compliance', 'discipline_score', 'emotional_tag', 'trade_grade',
    'consecutive_wins', 'consecutive_losses', 'combination'
  )),
  label text NOT NULL,
  description text NOT NULL,
  recommended_action text NOT NULL,
  trade_count integer NOT NULL DEFAULT 0,
  win_rate numeric,
  net_pnl numeric,
  avg_r numeric,
  expectancy numeric,
  confidence_score integer NOT NULL DEFAULT 0,
  confidence_tier text NOT NULL CHECK (confidence_tier IN (
    'emerging', 'strong', 'high_confidence'
  )),
  estimated_pnl_impact numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  supporting_trade_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at timestamptz DEFAULT now(),
  last_verified_at timestamptz DEFAULT now(),
  degradation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_patterns_key ON discovered_patterns (pattern_key);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_category ON discovered_patterns (category);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_active ON discovered_patterns (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_verified ON discovered_patterns (last_verified_at);

ALTER TABLE discovered_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_patterns" ON discovered_patterns;
CREATE POLICY "anon_select_patterns" ON discovered_patterns FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_patterns" ON discovered_patterns;
CREATE POLICY "anon_insert_patterns" ON discovered_patterns FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_patterns" ON discovered_patterns;
CREATE POLICY "anon_update_patterns" ON discovered_patterns FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_patterns" ON discovered_patterns;
CREATE POLICY "anon_delete_patterns" ON discovered_patterns FOR DELETE
  TO anon, authenticated USING (true);
