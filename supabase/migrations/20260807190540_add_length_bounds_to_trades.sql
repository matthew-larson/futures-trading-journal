/*
  # Add length bounds to trade text and tag fields

  1. Changes
    - CHECK constraints limiting the length of instrument, setup, emotions,
      mistakes and notes
    - CHECK constraint limiting strategy_tags to 20 elements and 1300 total characters

  2. Security
    - Prevents unbounded payloads being written through the public Data API
    - Limits are far above realistic use so existing behaviour is unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_instrument_len') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_instrument_len
      CHECK (char_length(instrument) <= 32);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_setup_len') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_setup_len
      CHECK (setup IS NULL OR char_length(setup) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_emotions_len') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_emotions_len
      CHECK (emotions IS NULL OR char_length(emotions) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_mistakes_len') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_mistakes_len
      CHECK (mistakes IS NULL OR char_length(mistakes) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_notes_len') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_notes_len
      CHECK (notes IS NULL OR char_length(notes) <= 10000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_strategy_tags_bounds') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_strategy_tags_bounds
      CHECK (
        strategy_tags IS NULL
        OR (
          coalesce(array_length(strategy_tags, 1), 0) <= 20
          AND char_length(array_to_string(strategy_tags, ',')) <= 1300
        )
      );
  END IF;
END $$;
