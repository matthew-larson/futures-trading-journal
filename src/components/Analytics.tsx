import { useMemo } from "react";
import { BarChart3, TrendingUp, Clock, Shield, Download, Sparkles } from "lucide-react";
import type { Trade, TradingRule } from "@/lib/types";
import {
  computeStats,
  ruleBreakdown,
  complianceScore,
} from "@/lib/stats";
import { formatCurrency, formatPercent, formatDuration } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

interface AnalyticsProps {
  trades: Trade[];
  rules: TradingRule[];
  onImportTrades: () => void;
}

export function Analytics({ trades, rules, onImportTrades }: AnalyticsProps) {
  const stats = useMemo(() => computeStats(trades), [trades]);
  const breakdown = useMemo(() => ruleBreakdown(trades, rules), [trades, rules]);

  // P&L by instrument
  const byInstrument = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const t of trades) {
      if (!t.exit_time) continue;
      const net = Number(t.pnl ?? 0) - Number(t.fees ?? 0);
      const e = map.get(t.instrument) ?? { pnl: 0, count: 0, wins: 0 };
      e.pnl += net;
      e.count += 1;
      if (net > 0) e.wins += 1;
      map.set(t.instrument, e);
    }
    return Array.from(map.entries())
      .map(([instrument, v]) => ({ instrument, ...v }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // P&L by session
  const bySession = useMemo(() => {
    const sessions = ["asian", "london", "new_york", "overnight"] as const;
    return sessions
      .map((s) => {
        const sessionTrades = trades.filter(
          (t) => t.exit_time && t.market_session === s
        );
        const pnl = sessionTrades.reduce(
          (sum, t) => sum + (Number(t.pnl ?? 0) - Number(t.fees ?? 0)),
          0
        );
        const wins = sessionTrades.filter(
          (t) => Number(t.pnl ?? 0) - Number(t.fees ?? 0) > 0
        ).length;
        return {
          session: s,
          label: s.charAt(0).toUpperCase() + s.slice(1).replace("_", " "),
          pnl,
          count: sessionTrades.length,
          wins,
          winRate: sessionTrades.length ? (wins / sessionTrades.length) * 100 : 0,
        };
      })
      .filter((s) => s.count > 0);
  }, [trades]);

  // P&L by setup
  const bySetup = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const t of trades) {
      if (!t.exit_time || !t.setup) continue;
      const net = Number(t.pnl ?? 0) - Number(t.fees ?? 0);
      const e = map.get(t.setup) ?? { pnl: 0, count: 0, wins: 0 };
      e.pnl += net;
      e.count += 1;
      if (net > 0) e.wins += 1;
      map.set(t.setup, e);
    }
    return Array.from(map.entries())
      .map(([setup, v]) => ({ setup, ...v }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // Win/loss distribution
  const distribution = useMemo(() => {
    const closed = trades.filter((t) => t.exit_time);
    const pnls = closed.map((t) => Number(t.pnl ?? 0) - Number(t.fees ?? 0));
    const buckets = [
      { label: "< -$500", min: -Infinity, max: -500, count: 0 },
      { label: "-$500 to -$200", min: -500, max: -200, count: 0 },
      { label: "-$200 to $0", min: -200, max: 0, count: 0 },
      { label: "$0 to $200", min: 0, max: 200, count: 0 },
      { label: "$200 to $500", min: 200, max: 500, count: 0 },
      { label: "> $500", min: 500, max: Infinity, count: 0 },
    ];
    for (const p of pnls) {
      for (const b of buckets) {
        if (p >= b.min && p < b.max) {
          b.count++;
          break;
        }
      }
    }
    // Edge: exactly 0 goes in "0 to 200"; exactly max boundaries handled by >=
    return buckets;
  }, [trades]);

  const maxBucket = Math.max(...distribution.map((b) => b.count), 1);

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <EmptyState
          icon={<BarChart3 size={28} />}
          title="No analytics yet"
          description="This page breaks down your P&L by instrument, session, setup, and rule compliance — so you can see exactly where your edge comes from and where it leaks away. Import or log at least a few trades to unlock these insights."
          action={
            <button
              onClick={onImportTrades}
              className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
            >
              <Download size={16} /> Import My Trades
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-base-50">Analytics</h2>
        <p className="text-sm text-base-400">Deep dive into your trading performance</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Total Trades" value={String(stats.totalTrades)} />
        <Metric
          label="Win Rate"
          value={formatPercent(stats.winRate)}
          tone={stats.winRate >= 50 ? "bull" : "bear"}
        />
        <Metric
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
          tone={stats.profitFactor >= 1.5 ? "bull" : "bear"}
        />
        <Metric
          label="Expectancy"
          value={`${stats.expectancy >= 0 ? "+" : ""}${formatCurrency(stats.expectancy)}`}
          tone={stats.expectancy >= 0 ? "bull" : "bear"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* P&L by Instrument */}
        <Panel title="P&L by Instrument" icon={<TrendingUp size={16} />}>
          {byInstrument.length === 0 ? (
            <EmptyHint text="No closed trades yet" />
          ) : (
            <div className="space-y-2">
              {byInstrument.map((d) => {
                const max = Math.max(...byInstrument.map((x) => Math.abs(x.pnl)), 1);
                const pct = (Math.abs(d.pnl) / max) * 100;
                return (
                  <div key={d.instrument} className="flex items-center gap-3">
                    <span className="w-12 flex-shrink-0 text-sm font-medium text-base-200">
                      {d.instrument}
                    </span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded bg-base-800">
                      <div
                        className={`absolute top-0 h-full rounded ${
                          d.pnl >= 0 ? "left-1/2 bg-bull-500/60" : "right-1/2 bg-bear-500/60"
                        }`}
                        style={{ width: `${pct / 2}%` }}
                      />
                      <div className="absolute left-1/2 top-0 h-full w-px bg-base-600" />
                    </div>
                    <span
                      className={`w-20 flex-shrink-0 text-right text-sm font-semibold tabular ${
                        d.pnl >= 0 ? "text-bull-500" : "text-bear-500"
                      }`}
                    >
                      {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl)}
                    </span>
                    <span className="hidden w-12 flex-shrink-0 text-right text-xs text-base-400 sm:block">
                      {d.count}t
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* P&L by Session */}
        <Panel title="P&L by Session" icon={<Clock size={16} />}>
          {bySession.length === 0 ? (
            <EmptyHint text="No sessions tagged yet" />
          ) : (
            <div className="space-y-3">
              {bySession.map((s) => (
                <div
                  key={s.session}
                  className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/50 px-4 py-2.5"
                >
                  <div>
                    <span className="text-sm font-medium text-base-100">{s.label}</span>
                    <span className="ml-2 text-xs text-base-400">
                      {s.count} trades · {formatPercent(s.winRate, 0)} win
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular ${
                      s.pnl >= 0 ? "text-bull-500" : "text-bear-500"
                    }`}
                  >
                    {s.pnl >= 0 ? "+" : ""}{formatCurrency(s.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* P&L by Setup */}
        <Panel title="P&L by Setup" icon={<TrendingUp size={16} />}>
          {bySetup.length === 0 ? (
            <EmptyHint text="No setups tagged yet" />
          ) : (
            <div className="space-y-2">
              {bySetup.map((d) => (
                <div
                  key={d.setup}
                  className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/50 px-4 py-2.5"
                >
                  <div>
                    <span className="text-sm font-medium text-base-100">{d.setup}</span>
                    <span className="ml-2 text-xs text-base-400">
                      {d.count} trades · {formatPercent((d.wins / d.count) * 100, 0)} win
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular ${
                      d.pnl >= 0 ? "text-bull-500" : "text-bear-500"
                    }`}
                  >
                    {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* P&L Distribution */}
        <Panel title="P&L Distribution" icon={<BarChart3 size={16} />}>
          <div className="space-y-1.5">
            {distribution.map((b) => {
              const isWin = b.min >= 0;
              const h = (b.count / maxBucket) * 100;
              return (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-28 flex-shrink-0 text-xs text-base-400">{b.label}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-base-800">
                    <div
                      className={`absolute top-0 h-full rounded ${
                        isWin ? "left-0 bg-bull-500/50" : "left-0 bg-bear-500/50"
                      }`}
                      style={{ width: `${h}%` }}
                    />
                  </div>
                  <span className="w-8 flex-shrink-0 text-right text-xs font-medium tabular text-base-300">
                    {b.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Rule compliance breakdown */}
      <Panel title="Rule Compliance Breakdown" icon={<Shield size={16} />}>
        {breakddownHasData(breakdown) ? (
          <div className="space-y-3">
            {breakdown
              .filter((b) => b.total > 0)
              .sort((a, b) => b.violated - a.violated || b.total - a.total)
              .map((b) => {
                const compliancePct = b.total > 0 ? (b.followed / b.total) * 100 : 0;
                return (
                  <div key={b.rule.id} className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-base-100">{b.rule.name}</span>
                        <span className="ml-2 text-xs text-base-400">({b.rule.category})</span>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular ${
                          compliancePct >= 80
                            ? "text-bull-500"
                            : compliancePct >= 50
                              ? "text-accent-400"
                              : "text-bear-500"
                        }`}
                      >
                        {formatPercent(compliancePct, 0)}
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-base-800">
                      <div
                        className="bg-bull-500/70"
                        style={{ width: `${compliancePct}%` }}
                      />
                      <div
                        className="bg-bear-500/70"
                        style={{ width: `${100 - compliancePct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-base-400">
                      <span className="text-bull-500">{b.followed} followed</span>
                      <span className="text-bear-500">{b.violated} violated</span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <EmptyHint text="Tag rule compliance on your trades to see breakdown" />
        )}
      </Panel>

      {/* Average compliance summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric
          label="Avg Hold Time"
          value={formatDuration(stats.avgHoldMinutes)}
        />
        <Metric
          label="Best Win Streak"
          value={`${stats.bestStreak} trades`}
          tone="bull"
        />
        <Metric
          label="Worst Loss Streak"
          value={`${stats.worstStreak} trades`}
          tone="bear"
        />
      </div>
    </div>
  );
}

function breakddownHasData(
  breakdown: ReturnType<typeof ruleBreakdown>
): boolean {
  return breakdown.some((b) => b.total > 0);
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "bull" | "bear";
}) {
  const color =
    tone === "bull"
      ? "text-bull-500"
      : tone === "bear"
        ? "text-bear-500"
        : "text-base-50";
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-base-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular ${color}`}>{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-200">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-base-500">{text}</div>
  );
}
