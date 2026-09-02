import { useMemo, useState } from "react";
import { Plus, Search, Filter, BookOpen, Trash2, Pencil, Sparkles } from "lucide-react";
import type { Trade, TradingRule } from "@/lib/types";
import { complianceScore } from "@/lib/stats";
import { formatCurrency, formatDateTimeET, formatDuration } from "@/lib/format";
import { PnlBadge, DirectionBadge, ComplianceRing } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";

interface TradeListProps {
  trades: Trade[];
  rules: TradingRule[];
  onAddTrade: () => void;
  onEditTrade: (id: string) => void;
  onViewTrade: (id: string) => void;
  onDeleteTrade: (id: string) => void;
  onImportTrades: () => void;
  highlightIds?: string[] | null;
  onClearHighlight?: () => void;
}

type SortKey = "date" | "pnl" | "instrument";

export function TradeList({
  trades,
  rules,
  onAddTrade,
  onEditTrade,
  onViewTrade,
  onDeleteTrade,
  onImportTrades,
  highlightIds,
  onClearHighlight,
}: TradeListProps) {
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "long" | "short">("all");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "win" | "loss" | "open">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const filtered = useMemo(() => {
    let list = trades.filter((t) => {
      const matchesHighlight =
        !highlightIds || highlightIds.length === 0 || highlightIds.includes(t.id);
      const matchesSearch =
        !search ||
        t.instrument.toLowerCase().includes(search.toLowerCase()) ||
        (t.setup ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (t.notes ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesDir = dirFilter === "all" || t.direction === dirFilter;
      const net = Number(t.pnl ?? 0) - Number(t.fees ?? 0);
      const matchesOutcome =
        outcomeFilter === "all" ||
        (outcomeFilter === "win" && t.exit_time && net > 0) ||
        (outcomeFilter === "loss" && t.exit_time && net < 0) ||
        (outcomeFilter === "open" && !t.exit_time);
      return matchesSearch && matchesDir && matchesOutcome && matchesHighlight;
    });

    list = list.sort((a, b) => {
      if (sortKey === "date") {
        return new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime();
      }
      if (sortKey === "pnl") {
        return Number(b.pnl ?? 0) - Number(a.pnl ?? 0);
      }
      return a.instrument.localeCompare(b.instrument);
    });

    return list;
  }, [trades, search, dirFilter, outcomeFilter, sortKey, highlightIds]);

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <EmptyState
          icon={<BookOpen size={28} />}
          title="Your trade journal is empty"
          description="This is where every trade you take gets logged with its setup, P&L, emotions, screenshots, and rule compliance. Your journal is the foundation for every other feature in EdgePilot — analytics, AI coaching, discipline tracking, and edge discovery all read from it."
          action={
            <button
              onClick={onAddTrade}
              className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
            >
              <Plus size={18} /> Log a trade
            </button>
          }
          secondaryAction={
            <button
              onClick={onImportTrades}
              className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-5 py-2.5 text-sm font-semibold text-base-200 transition-colors hover:bg-base-700"
            >
              <Sparkles size={16} /> Try Demo Data
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instrument, setup, notes..."
              className="w-full rounded-lg border border-base-700 bg-base-850 py-2 pl-9 pr-3 text-sm text-base-100 outline-none transition-colors focus:border-info-500 placeholder:text-base-500"
            />
          </div>
          <div className="flex gap-2">
            <FilterSelect
              value={dirFilter}
              onChange={(v) => setDirFilter(v as typeof dirFilter)}
              options={[
                { value: "all", label: "All directions" },
                { value: "long", label: "Long only" },
                { value: "short", label: "Short only" },
              ]}
            />
            <FilterSelect
              value={outcomeFilter}
              onChange={(v) => setOutcomeFilter(v as typeof outcomeFilter)}
              options={[
                { value: "all", label: "All outcomes" },
                { value: "win", label: "Winners" },
                { value: "loss", label: "Losers" },
                { value: "open", label: "Open trades" },
              ]}
            />
            <FilterSelect
              value={sortKey}
              onChange={(v) => setSortKey(v as SortKey)}
              options={[
                { value: "date", label: "Sort: Date" },
                { value: "pnl", label: "Sort: P&L" },
                { value: "instrument", label: "Sort: Instrument" },
              ]}
            />
          </div>
        </div>
        <button
          onClick={onAddTrade}
          className="flex items-center justify-center gap-2 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500"
        >
          <Plus size={18} /> Log Trade
        </button>
      </div>

      {/* Highlight banner */}
      {highlightIds && highlightIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-info-500/30 bg-info-500/10 px-4 py-2.5">
          <span className="text-sm text-info-400">
            Showing {filtered.length} supporting trade{filtered.length === 1 ? "" : "s"}
          </span>
          {onClearHighlight && (
            <button
              onClick={onClearHighlight}
              className="text-xs font-medium text-info-400 transition-colors hover:text-info-300"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-base-400">
        Showing {filtered.length} of {trades.length} trades
      </p>

      {/* Trade cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-700 bg-base-850/50 py-12 text-center text-sm text-base-400">
          No trades match your filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const net = Number(t.pnl ?? 0) - Number(t.fees ?? 0);
            const cs = complianceScore(t, rules);
            const isOpen = !t.exit_time;
            const holdMin =
              t.entry_time && t.exit_time
                ? (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000
                : null;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-4 rounded-xl border border-base-700 bg-base-850 px-4 py-3.5 transition-colors hover:border-base-600"
              >
                <button
                  onClick={() => onViewTrade(t.id)}
                  className="flex flex-1 items-center gap-4 text-left"
                >
                  {/* Direction indicator */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      t.direction === "long"
                        ? "bg-bull-500/15 text-bull-500"
                        : "bg-bear-500/15 text-bear-500"
                    }`}
                  >
                    {t.direction === "long" ? "L" : "S"}
                  </div>

                  {/* Core info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-base-50">{t.instrument}</span>
                      <DirectionBadge direction={t.direction} />
                      {isOpen && (
                        <span className="rounded border border-accent-500/30 bg-accent-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-400">
                          Open
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-base-400">
                      <span>{formatDateTimeET(t.entry_time)}</span>
                      {t.setup && <span>· {t.setup}</span>}
                      {holdMin !== null && <span>· {formatDuration(holdMin)}</span>}
                      <span className="tabular">
                        · Entry {Number(t.entry_price).toFixed(2)}
                        {t.exit_price && ` → ${Number(t.exit_price).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Compliance */}
                  {cs.total > 0 && (
                    <div className="hidden sm:block">
                      <ComplianceRing score={cs.score} size={36} />
                    </div>
                  )}

                  {/* P&L */}
                  <div className="flex-shrink-0 text-right">
                    {isOpen ? (
                      <span className="text-sm text-base-400">—</span>
                    ) : (
                      <PnlBadge value={net} />
                    )}
                    {t.fees > 0 && (
                      <div className="mt-0.5 text-[10px] text-base-500 tabular">
                        fees {formatCurrency(t.fees)}
                      </div>
                    )}
                  </div>
                </button>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onEditTrade(t.id)}
                    className="rounded-lg p-1.5 text-base-400 transition-colors hover:bg-base-700 hover:text-base-100"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDeleteTrade(t.id)}
                    className="rounded-lg p-1.5 text-base-400 transition-colors hover:bg-bear-600/20 hover:text-bear-500"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <Filter size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-base-700 bg-base-850 py-2 pl-8 pr-3 text-sm text-base-100 outline-none transition-colors focus:border-info-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
