/*
  # Add length bounds to trading rule text fields

  1. Changes
    - CHECK constraints limiting the length of name and description

  2. Security
    - Prevents unbounded payloads being written through the public Data API
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_rules_name_len') THEN
    ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_name_len
      CHECK (char_length(name) <= 200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_rules_description_len') THEN
    ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_description_len
      CHECK (description IS NULL OR char_length(description) <= 1000);
  END IF;
END $$;
