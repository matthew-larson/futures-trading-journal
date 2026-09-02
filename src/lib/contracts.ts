/**
 * Futures contract multipliers — dollars per point per contract.
 *
 * When computing dollar risk or dollar P&L from price distances (points),
 * multiply: dollars = points × multiplier × quantity.
 *
 * R-multiple = netDollarPnl / (priceDistancePoints × multiplier × quantity)
 *
 * Only instruments with a verified contract specification are listed here.
 * For any other instrument, `getMultiplier` returns `null` so callers can
 * surface "R-multiple unavailable" instead of computing a wrong value.
 */

export const CONTRACT_MULTIPLIERS: Record<string, number> = {
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
};

export const R_MULTIPLE_UNAVAILABLE_MSG =
  "R-multiple unavailable — contract specifications for this instrument have not been configured.";

/**
 * Case-insensitive lookup of a contract multiplier.
 * Returns `null` when the instrument has no verified specification,
 * so R-multiple can be surfaced as "N/A" rather than miscomputed.
 */
export function getMultiplier(instrument: string): number | null {
  const key = instrument.trim().toUpperCase();
  if (CONTRACT_MULTIPLIERS[key] !== undefined) return CONTRACT_MULTIPLIERS[key];
  for (const sym of Object.keys(CONTRACT_MULTIPLIERS)) {
    if (key.startsWith(sym)) return CONTRACT_MULTIPLIERS[sym];
  }
  return null;
}

/** Dollar risk = price distance (points) × multiplier × quantity. Returns null if multiplier unknown. */
export function dollarRisk(
  entryPrice: number,
  stopPrice: number,
  quantity: number,
  instrument: string
): number | null {
  const mult = getMultiplier(instrument);
  if (mult === null) return null;
  const points = Math.abs(entryPrice - stopPrice);
  return points * mult * quantity;
}

/** Dollar P&L from price distance = points × multiplier × quantity. Returns null if multiplier unknown. */
export function dollarPnlFromPoints(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  instrument: string,
  direction: "long" | "short"
): number | null {
  const mult = getMultiplier(instrument);
  if (mult === null) return null;
  const points =
    direction === "long"
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
  return points * mult * quantity;
}
