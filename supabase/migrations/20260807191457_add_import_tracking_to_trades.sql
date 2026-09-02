/*
  # Add import tracking columns to trades

  1. Changes
    - import_source: which platform the trade came from (tradovate, ninjatrader, rithmic, tradingview, manual)
    - import_ref: platform's unique trade/fill id for deduplication

  2. Security
    - import_source is constrained to a known set
    - Unique index on (import_source, import_ref) prevents duplicate imports
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = 'import_source'
  ) THEN
    ALTER TABLE public.trades ADD COLUMN import_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = 'import_ref'
  ) THEN
    ALTER TABLE public.trades ADD COLUMN import_ref text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_import_source_check') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_import_source_check
      CHECK (import_source IS NULL OR import_source = ANY (ARRAY['tradovate','ninjatrader','rithmic','tradingview','manual']));
  END IF;
END $$;

-- Default existing rows to manual
UPDATE public.trades SET import_source = 'manual' WHERE import_source IS NULL;

-- Unique dedup index: one platform trade can only be imported once
CREATE UNIQUE INDEX IF NOT EXISTS trades_import_dedup_idx
  ON public.trades (import_source, import_ref)
  WHERE import_source IS NOT NULL AND import_ref IS NOT NULL;
