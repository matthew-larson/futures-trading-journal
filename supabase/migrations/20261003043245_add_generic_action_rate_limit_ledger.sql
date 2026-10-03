/*
# Add a generic per-user action rate limit ledger

1. New Tables
- `action_rate_limits`
  - `user_id` (uuid, part of primary key, references auth.users, cascade delete)
  - `action` (text, part of primary key) — the operation being limited, e.g. "tradovate_sync"
  - `window_start` (timestamptz) — when the current rolling window began
  - `request_count` (integer) — attempts inside the current window
  - `updated_at` (timestamptz)

2. New Functions
- `claim_rate_limit_slot(p_user_id uuid, p_action text, p_max integer, p_window_seconds integer)`
  returns boolean. Atomically increments (or resets) the window and returns
  false once the allowance for that window is exceeded. SECURITY DEFINER with a
  fixed search_path.

3. Security
- RLS is enabled on `action_rate_limits` and it has deliberately NO policies,
  and all privileges are revoked from `anon` and `authenticated`, so the table
  is unreachable from the browser. Only the service role (which bypasses RLS)
  writes it, from edge functions. The database linter reports this as
  `rls_enabled_no_policy`; that INFO notice is the intended lockdown.
- EXECUTE on the function is revoked from PUBLIC, `anon` and `authenticated`,
  so a client cannot consume or reset another account's allowance.

4. Notes
1. Durable state is required because edge function instances do not share
   memory, so an in-memory counter cannot limit anything.
2. The claim is a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so two
   concurrent requests cannot both pass the check.
*/

CREATE TABLE IF NOT EXISTS action_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE action_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON action_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION claim_rate_limit_slot(
  p_user_id uuid,
  p_action text,
  p_max integer DEFAULT 20,
  p_window_seconds integer DEFAULT 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
BEGIN
  INSERT INTO action_rate_limits (user_id, action, window_start, request_count, updated_at)
  VALUES (p_user_id, p_action, now(), 1, now())
  ON CONFLICT (user_id, action) DO UPDATE
    SET request_count = CASE
          WHEN action_rate_limits.window_start < now() - v_window THEN 1
          ELSE action_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN action_rate_limits.window_start < now() - v_window THEN now()
          ELSE action_rate_limits.window_start
        END,
        updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN v_count <= greatest(p_max, 1);
END;
$$;

REVOKE ALL ON FUNCTION claim_rate_limit_slot(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_rate_limit_slot(uuid, text, integer, integer) FROM anon, authenticated;
