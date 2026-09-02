/*
# Add discipline_checks column to trades

1. Modified Tables
- `trades`
  - Added `discipline_checks` (jsonb, nullable, default '{}') — a JSON object mapping
    discipline rule keys to boolean values indicating whether the trader followed that
    discipline principle on this trade. The seven fixed discipline rules are:
      - waited_for_confirmation: Waited for confirmation before entering
      - risk_under_plan: Risk stayed within the planned amount
      - traded_plan_hours: Entered during trading plan hours
      - did_not_chase: Did not chase the entry
      - did_not_revenge_trade: Did not revenge trade
      - held_winner_correctly: Held the winning trade correctly (to target or planned exit)
      - exited_per_plan: Exited according to the trading plan
  - Added `discipline_score` (integer, nullable) — cached 0-100 discipline score for the trade.
2. Security
- No changes to RLS. Existing anon+authenticated policies already cover the new columns.
3. Notes
- Both columns are nullable so existing trades remain valid without discipline data.
- The frontend computes the score from the seven boolean checks; the cached column
  allows filtering/sorting by discipline score without recomputing.
- When discipline_checks is empty or null, the trade's discipline score is null
  (not 0), meaning "not yet evaluated" rather than "zero discipline".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'discipline_checks'
  ) THEN
    ALTER TABLE trades ADD COLUMN discipline_checks jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'discipline_score'
  ) THEN
    ALTER TABLE trades ADD COLUMN discipline_score integer;
  END IF;
END $$;
