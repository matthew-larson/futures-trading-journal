-- =====================================================================
-- Fix remaining cross-user issues found in second security audit
-- =====================================================================

-- 1. feedback: make legacy user_id column nullable so inserts work
--    (RLS uses owner_id uuid; user_id text is legacy and no longer needed)
ALTER TABLE feedback ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop old non-per-user unique indexes that block cross-user inserts
DROP INDEX IF EXISTS idx_trader_profiles_key;
DROP INDEX IF EXISTS idx_discovered_patterns_key;

-- 3. trades_import_dedup_idx: recreate with user_id so different users
--    can import the same source/ref without conflicting
DROP INDEX IF EXISTS trades_import_dedup_idx;
CREATE UNIQUE INDEX trades_import_dedup_idx
  ON trades (user_id, import_source, import_ref)
  WHERE (import_source IS NOT NULL AND import_ref IS NOT NULL);
