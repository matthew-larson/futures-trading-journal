/*
  # Bound the free-text fields on discovered_patterns

  1. Purpose
     Every other user-writable table in this schema (trades, trading_rules,
     feedback, coach_conversations) carries explicit char_length checks.
     discovered_patterns was missed, so an authenticated caller could write
     arbitrarily large rows straight through the Data API.

  2. Changes
     - char_length bounds on pattern_key, label, description,
       recommended_action and degradation_note
     - element-count bound on the supporting_trade_ids json array

  3. Notes
     Bounds are set well above anything the pattern engine produces, so no
     legitimate write is affected. Added NOT VALID then validated so the
     statement cannot fail on pre-existing rows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discovered_patterns_text_bounds'
  ) THEN
    ALTER TABLE public.discovered_patterns
      ADD CONSTRAINT discovered_patterns_text_bounds CHECK (
        (pattern_key IS NULL OR char_length(pattern_key) <= 300)
        AND (label IS NULL OR char_length(label) <= 500)
        AND (description IS NULL OR char_length(description) <= 5000)
        AND (recommended_action IS NULL OR char_length(recommended_action) <= 5000)
        AND (degradation_note IS NULL OR char_length(degradation_note) <= 2000)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discovered_patterns_supporting_ids_bounds'
  ) THEN
    ALTER TABLE public.discovered_patterns
      ADD CONSTRAINT discovered_patterns_supporting_ids_bounds CHECK (
        supporting_trade_ids IS NULL
        OR jsonb_typeof(supporting_trade_ids) <> 'array'
        OR jsonb_array_length(supporting_trade_ids) <= 5000
      ) NOT VALID;
  END IF;
END $$;
