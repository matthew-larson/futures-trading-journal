/*
# Add tradovate_orders as allowed import source

1. Changes
- Drops and recreates the trades_import_source_check constraint to add 'tradovate_orders' to the allowed values.
- This lets trades imported from Tradovate's Orders CSV export be distinguished from the Performance export.
2. Security
- No RLS or policy changes.
3. Notes
- No data is lost; existing rows with import_source = 'tradovate' are unaffected.
- The new value 'tradovate_orders' applies to trades imported via the Orders CSV parser.
*/

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_import_source_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_import_source_check
  CHECK (import_source IS NULL OR import_source = ANY (ARRAY['tradovate','tradovate_orders','ninjatrader','rithmic','tradingview','manual','demo']));