/*
# Add donation checkout rate limit ledger

1. New Tables
   - `donation_rate_limits`
     - `user_id` (uuid, primary key) - the account the counter belongs to
     - `window_start` (timestamptz) - start of the current one hour window
     - `request_count` (integer) - checkout sessions created inside that window
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on `donation_rate_limits`.
   - Deliberately NO policies and NO grants to `anon` or `authenticated`: the table
     is written only by the create-donation-checkout edge function using the service
     role, which bypasses RLS. The browser can neither read nor reset the counter.

3. Notes
   1. This durable table replaces any in-memory counter, which would reset per edge
      function instance and therefore not limit anything.
   2. The function claims a slot atomically with the `claim_donation_checkout_slot`
      function below, so two concurrent requests cannot both pass the cap.
*/

CREATE TABLE IF NOT EXISTS donation_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE donation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON donation_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION claim_donation_checkout_slot(
  p_user_id uuid,
  p_max_per_hour integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO donation_rate_limits (user_id, window_start, request_count, updated_at)
  VALUES (p_user_id, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET request_count = CASE
          WHEN donation_rate_limits.window_start < now() - interval '1 hour' THEN 1
          ELSE donation_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN donation_rate_limits.window_start < now() - interval '1 hour' THEN now()
          ELSE donation_rate_limits.window_start
        END,
        updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_per_hour;
END;
$$;

REVOKE ALL ON FUNCTION claim_donation_checkout_slot(uuid, integer) FROM PUBLIC, anon, authenticated;
