import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Scale,
  Clock,
  Award,
  Flame,
  Sparkles,
  Calendar,
  BarChart3,
  Zap,
  Activity,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ExternalLink,
} from "lucide-react";
import type { Trade, TradingRule } from "@/lib/types";
import {
  computeStats,
  overallCompliance,
  complianceScore,
  computeTodayStats,
  computeWeeklyPnl,
  computeMonthlyPerformance,
  computeCurrentStreak,
} from "@/lib/stats";
import { generateInsights, demoInsights, type Insight } from "@/lib/insights";
import { getDemoTrades } from "@/lib/demoData";
import { formatCurrency, formatPercent, formatDuration } from "@/lib/format";
import { nyDateString } from "@/lib/timezone";
import { PnlBadge } from "@/components/Badges";

interface DashboardProps {
  trades: Trade[];
  rules: TradingRule[];
  onAddTrade: () => void;
  onViewTrade: (id: string) => void;
  onViewSupportingTrades?: (ids: string[]) => void;
}

export function Dashboard({ trades, rules, onAddTrade, onViewTrade, onViewSupportingTrades }: DashboardProps) {
  const hasRealData = trades.length > 0;

  // Use real data if available, otherwise demo data
  const effectiveTrades = hasRealData ? trades : getDemoTrades();
  const isDemo = !hasRealData;

  const stats = useMemo(() => computeStats(effectiveTrades), [effectiveTrades]);
  const todayStats = useMemo(() => computeTodayStats(effectiveTrades), [effectiveTrades]);
  const weeklyPnl = useMemo(() => computeWeeklyPnl(effectiveTrades, 8), [effectiveTrades]);
  const monthlyPerf = useMemo(
    () => computeMonthlyPerformance(effectiveTrades, 6),
    [effectiveTrades]
  );
  const streak = useMemo(() => computeCurrentStreak(effectiveTrades), [effectiveTrades]);
  const compliance = useMemo(
    () => overallCompliance(effectiveTrades, rules.length > 0 ? rules : getDemoRulesAsTrades()),
    [effectiveTrades, rules]
  );
  const insights = useMemo(
    () => (hasRealData ? generateInsights(effectiveTrades) : demoInsights()),
    [effectiveTrades, hasRealData]
  );

  const recentTrades = useMemo(
    () =>
      [...effectiveTrades]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [effectiveTrades]
  );

  // Equity curve
  const equityCurve = useMemo(() => {
    const closed = effectiveTrades
      .filter((t) => t.exit_time !== null)
      .sort(
        (a, b) =>
          new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime()
      );
    let cum = 0;
    return closed.map((t) => {
      cum += Number(t.pnl ?? 0) - Number(t.fees ?? 0);
      return { id: t.id, cum, date: t.exit_time! };
    });
  }, [effectiveTrades]);

  return (
    <div className="space-y-5">
      {isDemo && <DemoBanner onAddTrade={onAddTrade} />}

      {/* ===== ROW 1: Top metrics ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <TopMetric
          label="Today's Net P&L"
          value={formatCurrency(todayStats.netPnl, { sign: true })}
          sublabel={`${todayStats.tradeCount} ${todayStats.tradeCount === 1 ? "trade" : "trades"} today`}
          tone={todayStats.netPnl >= 0 ? "bull" : "bear"}
          icon={todayStats.netPnl >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        />
        <TopMetric
          label="Today's Win Rate"
          value={todayStats.tradeCount > 0 ? formatPercent(todayStats.winRate, 0) : "—"}
          sublabel={`${todayStats.wins}W / ${todayStats.losses}L`}
          tone={todayStats.winRate >= 50 ? "bull" : todayStats.tradeCount > 0 ? "bear" : "neutral"}
          icon={<Award size={18} />}
        />
        <TopMetric
          label="Today's R Multiple"
          value={`${todayStats.rMultiple >= 0 ? "+" : ""}${todayStats.rMultiple.toFixed(2)}R`}
          sublabel="Risk-adjusted"
          tone={todayStats.rMultiple >= 0 ? "bull" : "bear"}
          icon={<Zap size={18} />}
        />
        <TopMetric
          label="Current Streak"
          value={
            streak.type === "none"
              ? "—"
              : `${streak.value} ${streak.type === "winning" ? "W" : "L"}`
          }
          sublabel={streak.type === "winning" ? "Winning streak" : streak.type === "losing" ? "Losing streak" : "No streak"}
          tone={streak.type === "winning" ? "bull" : streak.type === "losing" ? "bear" : "neutral"}
          icon={<Flame size={18} />}
        />
        <TopMetric
          label="Rule Compliance"
          value={compliance > 0 ? formatPercent(compliance, 0) : "—"}
          sublabel="All scored trades"
          tone={compliance >= 80 ? "bull" : compliance >= 50 ? "accent" : compliance > 0 ? "bear" : "neutral"}
          icon={<Scale size={18} />}
          ringValue={compliance}
        />
      </div>

      {/* ===== ROW 2: Charts ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Equity curve — takes 2 cols */}
        <div className="lg:col-span-2">
          <EquityCurveCard data={equityCurve} isDemo={isDemo} />
        </div>
        {/* Weekly P&L */}
        <WeeklyPnlCard data={weeklyPnl} isDemo={isDemo} />
      </div>

      {/* Monthly performance summary — full width */}
      <MonthlyPerformanceCard data={monthlyPerf} isDemo={isDemo} />

      {/* ===== ROW 3: Core stats ===== */}
      <div>
        <SectionLabel>Performance Metrics</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <CompactMetric
            label="Profit Factor"
            value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
            tone={stats.profitFactor >= 1.5 ? "bull" : stats.profitFactor >= 1 ? "accent" : "bear"}
            icon={<Scale size={16} />}
          />
          <CompactMetric
            label="Expectancy"
            value={`${stats.expectancy >= 0 ? "+" : ""}${formatCurrency(stats.expectancy)}`}
            sublabel="per trade"
            tone={stats.expectancy >= 0 ? "bull" : "bear"}
            icon={<Target size={16} />}
          />
          <CompactMetric
            label="Avg Winner"
            value={formatCurrency(stats.avgWin, { sign: true })}
            tone="bull"
            icon={<TrendingUp size={16} />}
          />
          <CompactMetric
            label="Avg Loser"
            value={formatCurrency(stats.avgLoss)}
            tone="bear"
            icon={<TrendingDown size={16} />}
          />
          <CompactMetric
            label="Win Rate"
            value={formatPercent(stats.winRate, 0)}
            tone={stats.winRate >= 50 ? "bull" : "bear"}
            icon={<Award size={16} />}
          />
          <CompactMetric
            label="Avg Hold Time"
            value={formatDuration(stats.avgHoldMinutes)}
            icon={<Clock size={16} />}
          />
        </div>
      </div>

      {/* ===== ROW 4: AI Insights + Recent trades ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <InsightsCard insights={insights} isDemo={isDemo} onViewSupportingTrades={onViewSupportingTrades} />
        </div>
        <div className="lg:col-span-2">
          <RecentTradesCard trades={recentTrades} onViewTrade={onViewTrade} isDemo={isDemo} />
        </div>
      </div>
    </div>
  );
}

// Helper to get demo rules as TradingRule[] for compliance calc
function getDemoRulesAsTrades(): TradingRule[] {
  return [
    {
      id: "demo-rule-risk",
      name: "Define risk before entry",
      description: null,
      category: "risk",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-rule-revenge",
      name: "No revenge trading",
      description: null,
      category: "psychology",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-rule-trend",
      name: "Trade with the trend",
      description: null,
      category: "entry",
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
}

// ============ Demo banner ============

function DemoBanner({ onAddTrade }: { onAddTrade: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-info-500/30 bg-info-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-info-500/20 text-info-400">
          <Info size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-base-100">
            You're viewing demo data
          </p>
          <p className="text-xs text-base-400">
            This is what your command center looks like with real trades. Log your first trade to replace this.
          </p>
        </div>
      </div>
      <button
        onClick={onAddTrade}
        className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500"
      >
        <Plus size={16} /> Log your first trade
      </button>
    </div>
  );
}

// ============ Row 1: Top Metric Card ============

function TopMetric({
  label,
  value,
  sublabel,
  tone,
  icon,
  ringValue,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone: "bull" | "bear" | "neutral" | "accent";
  icon: React.ReactNode;
  ringValue?: number;
}) {
  const toneColor =
    tone === "bull"
      ? "text-bull-500"
      : tone === "bear"
        ? "text-bear-500"
        : tone === "accent"
          ? "text-accent-400"
          : "text-base-100";
  const iconColor =
    tone === "bull"
      ? "text-bull-500/70"
      : tone === "bear"
        ? "text-bear-500/70"
        : tone === "accent"
          ? "text-accent-400/70"
          : "text-base-500";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-base-700 bg-base-850 p-4 transition-all hover:border-base-600">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400 sm:text-xs">
          {label}
        </span>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {ringValue !== undefined && ringValue > 0 && (
          <MiniRing score={ringValue} />
        )}
        <span className={`text-xl font-bold tabular sm:text-2xl ${toneColor}`}>
          {value}
        </span>
      </div>
      {sublabel && (
        <div className="mt-1 text-[10px] text-base-400 sm:text-xs">{sublabel}</div>
      )}
    </div>
  );
}

function MiniRing({ score }: { score: number }) {
  const size = 28;
  const radius = (size - 4) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16c784" : score >= 50 ? "#f5a623" : "#ea3943";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#242e3e" strokeWidth={2.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
    </div>
  );
}

// ============ Row 2: Equity Curve ============

function EquityCurveCard({
  data,
  isDemo,
}: {
  data: { id: string; cum: number; date: string }[];
  isDemo: boolean;
}) {
  if (data.length < 2) {
    return (
      <div className="h-full rounded-xl border border-base-700 bg-base-850 p-5">
        <ChartHeader
          title="Equity Curve"
          subtitle={isDemo ? "Demo data" : "Cumulative net P&L"}
          value="—"
          valueTone="neutral"
        />
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          Need at least 2 closed trades
        </div>
      </div>
    );
  }

  const width = 800;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.cum);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xStep = innerW / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + innerH - ((d.cum - min) / range) * innerH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${
    padding.top + innerH
  } L ${points[0].x.toFixed(2)} ${padding.top + innerH} Z`;

  const zeroY = padding.top + innerH - ((0 - min) / range) * innerH;
  const lastCum = data[data.length - 1].cum;
  const positive = lastCum >= 0;
  const stroke = positive ? "#16c784" : "#ea3943";
  const fill = positive ? "rgba(22,199,132,0.10)" : "rgba(234,57,67,0.10)";

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => min + (range * i) / yTicks);

  return (
    <div className="h-full rounded-xl border border-base-700 bg-base-850 p-5">
      <ChartHeader
        title="Equity Curve"
        subtitle={isDemo ? "Demo data · cumulative net P&L" : "Cumulative net P&L"}
        value={`${positive ? "+" : ""}${formatCurrency(lastCum)}`}
        valueTone={positive ? "bull" : "bear"}
      />
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
        {tickValues.map((tv, i) => {
          const y = padding.top + innerH - ((tv - min) / range) * innerH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1a2230" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#6b7689" fontSize={11} className="tabular">
                {tv >= 0 ? "+" : ""}{Math.round(tv).toLocaleString()}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#364152" strokeWidth={1} strokeDasharray="4 4" />
        <path d={areaD} fill={fill} />
        <path d={pathD} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={4} fill={stroke} />
      </svg>
    </div>
  );
}

// ============ Row 2: Weekly P&L ============

function WeeklyPnlCard({
  data,
  isDemo,
}: {
  data: { label: string; pnl: number; tradeCount: number }[];
  isDemo: boolean;
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const totalPnl = data.reduce((s, d) => s + d.pnl, 0);

  return (
    <div className="h-full rounded-xl border border-base-700 bg-base-850 p-5">
      <ChartHeader
        title="Weekly P&L"
        subtitle={isDemo ? "Demo data · last 8 weeks" : "Last 8 weeks"}
        value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
        valueTone={totalPnl >= 0 ? "bull" : "bear"}
      />
      <div className="flex h-[200px] items-end justify-between gap-1.5 pt-2">
        {data.map((d, i) => {
          const h = (Math.abs(d.pnl) / maxAbs) * 100;
          const positive = d.pnl >= 0;
          return (
            <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[28px] rounded-t transition-all duration-300 ${
                    positive ? "bg-bull-500/60 group-hover:bg-bull-500" : "bg-bear-500/60 group-hover:bg-bear-500"
                  }`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute -top-8 hidden whitespace-nowrap rounded-md bg-base-900 px-2 py-1 text-[10px] font-medium text-base-100 shadow-lg group-hover:block z-10">
                  {positive ? "+" : ""}{formatCurrency(d.pnl)}
                </div>
              </div>
              <span className="text-[9px] text-base-500">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Monthly Performance ============

function MonthlyPerformanceCard({
  data,
  isDemo,
}: {
  data: {
    label: string;
    pnl: number;
    winRate: number;
    tradeCount: number;
    bestDay: number;
    worstDay: number;
  }[];
  isDemo: boolean;
}) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-base-400" />
          <h3 className="text-sm font-semibold text-base-200">Monthly Performance</h3>
          {isDemo && <span className="text-[10px] text-base-500">· demo</span>}
        </div>
        <span className="text-xs text-base-400">Last 6 months</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {data.map((m, i) => {
          const positive = m.pnl >= 0;
          return (
            <div
              key={i}
              className="rounded-lg border border-base-700 bg-base-800/50 p-3"
            >
              <div className="text-xs font-medium text-base-300">{m.label}</div>
              <div
                className={`mt-1 text-lg font-bold tabular ${
                  positive ? "text-bull-500" : "text-bear-500"
                }`}
              >
                {positive ? "+" : ""}{formatCurrency(m.pnl)}
              </div>
              <div className="mt-2 space-y-0.5 text-[10px] text-base-400">
                <div className="flex justify-between">
                  <span>Trades</span>
                  <span className="tabular text-base-300">{m.tradeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win rate</span>
                  <span className="tabular text-base-300">{formatPercent(m.winRate, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Best day</span>
                  <span className="tabular text-bull-500">+{formatCurrency(m.bestDay)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Worst day</span>
                  <span className="tabular text-bear-500">{formatCurrency(m.worstDay)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Row 3: Compact Metric ============

function CompactMetric({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "bull" | "bear" | "accent" | "neutral";
  icon: React.ReactNode;
}) {
  const toneColor =
    tone === "bull"
      ? "text-bull-500"
      : tone === "bear"
        ? "text-bear-500"
        : tone === "accent"
          ? "text-accent-400"
          : "text-base-100";
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-4 transition-colors hover:border-base-600">
      <div className="flex items-center gap-1.5 text-base-500">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400">
          {label}
        </span>
      </div>
      <div className={`mt-2 text-xl font-bold tabular ${toneColor}`}>{value}</div>
      {sublabel && <div className="mt-0.5 text-[10px] text-base-400">{sublabel}</div>}
    </div>
  );
}

// ============ Row 4: AI Insights Card ============

function InsightsCard({ insights, isDemo, onViewSupportingTrades }: { insights: Insight[]; isDemo: boolean; onViewSupportingTrades?: (ids: string[]) => void }) {
  return (
    <div className="h-full rounded-xl border border-base-700 bg-gradient-to-br from-base-850 to-base-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-500/15 text-info-400">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-base-200">Top Insights</h3>
            <p className="text-[10px] text-base-400">
              {isDemo ? "AI coach · demo analysis" : "AI coach · pattern analysis"}
            </p>
          </div>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-base-500">
          Log more trades to unlock AI insights
        </div>
      ) : (
        <div className="space-y-2.5">
          {insights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} onViewSupportingTrades={onViewSupportingTrades} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightRow({ insight, onViewSupportingTrades }: { insight: Insight; onViewSupportingTrades?: (ids: string[]) => void }) {
  const iconMap = {
    time: <Clock size={16} />,
    setup: <Target size={16} />,
    day: <Calendar size={16} />,
    behavior: <Activity size={16} />,
    risk: <Scale size={16} />,
    instrument: <BarChart3 size={16} />,
  };
  const impactIcon =
    insight.impact === "positive" ? (
      <ArrowUpRight size={14} className="text-bull-500" />
    ) : insight.impact === "negative" ? (
      <ArrowDownRight size={14} className="text-bear-500" />
    ) : (
      <Info size={14} className="text-base-400" />
    );
  const accentColor =
    insight.impact === "positive"
      ? "border-bull-500/20 bg-bull-500/5"
      : insight.impact === "negative"
        ? "border-bear-500/20 bg-bear-500/5"
        : "border-base-700 bg-base-800/50";
  const iconBg =
    insight.impact === "positive"
      ? "bg-bull-500/15 text-bull-500"
      : insight.impact === "negative"
        ? "bg-bear-500/15 text-bear-500"
        : "bg-base-700 text-base-300";

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-base-600 ${accentColor}`}>
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {iconMap[insight.category]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-base-100">{insight.title}</p>
          {impactIcon}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-base-400">{insight.detail}</p>
        {insight.metric && (
          <span className="mt-1.5 inline-block rounded border border-base-700 bg-base-900/60 px-2 py-0.5 text-[10px] font-semibold tabular text-base-300">
            {insight.metric}
          </span>
        )}
        {insight.supportingTradeIds && insight.supportingTradeIds.length > 0 && onViewSupportingTrades && (
          <button
            onClick={() => onViewSupportingTrades(insight.supportingTradeIds!)}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-info-400 transition-colors hover:text-info-300"
          >
            <ExternalLink size={11} />
            View {insight.supportingTradeIds.length} supporting trade{insight.supportingTradeIds.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Row 4: Recent Trades ============

function RecentTradesCard({
  trades,
  onViewTrade,
  isDemo,
}: {
  trades: Trade[];
  onViewTrade: (id: string) => void;
  isDemo: boolean;
}) {
  const demoRules = getDemoRulesAsTrades();
  return (
    <div className="h-full rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-200">Recent Trades</h3>
        <span className="text-[10px] text-base-400">
          {isDemo ? "demo" : `${trades.length} recent`}
        </span>
      </div>
      <div className="space-y-2">
        {trades.map((t) => {
          const net = Number(t.pnl ?? 0) - Number(t.fees ?? 0);
          const cs = complianceScore(t, isDemo ? demoRules : []);
          return (
            <button
              key={t.id}
              onClick={() => !isDemo && onViewTrade(t.id)}
              disabled={isDemo}
              className={`flex w-full items-center justify-between rounded-lg border border-base-700 bg-base-800/50 px-3 py-2.5 text-left transition-colors ${
                isDemo ? "cursor-default" : "hover:border-base-600 hover:bg-base-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ${
                    t.direction === "long"
                      ? "bg-bull-500/15 text-bull-500"
                      : "bg-bear-500/15 text-bear-500"
                  }`}
                >
                  {t.direction === "long" ? "L" : "S"}
                </div>
                <div>
                  <div className="text-xs font-medium text-base-100">{t.instrument}</div>
                  <div className="text-[10px] text-base-400">
                    {new Date(nyDateString(t.entry_time) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {t.setup ? ` · ${t.setup}` : ""}
                  </div>
                </div>
              </div>
              <PnlBadge value={net} size="sm" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ Shared chart header ============

function ChartHeader({
  title,
  subtitle,
  value,
  valueTone,
}: {
  title: string;
  subtitle: string;
  value: string;
  valueTone: "bull" | "bear" | "neutral";
}) {
  const valueColor =
    valueTone === "bull" ? "text-bull-500" : valueTone === "bear" ? "text-bear-500" : "text-base-100";
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h3 className="text-sm font-semibold text-base-200">{title}</h3>
        <p className="text-[10px] text-base-400">{subtitle}</p>
      </div>
      <span className={`text-sm font-bold tabular ${valueColor}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-base-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-base-800" />
    </div>
  );
}
