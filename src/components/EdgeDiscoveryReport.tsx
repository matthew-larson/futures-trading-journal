import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Trophy,
  AlertTriangle,
  Clock,
  Target,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Brain,
  BarChart3,
  Scale,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Rocket,
  Crosshair,
} from "lucide-react";
import type { Trade } from "@/lib/types";
import {
  generateEdgeReport,
  type EdgeReport,
  type MetricInsight,
} from "@/lib/edgeReport";

interface EdgeDiscoveryReportProps {
  trades: Trade[];
  onClose: () => void;
}

const ANALYSIS_STEPS = [
  { label: "Analyzing your trades...", icon: BarChart3 },
  { label: "Finding your strongest setups...", icon: Crosshair },
  { label: "Analyzing your best and worst trading windows...", icon: Clock },
  { label: "Looking for recurring mistakes...", icon: AlertTriangle },
  { label: "Measuring your discipline...", icon: CheckCircle2 },
  { label: "Finding patterns in your winners vs. losers...", icon: TrendingUp },
];

export function EdgeDiscoveryReport({ trades, onClose }: EdgeDiscoveryReportProps) {
  const [phase, setPhase] = useState<"analyzing" | "report">("analyzing");
  const [currentStep, setCurrentStep] = useState(0);
  const report = useMemo(() => generateEdgeReport(trades), [trades]);

  const advanceStep = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= ANALYSIS_STEPS.length - 1) {
        setPhase("report");
        return s;
      }
      return s + 1;
    });
  }, []);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setTimeout(advanceStep, 1100);
    return () => clearTimeout(timer);
  }, [phase, currentStep, advanceStep]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/95 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-info-500/5 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-bull-500/5 blur-3xl" />
        <div className="absolute left-1/3 top-0 h-72 w-72 rounded-full bg-accent-400/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-base-700 bg-base-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-base-400 transition-colors hover:bg-base-800 hover:text-base-200"
        >
          <X size={18} />
        </button>

        {phase === "analyzing" ? (
          <AnalyzingSequence currentStep={currentStep} totalTrades={report.totalTrades} />
        ) : (
          <ReportView report={report} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 1: Analyzing sequence                                         */
/* ------------------------------------------------------------------ */

function AnalyzingSequence({ currentStep, totalTrades }: { currentStep: number; totalTrades: number }) {
  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center px-8 py-16">
      <div className="relative mb-10">
        <div className="absolute inset-0 animate-ping rounded-full bg-info-500/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-info-500 to-info-600 shadow-lg shadow-info-500/30">
          <Brain size={36} className="text-white" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-base-50">Your Edge Discovery</h2>
      <p className="mt-1.5 text-sm text-base-400">
        Analyzing {totalTrades} trade{totalTrades === 1 ? "" : "s"} for statistically meaningful patterns
      </p>

      <div className="mt-10 w-full max-w-md space-y-2.5">
        {ANALYSIS_STEPS.map((step, i) => {
          const Icon = step.icon;
          const status = i < currentStep ? "done" : i === currentStep ? "active" : "pending";
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-500 ${
                status === "active"
                  ? "border-info-500/40 bg-info-500/10"
                  : status === "done"
                  ? "border-base-700/50 bg-base-850/50"
                  : "border-base-800/30 bg-base-900/30"
              }`}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                {status === "done" ? (
                  <CheckCircle2 size={18} className="text-bull-500" />
                ) : status === "active" ? (
                  <Icon size={18} className="text-info-400 animate-pulse" />
                ) : (
                  <Icon size={18} className="text-base-600" />
                )}
              </div>
              <span
                className={`text-sm transition-colors duration-500 ${
                  status === "active"
                    ? "font-medium text-base-50"
                    : status === "done"
                    ? "text-base-300"
                    : "text-base-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 2: Report view                                                */
/* ------------------------------------------------------------------ */

function ReportView({ report, onClose }: { report: EdgeReport; onClose: () => void }) {
  return (
    <div className="space-y-6 p-6 sm:p-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-base-700 bg-gradient-to-br from-base-850 via-base-850 to-base-900 p-6">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-info-500/8 blur-3xl" />
        <div className="absolute -left-8 -bottom-12 h-32 w-32 rounded-full bg-bull-500/8 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-base-50">Your Edge Report</h2>
            <p className="text-xs text-base-400">
              {report.totalTrades} trades analyzed ·{" "}
              {report.hasSufficientData ? "Statistically meaningful" : "Limited sample"}
            </p>
          </div>
        </div>
      </div>

      {/* Insufficient data notice */}
      {!report.hasSufficientData && report.insufficientNote && (
        <div className="flex items-start gap-3 rounded-xl border border-warn-500/30 bg-warn-500/10 p-4">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-warn-500" />
          <p className="text-sm leading-relaxed text-warn-500/90">{report.insufficientNote}</p>
        </div>
      )}

      {/* Best setup highlight */}
      {report.bestSetup && (
        <HighlightCard
          insight={report.bestSetup}
          title="Your Strongest Edge"
          icon={<Trophy size={18} />}
          accent="bull"
          prefix="Your strongest edge is"
        />
      )}

      {/* Grid: key metrics */}
      <div className="grid gap-4 lg:grid-cols-2">
        {report.worstSetup && (
          <MetricCard
            insight={report.worstSetup}
            title="Worst-Performing Setup"
            icon={<ArrowDownRight size={16} />}
            accent="bear"
          />
        )}
        {report.bestTime && (
          <MetricCard
            insight={report.bestTime}
            title="Best Trading Time"
            icon={<Clock size={16} />}
            accent="bull"
          />
        )}
        {report.worstTime && (
          <MetricCard
            insight={report.worstTime}
            title="Worst Trading Time"
            icon={<Clock size={16} />}
            accent="bear"
          />
        )}
        {report.bestInstrument && (
          <MetricCard
            insight={report.bestInstrument}
            title="Best Instrument"
            icon={<Activity size={16} />}
            accent="bull"
          />
        )}
        {report.bestDay && (
          <MetricCard
            insight={report.bestDay}
            title="Best Trading Day"
            icon={<Calendar size={16} />}
            accent="bull"
          />
        )}
        {report.worstDay && (
          <MetricCard
            insight={report.worstDay}
            title="Worst Trading Day"
            icon={<Calendar size={16} />}
            accent="bear"
          />
        )}
      </div>

      {/* Long vs Short */}
      {report.longVsShort && (
        <DirectionalCard data={report.longVsShort} />
      )}

      {/* Average winner vs loser */}
      {report.avgWinnerVsLoser && (
        <WinLossCard data={report.avgWinnerVsLoser} />
      )}

      {/* Most expensive mistake */}
      {report.mostExpensiveMistake && (
        <MistakeCard insight={report.mostExpensiveMistake} />
      )}

      {/* Rule compliance */}
      {report.ruleCompliance && (
        <RuleCard data={report.ruleCompliance} />
      )}

      {/* Biggest opportunity */}
      {report.biggestOpportunity && (
        <OpportunityCard insight={report.biggestOpportunity} />
      )}

      {/* #1 Focus */}
      {report.focus && (
        <FocusCard insight={report.focus} />
      )}

      {/* Close */}
      <div className="flex justify-center pt-2 pb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg bg-info-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
        >
          <CheckCircle2 size={16} />
          Got it — take me to my journal
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Highlight card (best setup)                                         */
/* ------------------------------------------------------------------ */

function HighlightCard({
  insight,
  title,
  icon,
  accent,
  prefix,
}: {
  insight: MetricInsight;
  title: string;
  icon: React.ReactNode;
  accent: "bull" | "bear";
  prefix: string;
}) {
  const colors = accent === "bull"
    ? { border: "border-bull-500/30", glow: "from-bull-500/10", text: "text-bull-500", bg: "bg-bull-500/10" }
    : { border: "border-bear-500/30", glow: "from-bear-500/10", text: "text-bear-500", bg: "bg-bear-500/10" };

  return (
    <div className={`relative overflow-hidden rounded-xl border ${colors.border} bg-gradient-to-br ${colors.glow} via-base-850 to-base-850 p-6`}>
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400">{title}</span>
      </div>
      <p className="mt-4 text-xl font-bold leading-snug text-base-50">
        {prefix} <span className={colors.text}>{insight.label}</span>.
      </p>
      <p className="mt-3 text-sm text-base-300">
        {insight.tradeCount} trades analyzed · {insight.winRate.toFixed(0)}% win rate ·{" "}
        <span className={insight.expectancy >= 0 ? "text-bull-500" : "text-bear-500"}>
          {insight.expectancy >= 0 ? "+" : ""}${insight.expectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })} expectancy
        </span>
        {insight.avgR !== null && insight.avgR !== 0 && ` · ${insight.avgR >= 0 ? "+" : ""}${insight.avgR.toFixed(2)}R avg`}
      </p>
      <div className="mt-4">
        <ConfidenceBar score={insight.confidence} sufficient={insight.sufficientData} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric card                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  insight,
  title,
  icon,
  accent,
}: {
  insight: MetricInsight;
  title: string;
  icon: React.ReactNode;
  accent: "bull" | "bear";
}) {
  const colors = accent === "bull"
    ? { text: "text-bull-500", bg: "bg-bull-500/10", border: "border-bull-500/20" }
    : { text: "text-bear-500", bg: "bg-bear-500/10", border: "border-bear-500/20" };

  return (
    <div className={`rounded-xl border ${colors.border} bg-base-850 p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
          <span className="text-xs font-semibold text-base-200">{title}</span>
        </div>
        <ConfidenceBadge score={insight.confidence} sufficient={insight.sufficientData} />
      </div>
      <p className="mt-3 text-base font-bold text-base-50">{insight.label}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-400">
        <span>{insight.tradeCount} trades</span>
        <span>{insight.winRate.toFixed(0)}% win</span>
        <span className={insight.expectancy >= 0 ? "text-bull-500" : "text-bear-500"}>
          {insight.expectancy >= 0 ? "+" : ""}${insight.expectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })}/trade
        </span>
        {insight.avgR !== null && insight.avgR !== 0 && (
          <span className={insight.avgR >= 0 ? "text-bull-500" : "text-bear-500"}>
            {insight.avgR >= 0 ? "+" : ""}{insight.avgR.toFixed(2)}R
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Long vs Short card                                                  */
/* ------------------------------------------------------------------ */

function DirectionalCard({ data }: { data: NonNullable<EdgeReport["longVsShort"]> }) {
  const edgeLabel = data.edge === "long"
    ? "Long-biased"
    : data.edge === "short"
    ? "Short-biased"
    : "Balanced";

  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-500/10 text-info-400">
            <Scale size={16} />
          </div>
          <span className="text-xs font-semibold text-base-200">Long vs. Short Performance</span>
        </div>
        <ConfidenceBadge score={data.confidence} sufficient={data.sufficientData} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DirectionStat label="Long" metric={data.long} />
        <DirectionStat label="Short" metric={data.short} />
      </div>
      <p className="mt-3 text-xs text-base-400">
        {edgeLabel}
        {data.edge !== "neutral" && (
          <> · expectancy gap of ${Math.abs(data.expectancyDifference).toLocaleString("en-US", { maximumFractionDigits: 1 })}/trade</>
        )}
      </p>
    </div>
  );
}

function DirectionStat({ label, metric }: { label: string; metric: MetricInsight }) {
  const positive = metric.expectancy >= 0;
  return (
    <div className={`rounded-lg border p-3 ${positive ? "border-bull-500/20 bg-bull-500/5" : "border-bear-500/20 bg-bear-500/5"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-base-300">{label}</span>
        <span className={`text-xs font-semibold tabular ${positive ? "text-bull-500" : "text-bear-500"}`}>
          {positive ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {metric.winRate.toFixed(0)}% win
        </span>
      </div>
      <p className={`mt-1 text-lg font-bold tabular ${positive ? "text-bull-500" : "text-bear-500"}`}>
        {positive ? "+" : ""}${metric.expectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })}
      </p>
      <p className="text-[11px] text-base-400">{metric.tradeCount} trades</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Win/Loss card                                                       */
/* ------------------------------------------------------------------ */

function WinLossCard({ data }: { data: NonNullable<EdgeReport["avgWinnerVsLoser"]> }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-400/10 text-accent-400">
            <BarChart3 size={16} />
          </div>
          <span className="text-xs font-semibold text-base-200">Average Winner vs. Average Loser</span>
        </div>
        <ConfidenceBadge score={data.confidence} sufficient={data.sufficientData} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-bull-500/20 bg-bull-500/5 p-3">
          <span className="text-xs font-medium text-base-300">Avg Winner</span>
          <p className="mt-1 text-lg font-bold tabular text-bull-500">
            +${data.avgWinner.toLocaleString("en-US", { maximumFractionDigits: 1 })}
          </p>
          <p className="text-[11px] text-base-400">{data.winnerCount} winning trades</p>
        </div>
        <div className="rounded-lg border border-bear-500/20 bg-bear-500/5 p-3">
          <span className="text-xs font-medium text-base-300">Avg Loser</span>
          <p className="mt-1 text-lg font-bold tabular text-bear-500">
            -${Math.abs(data.avgLoser).toLocaleString("en-US", { maximumFractionDigits: 1 })}
          </p>
          <p className="text-[11px] text-base-400">{data.loserCount} losing trades</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-base-400">
        Payoff ratio: <span className="font-semibold text-accent-400">{data.payoffRatio.toFixed(2)}:1</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mistake card                                                        */
/* ------------------------------------------------------------------ */

function MistakeCard({ insight }: { insight: NonNullable<EdgeReport["mostExpensiveMistake"]> }) {
  return (
    <div className="rounded-xl border border-bear-500/20 bg-gradient-to-br from-bear-500/5 via-base-850 to-base-850 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bear-500/10 text-bear-500">
            <AlertTriangle size={16} />
          </div>
          <span className="text-xs font-semibold text-base-200">Most Expensive Recurring Mistake</span>
        </div>
        <ConfidenceBadge score={insight.confidence} sufficient={insight.sufficientData} />
      </div>
      <p className="mt-3 text-base font-bold text-base-50">{insight.label}</p>
      <p className="mt-2 text-sm text-base-300">
        {insight.tradeCount} trades ·{" "}
        <span className="text-bear-500 font-semibold">
          {insight.totalPnl >= 0 ? "+" : ""}${insight.totalPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>{" "}
        total impact · {insight.avgPnl >= 0 ? "+" : ""}${insight.avgPnl.toLocaleString("en-US", { maximumFractionDigits: 1 })}/trade avg
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rule compliance card                                                */
/* ------------------------------------------------------------------ */

function RuleCard({ data }: { data: NonNullable<EdgeReport["ruleCompliance"]> }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-500/10 text-info-400">
            <CheckCircle2 size={16} />
          </div>
          <span className="text-xs font-semibold text-base-200">Rule Compliance</span>
        </div>
        <ConfidenceBadge score={data.confidence} sufficient={data.sufficientData} />
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tabular text-base-50">{data.followedRate.toFixed(0)}%</p>
            <p className="text-xs text-base-400">{data.followedCount} of {data.totalCount} checks followed</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-base-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-info-500 to-bull-500 transition-all"
            style={{ width: `${data.followedRate}%` }}
          />
        </div>
        {data.violatedExpectancy !== 0 || data.followedExpectancy !== 0 ? (
          <p className="mt-3 text-xs text-base-400">
            Following rules: <span className="text-bull-500 font-semibold">+${data.followedExpectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })}/trade</span>
            {" · "}
            Breaking rules: <span className="text-bear-500 font-semibold">${data.violatedExpectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })}/trade</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Opportunity card                                                    */
/* ------------------------------------------------------------------ */

function OpportunityCard({ insight }: { insight: NonNullable<EdgeReport["biggestOpportunity"]> }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent-400/30 bg-gradient-to-br from-accent-400/10 via-base-850 to-base-850 p-6">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-400/15 text-accent-400">
            <Zap size={18} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">Your Biggest Opportunity</span>
        </div>
        <p className="mt-4 text-sm font-medium leading-relaxed text-base-100">
          {insight.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatPill label={`${insight.tradeCount} trades`} />
          <StatPill label={`-${insight.pnlLost.toLocaleString("en-US", { maximumFractionDigits: 0 })} lost`} tone="bear" />
          <StatPill label={`+${insight.pnlImprovementPct}% P&L improvement`} tone="accent" />
        </div>
        <div className="mt-4">
          <ConfidenceBar score={insight.confidence} sufficient={insight.sufficientData} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Focus card                                                          */
/* ------------------------------------------------------------------ */

function FocusCard({ insight }: { insight: NonNullable<EdgeReport["focus"]> }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-info-500/30 bg-gradient-to-br from-info-500/10 via-base-850 to-base-900 p-6">
      <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-info-500/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg">
            <Rocket size={20} />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-info-400">Your #1 Focus</span>
            <h3 className="text-sm font-bold text-base-50">For your next session</h3>
          </div>
        </div>
        <p className="mt-4 text-lg font-bold leading-snug text-base-50">
          {insight.recommendation}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-base-300">
          {insight.rationale}
        </p>
        <div className="mt-4">
          <ConfidenceBar score={insight.confidence} sufficient={insight.confidence >= 48} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared sub-components                                               */
/* ------------------------------------------------------------------ */

function ConfidenceBar({ score, sufficient }: { score: number; sufficient: boolean }) {
  const color = score >= 75 ? "bg-bull-500" : score >= 55 ? "bg-accent-400" : score >= 35 ? "bg-info-500" : "bg-bear-500";
  const label = score >= 75 ? "High confidence" : score >= 55 ? "Moderate confidence" : score >= 35 ? "Low confidence" : "Weak — limited sample";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 max-w-[120px] overflow-hidden rounded-full bg-base-700">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(score, 5)}%` }} />
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-base-400">
        {label} · {score}/100
        {!sufficient && " · insufficient sample"}
      </span>
    </div>
  );
}

function ConfidenceBadge({ score, sufficient }: { score: number; sufficient: boolean }) {
  const color = score >= 75 ? "text-bull-500 bg-bull-500/10" : score >= 55 ? "text-accent-400 bg-accent-400/10" : score >= 35 ? "text-info-400 bg-info-500/10" : "text-bear-500 bg-bear-500/10";
  const label = score >= 75 ? "High" : score >= 55 ? "Moderate" : score >= 35 ? "Low" : "Weak";
  return (
    <div className="flex items-center gap-1.5">
      {!sufficient && (
        <span className="text-[10px] font-medium text-warn-500">small sample</span>
      )}
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>{label}</span>
    </div>
  );
}

function StatPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "bull" | "bear" | "accent" }) {
  const colors = {
    neutral: "border-base-700/50 bg-base-800/40 text-base-300",
    bull: "border-bull-500/20 bg-bull-500/10 text-bull-500",
    bear: "border-bear-500/20 bg-bear-500/10 text-bear-500",
    accent: "border-accent-400/20 bg-accent-400/10 text-accent-400",
  };
  return (
    <span className={`rounded-md border px-2 py-1 text-[11px] font-medium tabular ${colors[tone]}`}>
      {label}
    </span>
  );
}
