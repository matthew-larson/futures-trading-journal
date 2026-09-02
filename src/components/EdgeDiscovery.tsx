import { useMemo, useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Brain,
  BarChart3,
  Trophy,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Info,
  RefreshCw,
  AlertCircle,
  Download,
} from "lucide-react";
import type { Trade, DiscoveredPattern } from "@/lib/types";
import { runEdgeDiscoveryEngine, tierLabel } from "@/lib/edgeEngine";
import {
  persistDiscoveredPatterns,
  loadDiscoveredPatterns,
} from "@/lib/edgePersistence";

interface EdgeDiscoveryProps {
  trades: Trade[];
  onImportTrades: () => void;
}

export function EdgeDiscovery({ trades, onImportTrades }: EdgeDiscoveryProps) {
  const engineResult = useMemo(() => runEdgeDiscoveryEngine(trades), [trades]);
  const [persistedPatterns, setPersistedPatterns] = useState<DiscoveredPattern[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const loadPersisted = useCallback(async () => {
    const patterns = await loadDiscoveredPatterns(true);
    setPersistedPatterns(patterns);
  }, []);

  useEffect(() => {
    loadPersisted();
  }, [loadPersisted]);

  const handleRerun = useCallback(async () => {
    setIsRunning(true);
    await persistDiscoveredPatterns(trades);
    await loadPersisted();
    setLastRun(new Date().toISOString());
    setIsRunning(false);
  }, [trades, loadPersisted]);

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-info-500/20 to-info-600/10 border border-info-500/20">
            <Sparkles size={28} className="text-info-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-base-50">Edge Discovery</h2>
            <p className="mt-2 text-sm text-base-400 max-w-md">
              Log your trades and this page will automatically scan your entire journal for
              statistically meaningful patterns — strengths, weaknesses, opportunities, and
              actionable recommendations. You need at least 8 closed trades for reliable results.
            </p>
          </div>
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={onImportTrades}
              className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
            >
              <Download size={16} /> Import My Trades
            </button>
            <button
              onClick={onImportTrades}
              className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-5 py-2.5 text-sm font-semibold text-base-200 transition-colors hover:bg-base-700"
            >
              <Sparkles size={16} /> Try Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  const patterns = engineResult.patterns;
  const strengths = patterns.filter((p) => p.category === "strength");
  const weaknesses = patterns.filter((p) => p.category === "weakness" || p.category === "behavioral_leak");
  const opportunities = patterns.filter((p) => p.category === "opportunity");
  const riskPatterns = patterns.filter((p) => p.category === "risk_pattern");
  const trends = patterns.filter((p) => p.category === "trend");

  // Use persisted patterns for degradation display if available
  const persistedMap = useMemo(
    () => new Map(persistedPatterns.map((p) => [p.pattern_key, p])),
    [persistedPatterns]
  );

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-base-700 bg-gradient-to-br from-base-850 via-base-850 to-base-900 p-6">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-info-500/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-16 h-40 w-40 rounded-full bg-bull-500/5 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg">
                <Brain size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-base-50">Edge Discovery Engine</h2>
                <p className="text-xs text-base-400">
                  Analyzing {engineResult.totalTrades} trade{engineResult.totalTrades === 1 ? "" : "s"} across {patterns.length} dimension{patterns.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <button
              onClick={handleRerun}
              disabled={isRunning || !engineResult.hasSufficientData}
              className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-3 py-2 text-xs font-medium text-base-300 transition-colors hover:bg-base-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
              {isRunning ? "Analyzing..." : "Re-run analysis"}
            </button>
          </div>

          {/* Summary metrics */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryStat icon={<TrendingUp size={14} />} label="Strengths" value={strengths.length} tone="bull" />
            <SummaryStat icon={<TrendingDown size={14} />} label="Weaknesses" value={weaknesses.length} tone="bear" />
            <SummaryStat icon={<Lightbulb size={14} />} label="Opportunities" value={opportunities.length} tone="accent" />
            <SummaryStat icon={<AlertTriangle size={14} />} label="Risk Patterns" value={riskPatterns.length} tone="warn" />
            <SummaryStat icon={<Compass size={14} />} label="Trends" value={trends.length} tone="info" />
          </div>

          {!engineResult.hasSufficientData && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-info-500/20 bg-info-500/5 p-3">
              <Info size={15} className="mt-0.5 flex-shrink-0 text-info-400" />
              <p className="text-xs text-base-300">
                <span className="font-semibold text-info-400">Insufficient data for pattern detection.</span>{" "}
                You have {engineResult.totalTrades} closed trade{engineResult.totalTrades === 1 ? "" : "s"} —
                the engine needs at least 8 closed trades to search for statistically meaningful patterns.
                Small samples produce unreliable insights, so the engine waits for enough data.
              </p>
            </div>
          )}

          {engineResult.hasSufficientData && patterns.length === 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-info-500/20 bg-info-500/5 p-3">
              <Info size={15} className="mt-0.5 flex-shrink-0 text-info-400" />
              <p className="text-xs text-base-300">
                <span className="font-semibold text-info-400">No statistically meaningful patterns found yet.</span>{" "}
                The engine scanned all dimensions but none met the minimum sample threshold of 5 trades.
                As you log more trades, patterns will emerge.
              </p>
            </div>
          )}

          {lastRun && (
            <p className="mt-3 text-[11px] text-base-500">
              Last analysis: {new Date(lastRun).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Confidence tier legend */}
      {patterns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-base-700/50 bg-base-850/50 px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-base-400">Confidence tiers:</span>
          <TierBadge tier="high_confidence" />
          <TierBadge tier="strong" />
          <TierBadge tier="emerging" />
          <span className="ml-auto text-[11px] text-base-500">
            Minimum sample: 5 trades · Strong: 10+ · High-confidence: 20+
          </span>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <Section title="Strengths" subtitle="Patterns where you have a measurable, repeatable edge" icon={<Trophy size={18} />} accent="bull">
          <div className="grid gap-4 lg:grid-cols-2">
            {strengths.map((p) => (
              <PatternCard key={p.pattern_key} pattern={p} persisted={persistedMap.get(p.pattern_key)} />
            ))}
          </div>
        </Section>
      )}

      {/* Weaknesses & Behavioral Leaks */}
      {weaknesses.length > 0 && (
        <Section title="Weaknesses & Behavioral Leaks" subtitle="Patterns that are consistently costing you capital" icon={<AlertTriangle size={18} />} accent="bear">
          <div className="grid gap-4 lg:grid-cols-2">
            {weaknesses.map((p) => (
              <PatternCard key={p.pattern_key} pattern={p} persisted={persistedMap.get(p.pattern_key)} />
            ))}
          </div>
        </Section>
      )}

      {/* Risk Patterns */}
      {riskPatterns.length > 0 && (
        <Section title="Risk Management Patterns" subtitle="How your sizing, stops, and R:R affect performance" icon={<AlertTriangle size={18} />} accent="warn">
          <div className="grid gap-4 lg:grid-cols-2">
            {riskPatterns.map((p) => (
              <PatternCard key={p.pattern_key} pattern={p} persisted={persistedMap.get(p.pattern_key)} />
            ))}
          </div>
        </Section>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <Section title="Opportunities" subtitle="Counterfactual analysis — what would change if you adjusted your approach" icon={<Compass size={18} />} accent="accent">
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.map((p) => (
              <PatternCard key={p.pattern_key} pattern={p} persisted={persistedMap.get(p.pattern_key)} />
            ))}
          </div>
        </Section>
      )}

      {/* Trends */}
      {trends.length > 0 && (
        <Section title="Performance Trends" subtitle="How your trading is changing over time" icon={<TrendingUp size={18} />} accent="info">
          <div className="grid gap-4 lg:grid-cols-2">
            {trends.map((p) => (
              <PatternCard key={p.pattern_key} pattern={p} persisted={persistedMap.get(p.pattern_key)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                    */
/* ------------------------------------------------------------------ */

interface SectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "bull" | "bear" | "accent" | "info" | "warn";
  children: React.ReactNode;
}

function Section({ title, subtitle, icon, accent, children }: SectionProps) {
  const accentColors = {
    bull: "text-bull-500",
    bear: "text-bear-500",
    accent: "text-accent-400",
    info: "text-info-400",
    warn: "text-warn-500",
  };
  const bgColors = {
    bull: "bg-bull-500/10",
    bear: "bg-bear-500/10",
    accent: "bg-accent-400/10",
    info: "bg-info-500/10",
    warn: "bg-warn-500/10",
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgColors[accent]} ${accentColors[accent]}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-base-50">{title}</h3>
          <p className="text-xs text-base-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pattern card                                                       */
/* ------------------------------------------------------------------ */

interface PatternCardProps {
  pattern: ReturnType<typeof runEdgeDiscoveryEngine>["patterns"][0];
  persisted?: DiscoveredPattern;
}

function PatternCard({ pattern, persisted }: PatternCardProps) {
  const categoryConfig = {
    strength: { border: "border-bull-500/20", glow: "from-bull-500/5", icon: <ArrowUpRight size={16} className="text-bull-500" />, iconBg: "bg-bull-500/10", label: "Strength", labelColor: "text-bull-500 bg-bull-500/10" },
    weakness: { border: "border-bear-500/20", glow: "from-bear-500/5", icon: <ArrowDownRight size={16} className="text-bear-500" />, iconBg: "bg-bear-500/10", label: "Weakness", labelColor: "text-bear-500 bg-bear-500/10" },
    opportunity: { border: "border-accent-400/20", glow: "from-accent-400/5", icon: <Zap size={16} className="text-accent-400" />, iconBg: "bg-accent-400/10", label: "Opportunity", labelColor: "text-accent-400 bg-accent-400/10" },
    behavioral_leak: { border: "border-bear-500/20", glow: "from-bear-500/5", icon: <AlertTriangle size={16} className="text-bear-500" />, iconBg: "bg-bear-500/10", label: "Behavioral Leak", labelColor: "text-bear-500 bg-bear-500/10" },
    risk_pattern: { border: "border-warn-500/20", glow: "from-warn-500/5", icon: <AlertTriangle size={16} className="text-warn-500" />, iconBg: "bg-warn-500/10", label: "Risk Pattern", labelColor: "text-warn-500 bg-warn-500/10" },
    time_effect: { border: "border-info-500/20", glow: "from-info-500/5", icon: <BarChart3 size={16} className="text-info-400" />, iconBg: "bg-info-500/10", label: "Time Effect", labelColor: "text-info-400 bg-info-500/10" },
    trend: { border: "border-info-500/20", glow: "from-info-500/5", icon: <TrendingUp size={16} className="text-info-400" />, iconBg: "bg-info-500/10", label: "Trend", labelColor: "text-info-400 bg-info-500/10" },
  };

  const cfg = categoryConfig[pattern.category] ?? categoryConfig.strength;

  return (
    <div className={`group relative overflow-hidden rounded-xl border ${cfg.border} bg-gradient-to-br ${cfg.glow} via-base-850 to-base-850 p-5 transition-all hover:border-base-600`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.iconBg}`}>
            {cfg.icon}
          </div>
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.labelColor}`}>
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <TierBadge tier={pattern.confidence_tier} />
          <span className="text-[10px] font-medium text-base-500">{pattern.dimension.replace(/_/g, " ")}</span>
        </div>
      </div>

      <h4 className="mt-3 text-sm font-bold leading-snug text-base-50">{pattern.label}</h4>
      <p className="mt-2 text-xs leading-relaxed text-base-300">{pattern.description}</p>

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <StatChip icon={<BarChart3 size={12} />} label={`${pattern.trade_count} trades`} />
        {pattern.win_rate !== null && (
          <StatChip icon={<Target size={12} />} label={`${pattern.win_rate.toFixed(0)}% win`} />
        )}
        {pattern.net_pnl !== null && (
          <StatChip
            icon={<TrendingUp size={12} />}
            label={`${pattern.net_pnl >= 0 ? "+" : ""}$${Math.abs(pattern.net_pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            tone={pattern.net_pnl >= 0 ? "bull" : "bear"}
          />
        )}
        {pattern.avg_r !== null && pattern.avg_r !== 0 && (
          <StatChip
            icon={<Zap size={12} />}
            label={`${pattern.avg_r >= 0 ? "+" : ""}${pattern.avg_r.toFixed(2)}R avg`}
            tone={pattern.avg_r >= 0 ? "bull" : "bear"}
          />
        )}
        {pattern.expectancy !== null && (
          <StatChip
            icon={<TrendingUp size={12} />}
            label={`EV ${pattern.expectancy >= 0 ? "+" : ""}$${pattern.expectancy.toLocaleString("en-US", { maximumFractionDigits: 1 })}`}
            tone={pattern.expectancy >= 0 ? "bull" : "bear"}
          />
        )}
      </div>

      {/* Estimated P&L impact */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-base-400">
        <span>Est. P&L impact:</span>
        <span className={`font-semibold tabular ${pattern.estimated_pnl_impact >= 0 ? "text-bull-500" : "text-bear-500"}`}>
          {pattern.estimated_pnl_impact >= 0 ? "+" : ""}${Math.abs(pattern.estimated_pnl_impact).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* Degradation warning */}
      {persisted?.degradation_note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn-500/20 bg-warn-500/5 p-2.5">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-warn-500" />
          <p className="text-[11px] leading-relaxed text-warn-500/90">{persisted.degradation_note}</p>
        </div>
      )}

      {/* Recommended action */}
      <div className="mt-4 rounded-lg border border-base-700/50 bg-base-900/60 p-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <Lightbulb size={14} className="text-accent-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">Recommended Action</p>
            <p className="mt-0.5 text-xs leading-relaxed text-base-200">{pattern.recommended_action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tier badge                                                         */
/* ------------------------------------------------------------------ */

function TierBadge({ tier }: { tier: "emerging" | "strong" | "high_confidence" }) {
  const config = {
    high_confidence: { color: "text-bull-500 bg-bull-500/10 border-bull-500/20", dot: "bg-bull-500" },
    strong: { color: "text-accent-400 bg-accent-400/10 border-accent-400/20", dot: "bg-accent-400" },
    emerging: { color: "text-info-400 bg-info-500/10 border-info-500/20", dot: "bg-info-500" },
  };
  const cfg = config[tier];

  return (
    <span className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {tierLabel(tier)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat chip                                                          */
/* ------------------------------------------------------------------ */

function StatChip({ icon, label, tone = "neutral" }: { icon: React.ReactNode; label: string; tone?: "neutral" | "bull" | "bear" }) {
  const color = tone === "bull" ? "text-bull-500" : tone === "bear" ? "text-bear-500" : "text-base-300";
  return (
    <div className="flex items-center gap-1 rounded-md border border-base-700/50 bg-base-800/40 px-2 py-1">
      <span className={color}>{icon}</span>
      <span className={`text-[11px] font-medium tabular ${color}`}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary stat (hero header)                                         */
/* ------------------------------------------------------------------ */

function SummaryStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "bull" | "bear" | "accent" | "info" | "warn" }) {
  const colors = { bull: "text-bull-500", bear: "text-bear-500", accent: "text-accent-400", info: "text-info-400", warn: "text-warn-500" };
  const bgs = { bull: "bg-bull-500/5", bear: "bg-bear-500/5", accent: "bg-accent-400/5", info: "bg-info-500/5", warn: "bg-warn-500/5" };
  return (
    <div className={`rounded-lg ${bgs[tone]} border border-base-700/50 px-3 py-2.5`}>
      <div className={`flex items-center gap-1.5 ${colors[tone]}`}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-bold tabular ${colors[tone]}`}>{value}</p>
    </div>
  );
}
