/*
# Futures Trading Journal — schema

1. New Tables
- `trades`: one row per futures trade. Captures instrument, direction, entry/exit
  prices, quantities, timestamps, P&L, setup, emotions, rule compliance, AI analysis,
  and a link to the screenshot stored in Supabase Storage.
- `trading_rules`: user-defined trading rules (e.g. "No trading before 9:30",
  "Max 3 trades/day"). Each trade references the rules it violated/complied with
  via the `rule_compliance` JSONB column on `trades`.
2. Security
- Single-tenant app (no sign-in). RLS enabled on both tables with anon+authenticated
  full CRUD so the anon-key frontend can read/write its own data.
3. Notes
- `rule_compliance` is a JSONB object like { "<rule_id>": true|false, ... }
  indicating whether the trade followed (true) or violated (false) each rule.
  Only rules present in the object are scored; absent rules are ignored.
- `ai_analysis` holds the JSON returned by the AI analysis edge function.
*/

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  quantity numeric NOT NULL DEFAULT 1,
  entry_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz,
  pnl numeric,
  fees numeric NOT NULL DEFAULT 0,
  setup text,
  market_session text CHECK (market_session IN ('asian', 'london', 'new_york', 'overnight')),
  emotions text,
  mistakes text,
  notes text,
  screenshot_path text,
  rule_compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades (entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_instrument ON trades (instrument);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades (created_at DESC);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trades" ON trades;
CREATE POLICY "anon_select_trades" ON trades FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trades" ON trades;
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trades" ON trades;
CREATE POLICY "anon_update_trades" ON trades FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trades" ON trades;
CREATE POLICY "anon_delete_trades" ON trades FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS trading_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('risk', 'entry', 'exit', 'psychology', 'timing', 'general')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_rules" ON trading_rules;
CREATE POLICY "anon_select_rules" ON trading_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rules" ON trading_rules;
CREATE POLICY "anon_insert_rules" ON trading_rules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rules" ON trading_rules;
CREATE POLICY "anon_update_rules" ON trading_rules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rules" ON trading_rules;
CREATE POLICY "anon_delete_rules" ON trading_rules FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO trading_rules (name, description, category) VALUES
  ('Define risk before entry', 'Always know your stop loss and max risk before opening a position.', 'risk'),
  ('No revenge trading', 'After a losing trade, wait at least 15 minutes before the next entry.', 'psychology'),
  ('Trade with the trend', 'Only take trades in the direction of the higher timeframe trend.', 'entry'),
  ('Max 3 trades per day', 'Hard cap on number of trades to avoid overtrading.', 'risk')
ON CONFLICT DO NOTHING;
