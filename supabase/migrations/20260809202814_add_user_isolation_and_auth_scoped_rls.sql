-- =====================================================================
-- User isolation: add user_id columns, replace USING(true) policies
-- with auth.uid()-scoped ownership checks.
-- =====================================================================

-- 1. Add user_id columns (nullable for existing rows; DEFAULT auth.uid()
--    ensures new inserts are auto-associated with the authenticated user)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE trading_rules ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE discovered_patterns ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE trader_profiles ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- feedback already has a text user_id (legacy localStorage ID); add a
-- proper uuid column for auth-based ownership
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();

-- 2. Update unique constraints to be per-user so different users can
--    have the same pattern_key / profile_key
ALTER TABLE discovered_patterns DROP CONSTRAINT IF EXISTS discovered_patterns_pattern_key_key;
ALTER TABLE discovered_patterns ADD CONSTRAINT discovered_patterns_user_pattern_key UNIQUE (user_id, pattern_key);

ALTER TABLE trader_profiles DROP CONSTRAINT IF EXISTS trader_profiles_profile_key_key;
ALTER TABLE trader_profiles ADD CONSTRAINT trader_profiles_user_profile_key UNIQUE (user_id, profile_key);

-- 3. Drop ALL existing insecure policies (USING(true) / WITH CHECK(true))
DROP POLICY IF EXISTS anon_select_trades ON trades;
DROP POLICY IF EXISTS anon_insert_trades ON trades;
DROP POLICY IF EXISTS anon_update_trades ON trades;
DROP POLICY IF EXISTS anon_delete_trades ON trades;

DROP POLICY IF EXISTS anon_select_rules ON trading_rules;
DROP POLICY IF EXISTS anon_insert_rules ON trading_rules;
DROP POLICY IF EXISTS anon_update_rules ON trading_rules;
DROP POLICY IF EXISTS anon_delete_rules ON trading_rules;

DROP POLICY IF EXISTS anon_select_conversations ON coach_conversations;
DROP POLICY IF EXISTS anon_insert_conversations ON coach_conversations;
DROP POLICY IF EXISTS anon_delete_conversations ON coach_conversations;

DROP POLICY IF EXISTS anon_select_patterns ON discovered_patterns;
DROP POLICY IF EXISTS anon_insert_patterns ON discovered_patterns;
DROP POLICY IF EXISTS anon_update_patterns ON discovered_patterns;
DROP POLICY IF EXISTS anon_delete_patterns ON discovered_patterns;

DROP POLICY IF EXISTS anon_select_profiles ON trader_profiles;
DROP POLICY IF EXISTS anon_insert_profiles ON trader_profiles;
DROP POLICY IF EXISTS anon_update_profiles ON trader_profiles;
DROP POLICY IF EXISTS anon_delete_profiles ON trader_profiles;

DROP POLICY IF EXISTS anon_select_feedback ON feedback;
DROP POLICY IF EXISTS anon_insert_feedback ON feedback;

-- 4. Create auth.uid()-scoped policies (4 per table: SELECT/INSERT/UPDATE/DELETE)
--    All scoped TO authenticated only — anon role gets nothing.

-- ── trades ──
CREATE POLICY select_own_trades ON trades FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY insert_own_trades ON trades FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_trades ON trades FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_trades ON trades FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── trading_rules ──
CREATE POLICY select_own_rules ON trading_rules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY insert_own_rules ON trading_rules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_rules ON trading_rules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_rules ON trading_rules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── coach_conversations ──
CREATE POLICY select_own_conversations ON coach_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY insert_own_conversations ON coach_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_conversations ON coach_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_conversations ON coach_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── discovered_patterns ──
CREATE POLICY select_own_patterns ON discovered_patterns FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY insert_own_patterns ON discovered_patterns FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_patterns ON discovered_patterns FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_patterns ON discovered_patterns FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── trader_profiles ──
CREATE POLICY select_own_profiles ON trader_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY insert_own_profiles ON trader_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_profiles ON trader_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_profiles ON trader_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── feedback ──
CREATE POLICY select_own_feedback ON feedback FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY insert_own_feedback ON feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY update_own_feedback ON feedback FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY delete_own_feedback ON feedback FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- 5. Revoke ALL privileges from anon role — only authenticated can access data
REVOKE ALL ON trades FROM anon;
REVOKE ALL ON trading_rules FROM anon;
REVOKE ALL ON coach_conversations FROM anon;
REVOKE ALL ON discovered_patterns FROM anon;
REVOKE ALL ON trader_profiles FROM anon;
REVOKE ALL ON feedback FROM anon;

-- Grant full CRUD to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON trades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trading_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON discovered_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trader_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO authenticated;

-- 6. Storage: replace open bucket policies with per-user ownership checks
--    The storage.objects `owner` column is automatically set to auth.uid()
--    on upload by an authenticated client.
DROP POLICY IF EXISTS anon_read_screenshots ON storage.objects;
DROP POLICY IF EXISTS anon_insert_screenshots ON storage.objects;
DROP POLICY IF EXISTS anon_update_screenshots ON storage.objects;
DROP POLICY IF EXISTS anon_delete_screenshots ON storage.objects;

CREATE POLICY user_read_screenshots ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'trade-screenshots' AND owner = auth.uid());
CREATE POLICY user_insert_screenshots ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-screenshots' AND owner = auth.uid());
CREATE POLICY user_update_screenshots ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'trade-screenshots' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'trade-screenshots' AND owner = auth.uid());
CREATE POLICY user_delete_screenshots ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'trade-screenshots' AND owner = auth.uid());

-- 7. Create indexes for user_id columns for query performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_rules_user_id ON trading_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user_id ON coach_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_user_id ON discovered_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_trader_profiles_user_id ON trader_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_owner_id ON feedback(owner_id);
