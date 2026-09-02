/*
# Add stop_price and target_price columns to trades

1. Modified Tables
- `trades`
  - Added `stop_price` (numeric, nullable) — the stop-loss price the trader planned for the trade.
  - Added `target_price` (numeric, nullable) — the take-profit / target price the trader planned for the trade.
2. Security
- No changes to RLS. Existing anon+authenticated policies already cover the new columns.
3. Notes
- Both columns are nullable so existing trades remain valid without a stop/target.
- These fields enable R-multiple and risk/reward calculations on the Trade Detail review screen.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'stop_price'
  ) THEN
    ALTER TABLE trades ADD COLUMN stop_price numeric;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'target_price'
  ) THEN
    ALTER TABLE trades ADD COLUMN target_price numeric;
  END IF;
END $$;