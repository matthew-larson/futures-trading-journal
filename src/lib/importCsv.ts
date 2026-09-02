import type { TradeInput, Direction, MarketSession } from "./types";
import { toNyParts } from "./timezone";

export type ImportSource = "tradovate" | "ninjatrader" | "rithmic" | "tradingview";

export interface ParsedTrade {
  input: TradeInput;
  importRef: string;
  source: ImportSource;
  warnings: string[];
}

export interface ParseResult {
  trades: ParsedTrade[];
  errors: string[];
  totalRows: number;
}

export interface PlatformParser {
  source: ImportSource;
  label: string;
  fileNameHint: string;
  parse(csvText: string): ParseResult;
}

/* ------------------------------------------------------------------ */
/* CSV utilities                                                       */
/* ------------------------------------------------------------------ */

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (line.trim() === "") continue;
    rows.push(splitCsvLine(line));
  }
  return rows;
}

function findHeaderIndex(rows: string[][], minCols = 3): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].length >= minCols) return i;
  }
  return 0;
}

function headerMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!(key in map)) map[key] = i;
  });
  return map;
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "--" || cleaned === "n/a") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function str(v: string | undefined): string | null {
  if (v === undefined) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function guessDirection(side: string | null, pnl: number | null): Direction {
  if (side) {
    const s = side.toLowerCase();
    if (s.includes("buy") || s.includes("long") || s === "b") return "long";
    if (s.includes("sell") || s.includes("short") || s === "s") return "short";
  }
  return pnl !== null && pnl < 0 ? "short" : "long";
}

function guessSession(entryIso: string): MarketSession {
  const hour = toNyParts(entryIso).hour;
  if (hour >= 18 || hour < 3) return "overnight";
  if (hour >= 3 && hour < 9) return "asian";
  if (hour >= 9 && hour < 14) return "new_york";
  return "london";
}

function toIso(dateStr: string | null, timeStr?: string | null): string | null {
  if (!dateStr) return null;
  const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr;
  const d = new Date(combined);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function dateOnly(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyTradeInput(): TradeInput {
  return {
    instrument: "",
    direction: "long",
    entry_price: 0,
    exit_price: null,
    stop_price: null,
    target_price: null,
    quantity: 1,
    entry_time: new Date().toISOString(),
    exit_time: null,
    pnl: null,
    fees: 0,
    setup: null,
    market_session: null,
    emotions: null,
    mistakes: null,
    notes: null,
    screenshot_path: null,
    rule_compliance: {},
    discipline_checks: {},
    strategy_tags: null,
  };
}

function applyBounds(input: TradeInput): TradeInput {
  return {
    ...input,
    instrument: input.instrument.slice(0, 32),
    setup: input.setup ? input.setup.slice(0, 500) : null,
    emotions: input.emotions ? input.emotions.slice(0, 500) : null,
    mistakes: input.mistakes ? input.mistakes.slice(0, 500) : null,
    notes: input.notes ? input.notes.slice(0, 10000) : null,
  };
}

/* ------------------------------------------------------------------ */
/* TradingView CSV parser                                             */
/* ------------------------------------------------------------------ */
/* TradingView Strategy Tester export columns (actual):
   Trade number, Type, Date and time, Signal, Price USD, Size (qty),
   Size (value), Net PnL USD, Return %, Commission USD,
   Favorable excursion USD, Favorable excursion %, Adverse excursion USD,
   Adverse excursion %, Cumulative PnL USD, Cumulative PnL %, Duration (bars)

   Each trade produces two rows sharing the same Trade number: an Exit row
   and an Entry row (exit listed first). The Type field is "Entry long",
   "Exit long", "Entry short", or "Exit short". The Signal field holds the
   strategy signal name (e.g. L, S, HSL, HSS). There is no symbol column —
   the strategy runs on whatever chart the user had open. */

function parseTradingView(text: string): ParseResult {
  const rows = parseCsv(text);
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];
  if (rows.length < 2) {
    return { trades, errors: ["File appears to be empty or has no data rows."], totalRows: 0 };
  }

  const hdrIdx = findHeaderIndex(rows);
  const headers = rows[hdrIdx];
  const h = headerMap(headers);
  const dataRows = rows.slice(hdrIdx + 1);

  const tradeNumCol = h["tradenumber"] ?? h["trade"] ?? h["tradeno"];
  const typeCol = h["type"] ?? h["side"];
  const dateTimeCol = h["dateandtime"] ?? h["datetime"] ?? h["date"] ?? h["time"];
  const signalCol = h["signal"] ?? h["setup"];
  const priceCol = h["priceusd"] ?? h["price"] ?? h["entryprice"];
  const qtyCol = h["sizeqty"] ?? h["quantity"] ?? h["qty"] ?? h["contracts"];
  const pnlCol = h["netpnlusd"] ?? h["netpnl"] ?? h["pl"] ?? h["pnl"] ?? h["profitloss"];
  const commissionCol = h["commissionusd"] ?? h["commission"] ?? h["fees"];
  const commentCol = h["comment"] ?? h["note"] ?? h["notes"];
  const instrumentCol = h["symbol"] ?? h["ticker"] ?? h["instrument"];

  // Group rows by Trade number so we can find the Entry and Exit pair
  // regardless of which appears first.
  const groups = new Map<string, string[][]>();
  const order: string[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const tradeNum = tradeNumCol !== undefined ? str(row[tradeNumCol]) : null;
    const key = tradeNum ?? `seq-${i}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }

  for (let gi = 0; gi < order.length; gi++) {
    const groupRows = groups.get(order[gi])!;
    try {
      let entryRow: string[] | null = null;
      let exitRow: string[] | null = null;

      for (const row of groupRows) {
        const typeRaw = typeCol !== undefined ? str(row[typeCol]) : null;
        if (!typeRaw) continue;
        const t = typeRaw.toLowerCase();
        if (t.includes("entry")) entryRow = row;
        else if (t.includes("exit")) exitRow = row;
      }

      if (!entryRow && !exitRow && groupRows.length >= 2) {
        entryRow = groupRows[0];
        exitRow = groupRows[1];
      } else if (!entryRow && groupRows.length >= 1) {
        entryRow = groupRows[0];
      } else if (!exitRow && groupRows.length >= 2) {
        exitRow = groupRows[1];
      }

      if (!entryRow) {
        errors.push(`Trade ${gi + 1}: could not identify entry row — skipped.`);
        continue;
      }

      const tradeNum = tradeNumCol !== undefined ? str(entryRow[tradeNumCol]) : null;
      const ref = `tv-${tradeNum ?? gi + 1}`;

      const entryTypeRaw = typeCol !== undefined ? str(entryRow[typeCol]) : null;
      const direction = guessDirection(
        entryTypeRaw,
        pnlCol !== undefined ? num(entryRow[pnlCol]) : null
      );

      const entryPrice = priceCol !== undefined ? num(entryRow[priceCol]) : null;
      const exitPrice = exitRow && priceCol !== undefined ? num(exitRow[priceCol]) : null;
      const qty = qtyCol !== undefined ? num(entryRow[qtyCol]) : null;
      const pnl = pnlCol !== undefined ? num(entryRow[pnlCol]) : null;
      // Commission is per-trade (same value on both rows), so take it once.
      const fees = commissionCol !== undefined
        ? (num(exitRow?.[commissionCol] ?? entryRow[commissionCol]) ?? 0)
        : 0;
      const entryTime = dateTimeCol !== undefined ? toIso(entryRow[dateTimeCol]) : null;
      const exitTime = exitRow && dateTimeCol !== undefined ? toIso(exitRow[dateTimeCol]) : null;
      const signal = signalCol !== undefined
        ? str(exitRow?.[signalCol] ?? entryRow[signalCol])
        : null;
      const comment = commentCol !== undefined
        ? str(exitRow?.[commentCol] ?? entryRow[commentCol])
        : null;
      const instrument = instrumentCol !== undefined ? str(entryRow[instrumentCol]) : null;

      if (entryPrice === null || qty === null || entryTime === null) {
        errors.push(`Trade ${gi + 1}: missing entry price, quantity, or time — skipped.`);
        continue;
      }

      const input = applyBounds({
        ...emptyTradeInput(),
        instrument: (instrument ?? "UNKNOWN").toUpperCase(),
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: qty,
        entry_time: entryTime,
        exit_time: exitTime,
        pnl,
        fees: fees ?? 0,
        setup: signal,
        notes: comment,
        market_session: guessSession(entryTime),
      });

      trades.push({
        input,
        importRef: ref,
        source: "tradingview",
        warnings: [],
      });
    } catch {
      errors.push(`Trade ${gi + 1}: could not parse — skipped.`);
    }
  }

  return { trades, errors, totalRows: dataRows.length };
}

/* ------------------------------------------------------------------ */
/* NinjaTrader CSV parser                                             */
/* ------------------------------------------------------------------ */
/* NinjaTrader trade export columns (typical):
   Instrument, Description, Type, Quantity, Entry Price, Exit Price,
   Entry Time, Exit Time, Profit, Commission, Currency, Trade ID */

function parseNinjaTrader(text: string): ParseResult {
  const rows = parseCsv(text);
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];
  if (rows.length < 2) {
    return { trades, errors: ["File appears to be empty or has no data rows."], totalRows: 0 };
  }

  const hdrIdx = findHeaderIndex(rows);
  const headers = rows[hdrIdx];
  const h = headerMap(headers);
  const dataRows = rows.slice(hdrIdx + 1);

  const instrumentCol = h["instrument"] ?? h["symbol"];
  const typeCol = h["type"] ?? h["side"] ?? h["direction"];
  const qtyCol = h["quantity"] ?? h["qty"] ?? h["contracts"];
  const entryPriceCol = h["entryprice"] ?? h["entry"];
  const exitPriceCol = h["exitprice"] ?? h["exit"];
  const entryTimeCol = h["entrytime"] ?? h["entrydate"];
  const exitTimeCol = h["exittime"] ?? h["exitdate"];
  const profitCol = h["profit"] ?? h["pnl"] ?? h["pl"] ?? h["netpnl"];
  const commissionCol = h["commission"] ?? h["fees"] ?? h["commissions"];
  const tradeIdCol = h["tradeid"] ?? h["tradeno"] ?? h["trade"];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    try {
      const instrument = instrumentCol !== undefined ? str(row[instrumentCol]) : null;
      const sideRaw = typeCol !== undefined ? str(row[typeCol]) : null;
      const qty = qtyCol !== undefined ? num(row[qtyCol]) : null;
      const entryPrice = entryPriceCol !== undefined ? num(row[entryPriceCol]) : null;
      const exitPrice = exitPriceCol !== undefined ? num(row[exitPriceCol]) : null;
      const entryTime = entryTimeCol !== undefined ? toIso(row[entryTimeCol]) : null;
      const exitTime = exitTimeCol !== undefined ? toIso(row[exitTimeCol]) : null;
      const pnl = profitCol !== undefined ? num(row[profitCol]) : null;
      const fees = commissionCol !== undefined ? num(row[commissionCol]) : null;
      const tradeId = tradeIdCol !== undefined ? str(row[tradeIdCol]) : null;

      if (!instrument || entryPrice === null || qty === null || entryTime === null) {
        errors.push(`Row ${i + 1}: missing instrument, entry price, quantity, or time — skipped.`);
        continue;
      }

      const direction = guessDirection(sideRaw, pnl);
      const ref = `nt-${tradeId ?? entryTime}`;

      const input = applyBounds({
        ...emptyTradeInput(),
        instrument: instrument.toUpperCase(),
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: qty,
        entry_time: entryTime,
        exit_time: exitTime,
        pnl,
        fees: fees ?? 0,
        market_session: guessSession(entryTime),
      });

      trades.push({
        input,
        importRef: ref,
        source: "ninjatrader",
        warnings: [],
      });
    } catch {
      errors.push(`Row ${i + 1}: could not parse — skipped.`);
    }
  }

  return { trades, errors, totalRows: dataRows.length };
}

/* ------------------------------------------------------------------ */
/* Rithmic CSV parser                                                 */
/* ------------------------------------------------------------------ */
/* Rithmic trade export columns (typical):
   Trade ID, Symbol, Side, Qty, Entry Price, Exit Price, Entry Time,
   Exit Time, P&L, Commission, Account */

function parseRithmic(text: string): ParseResult {
  const rows = parseCsv(text);
  const trades: ParsedTrade[] = [];
  const errors: string[] = [];
  if (rows.length < 2) {
    return { trades, errors: ["File appears to be empty or has no data rows."], totalRows: 0 };
  }

  const hdrIdx = findHeaderIndex(rows);
  const headers = rows[hdrIdx];
  const h = headerMap(headers);
  const dataRows = rows.slice(hdrIdx + 1);

  const symbolCol = h["symbol"] ?? h["instrument"] ?? h["contract"];
  const sideCol = h["side"] ?? h["type"] ?? h["direction"];
  const qtyCol = h["qty"] ?? h["quantity"] ?? h["contracts"];
  const entryPriceCol = h["entryprice"] ?? h["entry"];
  const exitPriceCol = h["exitprice"] ?? h["exit"];
  const entryTimeCol = h["entrytime"] ?? h["entrydate"] ?? h["entrydatetime"];
  const exitTimeCol = h["exittime"] ?? h["exitdate"] ?? h["exitdatetime"];
  const pnlCol = h["pl"] ?? h["pnl"] ?? h["profit"] ?? h["netpnl"];
  const commissionCol = h["commission"] ?? h["fees"];
  const tradeIdCol = h["tradeid"] ?? h["tradeno"] ?? h["fillid"];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    try {
      const symbol = symbolCol !== undefined ? str(row[symbolCol]) : null;
      const sideRaw = sideCol !== undefined ? str(row[sideCol]) : null;
      const qty = qtyCol !== undefined ? num(row[qtyCol]) : null;
      const entryPrice = entryPriceCol !== undefined ? num(row[entryPriceCol]) : null;
      const exitPrice = exitPriceCol !== undefined ? num(row[exitPriceCol]) : null;
      const entryTime = entryTimeCol !== undefined ? toIso(row[entryTimeCol]) : null;
      const exitTime = exitTimeCol !== undefined ? toIso(row[exitTimeCol]) : null;
      const pnl = pnlCol !== undefined ? num(row[pnlCol]) : null;
      const fees = commissionCol !== undefined ? num(row[commissionCol]) : null;
      const tradeId = tradeIdCol !== undefined ? str(row[tradeIdCol]) : null;

      if (!symbol || entryPrice === null || qty === null || entryTime === null) {
        errors.push(`Row ${i + 1}: missing symbol, entry price, quantity, or time — skipped.`);
        continue;
      }

      const direction = guessDirection(sideRaw, pnl);
      const ref = `rth-${tradeId ?? entryTime}`;

      const input = applyBounds({
        ...emptyTradeInput(),
        instrument: symbol.toUpperCase(),
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: qty,
        entry_time: entryTime,
        exit_time: exitTime,
        pnl,
        fees: fees ?? 0,
        market_session: guessSession(entryTime),
      });

      trades.push({
        input,
        importRef: ref,
        source: "rithmic",
        warnings: [],
      });
    } catch {
      errors.push(`Row ${i + 1}: could not parse — skipped.`);
    }
  }

  return { trades, errors, totalRows: dataRows.length };
}

/* ------------------------------------------------------------------ */
/* Parser registry                                                    */
/* ------------------------------------------------------------------ */

export const PLATFORM_PARSERS: Record<ImportSource, PlatformParser> = {
  tradingview: {
    source: "tradingview",
    label: "TradingView",
    fileNameHint: "tradingview_export.csv",
    parse: parseTradingView,
  },
  ninjatrader: {
    source: "ninjatrader",
    label: "NinjaTrader",
    fileNameHint: "ninjatrader_trades.csv",
    parse: parseNinjaTrader,
  },
  rithmic: {
    source: "rithmic",
    label: "Rithmic",
    fileNameHint: "rithmic_trades.csv",
    parse: parseRithmic,
  },
  tradovate: {
    source: "tradovate",
    label: "Tradovate",
    fileNameHint: "",
    parse: () => ({ trades: [], errors: ["Tradovate uses API sync, not CSV import."], totalRows: 0 }),
  },
};
