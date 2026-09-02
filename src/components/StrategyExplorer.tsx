import { useMemo, useState } from "react";
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Trophy,
  Target,
  Activity,
  Zap,
  BarChart3,
  Timer,
  PieChart,
  Download,
  Sparkles,
} from "lucide-react";
import type { Trade } from "@/lib/types";
import {
  computeStrategyStats,
  computeStrategyOverview,
  computeTimeOfDayStats,
  computeDayOfWeekStats,
  type StrategyStats,
} from "@/lib/strategy";
import { formatCurrency, formatPercent, formatDuration, formatNumber } from "@/lib/format";
import { getDemoTrades } from "@/lib/demoData";
import { EmptyState } from "@/components/EmptyState";

interface StrategyExplorerProps {
  trades: Trade[];
  onImportTrades: () => void;
}

export function StrategyExplorer({ trades, onImportTrades }: StrategyExplorerProps) {
  const hasRealData = trades.length > 0;
  const effectiveTrades = hasRealData ? trades : getDemoTrades();
  const isDemo = !hasRealData;

  const strategyStats = useMemo(
    () => computeStrategyStats(effectiveTrades),
    [effectiveTrades]
  );
  const overview = useMemo(
    () => computeStrategyOverview(effectiveTrades),
    [effectiveTrades]
  );
  const timeStats = useMemo(
    () => computeTimeOfDayStats(effectiveTrades),
    [effectiveTrades]
  );
  const dayStats = useMemo(
    () => computeDayOfWeekStats(effectiveTrades),
    [effectiveTrades]
  );

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  if (effectiveTrades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <EmptyState
          icon={<Crosshair size={28} />}
          title="No strategy data yet"
          description="This page breaks down your performance by strategy tag, time of day, and day of week — so you can see which setups actually make money and which drain your account. Tag your trades with strategies like 'Opening Range Breakout' or 'Liquidity Sweep' to unlock these analytics."
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
    <div className="space-y-5">
      {isDemo && <DemoBanner />}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Crosshair size={20} className="text-info-400" />
          <h2 className="text-lg font-semibold text-base-50">Strategy Explorer</h2>
        </div>
        <p className="text-sm text-base-400">
          Performance breakdown by strategy tag, time of day, and day of week
        </p>
      </div>

      {/* ===== ROW 1: Overview KPIs ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Tagged Trades"
          value={String(overview.totalTagged)}
          sublabel={`${overview.totalUntagged} untagged`}
          icon={<Target size={16} />}
        />
        <KpiCard
          label="Unique Strategies"
          value={String(overview.uniqueTags)}
          icon={<Crosshair size={16} />}
        />
        <KpiCard
          label="Largest Winner"
          value={formatCurrency(overview.largestWin, { sign: true })}
          tone="bull"
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Largest Loser"
          value={formatCurrency(overview.largestLoss)}
          tone="bear"
          icon={<TrendingDown size={16} />}
        />
        <KpiCard
          label="Avg Hold Time"
          value={formatDuration(overview.avgHoldMinutes)}
          icon={<Timer size={16} />}
        />
        <KpiCard
          label="Best Time of Day"
          value={overview.bestTimeOfDay?.label ?? "—"}
          sublabel={overview.bestTimeOfDay ? `${overview.bestTimeOfDay.trades} trades` : undefined}
          tone="bull"
          icon={<Clock size={16} />}
        />
        <KpiCard
          label="Best Day of Week"
          value={overview.bestDayOfWeek?.label ?? "—"}
          sublabel={overview.bestDayOfWeek ? `${overview.bestDayOfWeek.trades} trades` : undefined}
          tone="bull"
          icon={<Calendar size={16} />}
        />
      </div>

      {/* ===== ROW 2: Strategy Table + Win Rate Chart ===== */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Strategy Performance Table — 2 cols */}
        <div className="xl:col-span-2">
          <StrategyTable
            stats={strategyStats}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            isDemo={isDemo}
          />
        </div>

        {/* Win Rate by Strategy — donut/radial */}
        <div className="xl:col-span-1">
          <WinRateRadial stats={strategyStats} isDemo={isDemo} />
        </div>
      </div>

      {/* ===== ROW 3: Expectancy & Avg R by Strategy ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpectancyChart stats={strategyStats} isDemo={isDemo} />
        <AvgRChart stats={strategyStats} isDemo={isDemo} />
      </div>

      {/* ===== ROW 4: Time of Day + Day of Week ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeOfDayChart data={timeStats} isDemo={isDemo} />
        <DayOfWeekChart data={dayStats} isDemo={isDemo} />
      </div>

      {/* ===== ROW 5: P&L by Strategy (horizontal bars) ===== */}
      <PnlByStrategyChart stats={strategyStats} isDemo={isDemo} />
    </div>
  );
}

// ============ Demo Banner ============

function DemoBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/10 px-5 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-info-500/20 text-info-400">
        <Activity size={16} />
      </div>
      <p className="text-sm text-base-300">
        Showing demo data with sample strategy tags. Log trades and tag them with strategies to see your real analytics.
      </p>
    </div>
  );
}

// ============ KPI Card ============

function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "bull" | "bear" | "neutral";
  icon: React.ReactNode;
}) {
  const toneColor =
    tone === "bull" ? "text-bull-500" : tone === "bear" ? "text-bear-500" : "text-base-100";
  const iconColor =
    tone === "bull" ? "text-bull-500/70" : tone === "bear" ? "text-bear-500/70" : "text-base-500";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-base-700 bg-base-850 p-4 transition-all hover:border-base-600">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400">
          {label}
        </span>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className={`mt-2 truncate text-base font-bold tabular sm:text-lg ${toneColor}`}>
        {value}
      </div>
      {sublabel && <div className="mt-0.5 truncate text-[10px] text-base-400">{sublabel}</div>}
    </div>
  );
}

// ============ Section Panel ============

function Panel({
  title,
  subtitle,
  icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base-400">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-base-200">{title}</h3>
            {subtitle && <p className="text-[10px] text-base-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ============ Strategy Performance Table ============

function StrategyTable({
  stats,
  selectedTag,
  onSelectTag,
  isDemo,
}: {
  stats: StrategyStats[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isDemo: boolean;
}) {
  if (stats.length === 0) {
    return (
      <Panel
        title="Strategy Performance"
        subtitle={isDemo ? "Demo data" : "Win rate, avg R, and expectancy by tag"}
        icon={<BarChart3 size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          Tag trades with strategies to see breakdown
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Strategy Performance"
      subtitle={isDemo ? "Demo data · click a row to highlight" : "Click a row to highlight"}
      icon={<BarChart3 size={16} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-700 text-[10px] uppercase tracking-wider text-base-400">
              <th className="pb-2 pr-3 text-left font-semibold">Strategy</th>
              <th className="pb-2 px-2 text-right font-semibold">Trades</th>
              <th className="pb-2 px-2 text-right font-semibold">Win Rate</th>
              <th className="pb-2 px-2 text-right font-semibold">Avg R</th>
              <th className="pb-2 px-2 text-right font-semibold">Expectancy</th>
              <th className="pb-2 pl-2 text-right font-semibold">Net P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-800">
            {stats.map((s) => {
              const isSelected = selectedTag === s.tag;
              return (
                <tr
                  key={s.tag}
                  onClick={() => onSelectTag(isSelected ? null : s.tag)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-info-500/10"
                      : "hover:bg-base-800/50"
                  }`}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tagColor(s.tag) }}
                      />
                      <span className="font-medium text-base-100">{s.tag}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular text-base-300">{s.trades}</td>
                  <td className="py-2.5 px-2 text-right">
                    <span
                      className={`tabular font-medium ${
                        s.winRate >= 50 ? "text-bull-500" : "text-bear-500"
                      }`}
                    >
                      {formatPercent(s.winRate, 0)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {(() => {
                      const avgR = s.avgR;
                      if (avgR === null) {
                        return (
                          <span className="tabular text-[10px] text-base-500" title="R-multiple unavailable -- contract specifications for this instrument have not been configured.">
                            N/A
                          </span>
                        );
                      }
                      return (
                        <span
                          className={`tabular font-medium ${
                            avgR >= 0 ? "text-bull-500" : "text-bear-500"
                          }`}
                        >
                          {avgR >= 0 ? "+" : ""}
                          {formatNumber(avgR, 2)}R
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span
                      className={`tabular font-medium ${
                        s.expectancy >= 0 ? "text-bull-500" : "text-bear-500"
                      }`}
                    >
                      {s.expectancy >= 0 ? "+" : ""}
                      {formatCurrency(s.expectancy)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <span
                      className={`tabular font-semibold ${
                        s.totalPnl >= 0 ? "text-bull-500" : "text-bear-500"
                      }`}
                    >
                      {s.totalPnl >= 0 ? "+" : ""}
                      {formatCurrency(s.totalPnl)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected strategy detail */}
      {selectedTag && (() => {
        const s = stats.find((x) => x.tag === selectedTag);
        if (!s) return null;
        return (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-info-500/20 bg-info-500/5 p-4 sm:grid-cols-4">
            <DetailStat label="Wins" value={String(s.wins)} tone="bull" />
            <DetailStat label="Losses" value={String(s.losses)} tone="bear" />
            <DetailStat label="Avg Win" value={formatCurrency(s.avgWin, { sign: true })} tone="bull" />
            <DetailStat label="Avg Loss" value={formatCurrency(s.avgLoss)} tone="bear" />
            <DetailStat label="Largest Win" value={formatCurrency(s.largestWin, { sign: true })} tone="bull" />
            <DetailStat label="Largest Loss" value={formatCurrency(s.largestLoss)} tone="bear" />
            <DetailStat label="Avg Hold" value={formatDuration(s.avgHoldMinutes)} />
            <DetailStat label="Win/Loss Ratio" value={s.avgLoss > 0 ? formatNumber(s.avgWin / s.avgLoss, 2) : "—"} />
          </div>
        );
      })()}
    </Panel>
  );
}

function DetailStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear" | "neutral";
}) {
  const color =
    tone === "bull" ? "text-bull-500" : tone === "bear" ? "text-bear-500" : "text-base-100";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-base-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular ${color}`}>{value}</p>
    </div>
  );
}

// ============ Win Rate Radial (donut chart) ============

function WinRateRadial({
  stats,
  isDemo,
}: {
  stats: StrategyStats[];
  isDemo: boolean;
}) {
  if (stats.length === 0) {
    return (
      <Panel
        title="Win Rate by Strategy"
        subtitle={isDemo ? "Demo data" : "Distribution"}
        icon={<PieChart size={16} />}
      >
        <div className="flex h-[220px] items-center justify-center text-sm text-base-500">
          No tagged trades
        </div>
      </Panel>
    );
  }

  const size = 200;
  const radius = 70;
  const innerRadius = 48;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Each strategy gets a segment proportional to its trade count,
  // colored by win rate.
  const totalTrades = stats.reduce((s, x) => s + x.trades, 0);

  let offset = 0;
  const segments = stats.map((s) => {
    const fraction = s.trades / totalTrades;
    const dashLength = fraction * circumference;
    const seg = {
      tag: s.tag,
      winRate: s.winRate,
      dashLength,
      dashOffset: offset,
      color: winRateColor(s.winRate),
    };
    offset += dashLength;
    return seg;
  });

  const overallWinRate = stats.reduce((s, x) => s + x.wins, 0) / totalTrades * 100;

  return (
    <Panel
      title="Win Rate by Strategy"
      subtitle={isDemo ? "Demo data · segment size = trade count" : "Segment size = trade count"}
      icon={<PieChart size={16} />}
    >
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="max-w-full">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={radius - innerRadius}
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={-seg.dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
            />
          ))}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fill="#e3e6eb"
            fontSize={22}
            fontWeight="bold"
            className="tabular"
          >
            {formatPercent(overallWinRate, 0)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7689" fontSize={10}>
            Overall Win Rate
          </text>
        </svg>
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {stats.map((s) => (
            <div key={s.tag} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: winRateColor(s.winRate) }}
              />
              <span className="text-[10px] text-base-300">{s.tag}</span>
              <span className="text-[10px] font-semibold tabular text-base-400">
                {formatPercent(s.winRate, 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ============ Expectancy by Strategy (horizontal bar chart) ============

function ExpectancyChart({
  stats,
  isDemo,
}: {
  stats: StrategyStats[];
  isDemo: boolean;
}) {
  if (stats.length === 0) {
    return (
      <Panel
        title="Expectancy by Strategy"
        subtitle={isDemo ? "Demo data" : "Per-trade expectancy"}
        icon={<Target size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          No tagged trades
        </div>
      </Panel>
    );
  }

  const maxAbs = Math.max(...stats.map((s) => Math.abs(s.expectancy)), 1);

  return (
    <Panel
      title="Expectancy by Strategy"
      subtitle={isDemo ? "Demo data · per-trade $ expectancy" : "Per-trade $ expectancy"}
      icon={<Target size={16} />}
    >
      <div className="space-y-2.5">
        {stats.map((s) => {
          const pct = (Math.abs(s.expectancy) / maxAbs) * 50;
          const positive = s.expectancy >= 0;
          return (
            <div key={s.tag} className="group flex items-center gap-3">
              <span className="w-32 flex-shrink-0 truncate text-xs font-medium text-base-200">
                {s.tag}
              </span>
              <div className="relative h-7 flex-1 overflow-hidden rounded bg-base-800">
                <div className="absolute left-1/2 top-0 h-full w-px bg-base-600" />
                <div
                  className={`absolute top-0 h-full rounded transition-all duration-300 ${
                    positive
                      ? "left-1/2 bg-bull-500/60 group-hover:bg-bull-500"
                      : "right-1/2 bg-bear-500/60 group-hover:bg-bear-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`w-20 flex-shrink-0 text-right text-xs font-semibold tabular ${
                  positive ? "text-bull-500" : "text-bear-500"
                }`}
              >
                {positive ? "+" : ""}
                {formatCurrency(s.expectancy)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ============ Avg R by Strategy (horizontal bar chart) ============

function AvgRChart({
  stats,
  isDemo,
}: {
  stats: StrategyStats[];
  isDemo: boolean;
}) {
  if (stats.length === 0) {
    return (
      <Panel
        title="Average R by Strategy"
        subtitle={isDemo ? "Demo data" : "Risk multiple per trade"}
        icon={<Zap size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          No tagged trades
        </div>
      </Panel>
    );
  }

  const validRs = stats.map((s) => s.avgR).filter((r): r is number => r !== null);
  const maxAbs = Math.max(...validRs.map(Math.abs), 0.5);

  return (
    <Panel
      title="Average R by Strategy"
      subtitle={isDemo ? "Demo data · R multiple per trade" : "R multiple per trade"}
      icon={<Zap size={16} />}
    >
      <div className="space-y-2.5">
        {stats.map((s) => {
          if (s.avgR === null) {
            return (
              <div key={s.tag} className="group flex items-center gap-3">
                <span className="w-32 flex-shrink-0 truncate text-xs font-medium text-base-200">
                  {s.tag}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded bg-base-800" />
                <span
                  className="w-16 flex-shrink-0 text-right text-[10px] font-medium text-base-500"
                  title="R-multiple unavailable — contract specifications for this instrument have not been configured."
                >
                  N/A
                </span>
              </div>
            );
          }
          const pct = (Math.abs(s.avgR) / maxAbs) * 50;
          const positive = s.avgR >= 0;
          return (
            <div key={s.tag} className="group flex items-center gap-3">
              <span className="w-32 flex-shrink-0 truncate text-xs font-medium text-base-200">
                {s.tag}
              </span>
              <div className="relative h-7 flex-1 overflow-hidden rounded bg-base-800">
                <div className="absolute left-1/2 top-0 h-full w-px bg-base-600" />
                <div
                  className={`absolute top-0 h-full rounded transition-all duration-300 ${
                    positive
                      ? "left-1/2 bg-info-500/60 group-hover:bg-info-500"
                      : "right-1/2 bg-accent-500/60 group-hover:bg-accent-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`w-16 flex-shrink-0 text-right text-xs font-semibold tabular ${
                  positive ? "text-info-400" : "text-accent-400"
                }`}
              >
                {positive ? "+" : ""}
                {formatNumber(s.avgR, 2)}R
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ============ Time of Day Chart ============

function TimeOfDayChart({
  data,
  isDemo,
}: {
  data: ReturnType<typeof computeTimeOfDayStats>;
  isDemo: boolean;
}) {
  if (data.length === 0) {
    return (
      <Panel
        title="Performance by Time of Day"
        subtitle={isDemo ? "Demo data" : "Win rate & P&L by entry hour"}
        icon={<Clock size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          No closed trades
        </div>
      </Panel>
    );
  }

  const width = 600;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.totalPnl)), 1);
  const barWidth = innerW / data.length;
  const zeroY = padding.top + innerH / 2;
  const scale = (innerH / 2) / maxAbs;

  const bestHour = [...data].sort((a, b) => b.avgPnl - a.avgPnl)[0];

  return (
    <Panel
      title="Performance by Time of Day"
      subtitle={isDemo ? "Demo data · net P&L by entry hour" : "Net P&L by entry hour"}
      icon={<Clock size={16} />}
      action={
        bestHour && (
          <div className="flex items-center gap-1.5 rounded-lg bg-bull-500/10 px-2.5 py-1">
            <Trophy size={12} className="text-bull-500" />
            <span className="text-[10px] font-semibold text-bull-500">
              Best: {bestHour.label}
            </span>
          </div>
        )
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 240 }}>
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="#364152"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {data.map((d, i) => {
          const x = padding.left + i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          const barH = Math.abs(d.totalPnl) * scale;
          const y = d.totalPnl >= 0 ? zeroY - barH : zeroY;
          const color = d.totalPnl >= 0 ? "#16c784" : "#ea3943";
          return (
            <g key={i} className="group">
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(barH, 2)}
                fill={color}
                fillOpacity={0.6}
                rx={2}
                className="transition-all group-hover:fill-opacity-100"
                style={{ transition: "fill-opacity 0.2s" }}
              />
              <text
                x={x + w / 2}
                y={padding.top + innerH + 18}
                textAnchor="middle"
                fill="#6b7689"
                fontSize={9}
              >
                {d.hour}:00
              </text>
              <title>{`${d.label}: ${d.trades} trades, ${formatCurrency(d.totalPnl, { sign: true })}`}</title>
            </g>
          );
        })}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#6b7689" fontSize={10}>
          +{Math.round(maxAbs).toLocaleString()}
        </text>
        <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" fill="#6b7689" fontSize={10}>
          0
        </text>
        <text x={padding.left - 8} y={padding.top + innerH} textAnchor="end" fill="#6b7689" fontSize={10}>
          -{Math.round(maxAbs).toLocaleString()}
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-base-400">
        <div className="rounded-lg border border-base-700 bg-base-800/50 p-2">
          <span className="text-base-500">Peak hour: </span>
          <span className="font-semibold text-base-200">{bestHour?.label}</span>
        </div>
        <div className="rounded-lg border border-base-700 bg-base-800/50 p-2">
          <span className="text-base-500">Trades at peak: </span>
          <span className="font-semibold tabular text-base-200">{bestHour?.trades ?? 0}</span>
        </div>
        <div className="rounded-lg border border-base-700 bg-base-800/50 p-2">
          <span className="text-base-500">Win rate: </span>
          <span className="font-semibold tabular text-base-200">
            {bestHour ? formatPercent(bestHour.winRate, 0) : "—"}
          </span>
        </div>
      </div>
    </Panel>
  );
}

// ============ Day of Week Chart ============

function DayOfWeekChart({
  data,
  isDemo,
}: {
  data: ReturnType<typeof computeDayOfWeekStats>;
  isDemo: boolean;
}) {
  if (data.length === 0) {
    return (
      <Panel
        title="Performance by Day of Week"
        subtitle={isDemo ? "Demo data" : "Win rate & P&L by day"}
        icon={<Calendar size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          No closed trades
        </div>
      </Panel>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.totalPnl)), 1);
  const bestDay = [...data].sort((a, b) => b.avgPnl - a.avgPnl)[0];

  return (
    <Panel
      title="Performance by Day of Week"
      subtitle={isDemo ? "Demo data · net P&L by weekday" : "Net P&L by weekday"}
      icon={<Calendar size={16} />}
      action={
        bestDay && (
          <div className="flex items-center gap-1.5 rounded-lg bg-bull-500/10 px-2.5 py-1">
            <Trophy size={12} className="text-bull-500" />
            <span className="text-[10px] font-semibold text-bull-500">
              Best: {bestDay.label}
            </span>
          </div>
        )
      }
    >
      <div className="flex h-[200px] items-end justify-between gap-3 pt-2">
        {data.map((d, i) => {
          const h = (Math.abs(d.totalPnl) / maxAbs) * 100;
          const positive = d.totalPnl >= 0;
          return (
            <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`text-[10px] font-semibold tabular ${
                  positive ? "text-bull-500" : "text-bear-500"
                }`}
              >
                {positive ? "+" : ""}
                {formatCurrency(d.totalPnl)}
              </span>
              <div className="relative flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[40px] rounded-t transition-all duration-300 ${
                    positive
                      ? "bg-bull-500/60 group-hover:bg-bull-500"
                      : "bg-bear-500/60 group-hover:bg-bear-500"
                  }`}
                  style={{ height: `${Math.max(h, 3)}%` }}
                />
                <div className="absolute -top-9 hidden whitespace-nowrap rounded-md bg-base-900 px-2 py-1 text-[10px] font-medium text-base-100 shadow-lg group-hover:block z-10">
                  {d.trades} trades · {formatPercent(d.winRate, 0)} win
                </div>
              </div>
              <span className="text-[10px] font-medium text-base-300">{d.label.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ============ P&L by Strategy (horizontal bar) ============

function PnlByStrategyChart({
  stats,
  isDemo,
}: {
  stats: StrategyStats[];
  isDemo: boolean;
}) {
  if (stats.length === 0) {
    return (
      <Panel
        title="Net P&L by Strategy"
        subtitle={isDemo ? "Demo data" : "Total net P&L"}
        icon={<TrendingUp size={16} />}
      >
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          No tagged trades
        </div>
      </Panel>
    );
  }

  const sorted = [...stats].sort((a, b) => b.totalPnl - a.totalPnl);
  const maxAbs = Math.max(...sorted.map((s) => Math.abs(s.totalPnl)), 1);

  return (
    <Panel
      title="Net P&L by Strategy"
      subtitle={isDemo ? "Demo data · total net P&L per tag" : "Total net P&L per tag"}
      icon={<TrendingUp size={16} />}
    >
      <div className="space-y-3">
        {sorted.map((s) => {
          const pct = (Math.abs(s.totalPnl) / maxAbs) * 100;
          const positive = s.totalPnl >= 0;
          return (
            <div key={s.tag} className="group">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tagColor(s.tag) }}
                  />
                  <span className="text-sm font-medium text-base-200">{s.tag}</span>
                  <span className="text-[10px] text-base-500">
                    {s.trades}t · {formatPercent(s.winRate, 0)} win
                  </span>
                </div>
                <span
                  className={`text-sm font-bold tabular ${
                    positive ? "text-bull-500" : "text-bear-500"
                  }`}
                >
                  {positive ? "+" : ""}
                  {formatCurrency(s.totalPnl)}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-base-800">
                <div
                  className={`absolute top-0 h-full rounded-full transition-all duration-500 ${
                    positive ? "left-0 bg-bull-500/60 group-hover:bg-bull-500" : "right-0 bg-bear-500/60 group-hover:bg-bear-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ============ Color helpers ============

const TAG_COLORS = [
  "#38bdf8", // info
  "#16c784", // bull
  "#f5a623", // accent
  "#ea3943", // bear
  "#a78bfa", // purple-ish
  "#fb923c", // orange
  "#34d399", // emerald
  "#f472b6", // pink
  "#60a5fa", // blue
  "#facc15", // yellow
  "#94a3b8", // slate
  "#c084fc", // violet
  "#22d3ee", // cyan
  "#fbbf24", // amber
  "#a3e635", // lime
];

const tagColorCache = new Map<string, string>();
let tagColorIndex = 0;

function tagColor(tag: string): string {
  if (!tagColorCache.has(tag)) {
    tagColorCache.set(tag, TAG_COLORS[tagColorIndex % TAG_COLORS.length]);
    tagColorIndex++;
  }
  return tagColorCache.get(tag)!;
}

function winRateColor(winRate: number): string {
  if (winRate >= 60) return "#16c784";
  if (winRate >= 50) return "#22d3ee";
  if (winRate >= 40) return "#f5a623";
  return "#ea3943";
}
