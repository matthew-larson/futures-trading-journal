/*
  # Bound the size of trader_profiles.profile_data

  1. Purpose
     profile_data is a client-supplied jsonb document with no size limit,
     so an authenticated caller could write an arbitrarily large payload
     straight through the Data API. Every other user-writable table in this
     schema already carries explicit bounds.

  2. Changes
     - Bound the serialised length of profile_data to 2 MB
     - Bound profile_key to 100 characters

  3. Notes
     The largest real profile is roughly 13 KB, so 2 MB leaves well over a
     hundredfold headroom and no legitimate write is affected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trader_profiles_size_bounds'
  ) THEN
    ALTER TABLE public.trader_profiles
      ADD CONSTRAINT trader_profiles_size_bounds CHECK (
        (profile_data IS NULL OR char_length(profile_data::text) <= 2097152)
        AND (profile_key IS NULL OR char_length(profile_key) <= 100)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.trader_profiles
  VALIDATE CONSTRAINT trader_profiles_size_bounds;
