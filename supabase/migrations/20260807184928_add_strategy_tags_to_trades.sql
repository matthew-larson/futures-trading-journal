/*
# Add strategy tags to trades

1. Changes
- Adds `strategy_tags` column to `trades` table: a text array (TEXT[])
  that stores zero or more strategy labels per trade.
- Default is an empty array so existing trades have no tags.
- Nullable so old rows and open trades are unaffected.

2. Purpose
- Enables the Strategy Explorer: every trade can be tagged with one or
  more strategies (e.g. "Opening Range Breakout", "Liquidity Sweep",
  "FVG", "VWAP Reversal", "Trend Pullback", "EMA Bounce", "News Trade").
- Analytics are then computed per strategy tag.

3. Security
- No policy changes. The existing anon/authenticated CRUD policies on
  `trades` automatically cover the new column.
*/

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS strategy_tags text[] DEFAULT '{}'::text[];