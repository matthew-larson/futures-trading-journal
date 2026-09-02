/*
# Create trader_profiles and coach_conversations tables — persistent Coach memory

1. New Tables
- `trader_profiles`: a single-row table (enforced by a fixed key) that stores
  the structured Trader Profile built by the Coach system. Contains instruments,
  sessions, setups, strengths, weaknesses, risk preferences, rules, discipline
  patterns, psychological patterns, current improvement goal, and recent
  coaching recommendations. Updated automatically whenever the Edge Discovery
  Engine runs or new trades are imported.
- `coach_conversations`: stores individual coach Q&A exchanges so the Coach
  can reference previous questions and recommendations, giving it long-term
  conversational memory rather than treating each question as standalone.

2. Columns — trader_profiles
- `id` (uuid, primary key)
- `profile_key` (text, unique, always 'default' — single-tenant singleton)
- `profile_data` (jsonb, not null) — the full structured Trader Profile object
- `trade_count_at_build` (integer) — number of trades the profile was built from
- `pattern_count_at_build` (integer) — number of discovered patterns included
- `built_at` (timestamptz) — when the profile was last rebuilt
- `created_at` / `updated_at` (timestamptz)

3. Columns — coach_conversations
- `id` (uuid, primary key)
- `question` (text, not null) — user's question
- `answer` (text, not null) — coach's response
- `data_sources` (jsonb) — what data the answer was based on:
  { tradeCount, patternCount, ruleCount, sources: ["verified_data", "strong_pattern", ...] }
- `profile_snapshot` (jsonb) — the Trader Profile fields referenced in the answer
  (compact snapshot so old answers remain interpretable even if the profile changes)
- `created_at` (timestamptz)

4. Security
- Single-tenant app (no sign-in). RLS enabled with anon+authenticated full CRUD.

5. Indexes
- Unique index on `profile_key` for singleton upsert.
- Index on `created_at` for fetching recent conversations.

6. Notes
- The profile is stored as JSONB so its structure can evolve without migrations.
- `profile_snapshot` on conversations preserves the data context at answer time.
*/

CREATE TABLE IF NOT EXISTS trader_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE DEFAULT 'default',
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  trade_count_at_build integer NOT NULL DEFAULT 0,
  pattern_count_at_build integer NOT NULL DEFAULT 0,
  built_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_profiles_key ON trader_profiles (profile_key);

ALTER TABLE trader_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON trader_profiles;
CREATE POLICY "anon_select_profiles" ON trader_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profiles" ON trader_profiles;
CREATE POLICY "anon_insert_profiles" ON trader_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profiles" ON trader_profiles;
CREATE POLICY "anon_update_profiles" ON trader_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_profiles" ON trader_profiles;
CREATE POLICY "anon_delete_profiles" ON trader_profiles FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  data_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_conversations_created ON coach_conversations (created_at DESC);

ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversations" ON coach_conversations;
CREATE POLICY "anon_select_conversations" ON coach_conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON coach_conversations;
CREATE POLICY "anon_insert_conversations" ON coach_conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON coach_conversations;
CREATE POLICY "anon_delete_conversations" ON coach_conversations FOR DELETE
  TO anon, authenticated USING (true);
