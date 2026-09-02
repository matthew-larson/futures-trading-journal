/*
# Create beta feedback table

1. Purpose
   Lightweight beta feedback system for EdgeBook. Stores both general
   feedback (general, bug, feature, confusing) and per-insight ratings
   ("was this insight useful?" yes/no + optional explanation).

2. New Tables
   - `feedback`
     - `id`            uuid PK
     - `user_id`       text NOT NULL — persistent anonymous ID stored in
                       the browser (localStorage). No auth.users FK since
                       this is a no-auth app.
     - `feedback_type` text NOT NULL — one of:
                       'general', 'bug', 'feature', 'confusing', 'insight'
     - `page`          text — which page/feature the feedback came from
                       (e.g. 'coach', 'analytics', 'dashboard')
     - `message`       text — user message / optional explanation
     - `insight_id`    text — related coach message ID (for insight ratings)
     - `trade_id`      uuid — related trade ID (optional)
     - `rating`        text — 'yes' or 'no' for insight usefulness
     - `created_at`    timestamptz DEFAULT now()

3. Security
   - Enable RLS on `feedback`.
   - This is a single-tenant no-auth app. Anon + authenticated roles can
     INSERT (submit feedback) and SELECT (admin review view). We do not
     expose UPDATE or DELETE via policies — feedback is write-once.
   - Data is intentionally shared/public within the app.

4. Notes
   - No destructive operations.
   - Index on created_at for the admin review list (sorted by recency).
   - Index on user_id for per-user lookups.
*/

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  feedback_type text NOT NULL CHECK (
    feedback_type IN ('general', 'bug', 'feature', 'confusing', 'insight')
  ),
  page text,
  message text,
  insight_id text,
  trade_id uuid,
  rating text CHECK (rating IN ('yes', 'no') OR rating IS NULL),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_feedback" ON feedback;
CREATE POLICY "anon_select_feedback"
  ON feedback FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_feedback" ON feedback;
CREATE POLICY "anon_insert_feedback"
  ON feedback FOR INSERT
  TO anon, authenticated WITH CHECK (true);
