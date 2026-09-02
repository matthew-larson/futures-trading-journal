-- Add 'demo' to the allowed import_source values so demo trades can be stored and identified.

ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_import_source_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_import_source_check
  CHECK (import_source IS NULL OR import_source = ANY (ARRAY['tradovate','ninjatrader','rithmic','tradingview','manual','demo']));
