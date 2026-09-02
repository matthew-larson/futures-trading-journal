import { useMemo, useState } from "react";
import {
  CalendarClock,
  Printer,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Clock,
  Brain,
  Gauge,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Crosshair,
  ClipboardList,
  Sparkles,
  Info,
  Download,
} from "lucide-react";
import type { Trade, TradingRule } from "@/lib/types";
import { generatePlan, type ChecklistItem, type TomorrowsPlan } from "@/lib/planGenerator";

interface TomorrowsPlanProps {
  trades: Trade[];
  rules: TradingRule[];
  onImportTrades: () => void;
}

export function TomorrowsPlan({ trades, rules, onImportTrades }: TomorrowsPlanProps) {
  const plan = useMemo(
    () => generatePlan(trades, rules),
    [trades, rules]
  );

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400/20 to-accent-500/10 border border-accent-400/20">
            <CalendarClock size={28} className="text-accent-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-base-50">Tomorrow's Plan</h2>
            <p className="mt-2 text-sm text-base-400 max-w-md">
              Every evening, this page generates a personalized trading plan from your journal —
              your best setup to focus on, setups to avoid, max trades, best time window, and a
              pre-session checklist. It's like an institutional morning briefing, built from your
              data. Log at least 8 closed trades to get started.
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

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-lg font-bold text-base-50">Tomorrow's Plan</h2>
          <p className="text-xs text-base-400">
            Generated from {plan.tradeCount} trade{plan.tradeCount === 1 ? "" : "s"} in your journal
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-4 py-2 text-sm font-medium text-base-100 transition-colors hover:bg-base-700"
        >
          <Printer size={16} />
          Print Plan
        </button>
      </div>

      {!plan.hasRealData && (
        <div className="flex items-start gap-2.5 rounded-lg border border-accent-400/20 bg-accent-400/5 p-3 no-print">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-accent-400" />
          <p className="text-xs text-base-300">
            <span className="font-semibold text-accent-400">Sample plan shown.</span>{" "}
            You have {plan.tradeCount} trade{plan.tradeCount === 1 ? "" : "s"} — log at
            least 8 closed trades and this plan will be generated from your real data.
          </p>
        </div>
      )}

      {/* The printable briefing */}
      <div className="rounded-2xl border border-base-700 bg-base-850 p-6 lg:p-8 print-plan">
        {/* Header */}
        <PlanHeader plan={plan} />

        {/* Today's Summary */}
        <Section
          icon={<TrendingUp size={16} />}
          title="Today's Summary"
          accent="bull"
        >
          <TodaySummaryGrid plan={plan} />
        </Section>

        {/* Biggest Improvement Area */}
        <Section
          icon={<AlertTriangle size={16} />}
          title="Biggest Improvement Area"
          accent="bear"
        >
          <ImprovementCard plan={plan} />
        </Section>

        {/* Best Setup + Setups To Avoid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            icon={<Crosshair size={16} />}
            title="Best Setup To Focus On"
            accent="bull"
          >
            <SetupFocusCard setup={plan.bestSetup} positive />
          </Section>
          <Section
            icon={<Shield size={16} />}
            title="Setups To Avoid"
            accent="bear"
          >
            <SetupsToAvoidList setups={plan.setupsToAvoid} />
          </Section>
        </div>

        {/* Max Trades + Best Time Window */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            icon={<Gauge size={16} />}
            title="Maximum Trades"
            accent="info"
          >
            <MaxTradesCard plan={plan} />
          </Section>
          <Section
            icon={<Clock size={16} />}
            title="Best Time Window"
            accent="accent"
          >
            <TimeWindowCard window={plan.bestTimeWindow} />
          </Section>
        </div>

        {/* Psychology Reminder + Priority Rule */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            icon={<Brain size={16} />}
            title="Psychology Reminder"
            accent="accent"
          >
            <PsychologyCard reminder={plan.psychologyReminder} streak={plan.todaySummary.streak} />
          </Section>
          <Section
            icon={<Shield size={16} />}
            title="Highest Priority Rule"
            accent="bear"
          >
            <PriorityRuleCard rule={plan.highestPriorityRule} />
          </Section>
        </div>

        {/* Expected Market Conditions */}
        <Section
          icon={<Cloud size={16} />}
          title="Expected Market Conditions"
          accent="info"
        >
          <MarketConditionsCard conditions={plan.expectedMarketConditions} confidence={plan.confidenceLevel} />
        </Section>

        {/* Pre-Session Checklist */}
        <Section
          icon={<ClipboardList size={16} />}
          title="Pre-Session Checklist"
          accent="accent"
        >
          <Checklist items={plan.checklist} />
        </Section>

        {/* Footer */}
        <div className="mt-6 border-t border-base-700 pt-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-base-500">
            Generated by Edge Discovery Engine · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plan header (printable)                                            */
/* ------------------------------------------------------------------ */

function PlanHeader({ plan }: { plan: TomorrowsPlan }) {
  return (
    <div className="mb-6 border-b border-base-700 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-400">
              Institutional Morning Briefing
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-base-50">
            Tomorrow's Trading Plan
          </h1>
          <p className="text-sm text-base-300">{plan.date}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-base-400">
              Confidence
            </span>
            <span className={`text-2xl font-bold tabular ${
              plan.confidenceLevel >= 70 ? "text-bull-500"
              : plan.confidenceLevel >= 50 ? "text-accent-400"
              : "text-bear-500"
            }`}>
              {plan.confidenceLevel}
            </span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-base-700">
            <div
              className={`h-full rounded-full ${
                plan.confidenceLevel >= 70 ? "bg-bull-500"
                : plan.confidenceLevel >= 50 ? "bg-accent-400"
                : "bg-bear-500"
              }`}
              style={{ width: `${plan.confidenceLevel}%` }}
            />
          </div>
          {plan.sampleNote && (
            <p className="mt-1 max-w-[200px] text-right text-[10px] leading-tight text-base-500">
              {plan.sampleNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                    */
/* ------------------------------------------------------------------ */

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  accent: "bull" | "bear" | "accent" | "info";
  children: React.ReactNode;
}

function Section({ title, icon, accent, children }: SectionProps) {
  const colors = {
    bull: "text-bull-500 bg-bull-500/10",
    bear: "text-bear-500 bg-bear-500/10",
    accent: "text-accent-400 bg-accent-400/10",
    info: "text-info-400 bg-info-500/10",
  };
  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${colors[accent]}`}>
          {icon}
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-base-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Today's summary                                                    */
/* ------------------------------------------------------------------ */

function TodaySummaryGrid({ plan }: { plan: TomorrowsPlan }) {
  const s = plan.todaySummary;
  const summaryItems = [
    { label: "Trades", value: String(s.tradesTaken), tone: "neutral" as const },
    { label: "Net P&L", value: s.netPnl >= 0 ? `+$${s.netPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `-$${Math.abs(s.netPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, tone: s.netPnl >= 0 ? "bull" as const : "bear" as const },
    { label: "Win Rate", value: `${s.winRate.toFixed(0)}%`, tone: s.winRate >= 50 ? "bull" as const : "bear" as const },
    { label: "Streak", value: s.streak.type === "none" ? "—" : `${s.streak.value} ${s.streak.type === "winning" ? "W" : "L"}`, tone: s.streak.type === "winning" ? "bull" as const : s.streak.type === "losing" ? "bear" as const : "neutral" as const },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {summaryItems.map((item) => (
          <SummaryMetric key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-bull-500/20 bg-bull-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-bull-500">Top Strength</p>
          <p className="mt-1 text-xs text-base-200">{s.topStrength}</p>
        </div>
        <div className="rounded-lg border border-bear-500/20 bg-bear-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-bear-500">Top Weakness</p>
          <p className="mt-1 text-xs text-base-200">{s.topWeakness}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: "neutral" | "bull" | "bear" }) {
  const color = tone === "bull" ? "text-bull-500" : tone === "bear" ? "text-bear-500" : "text-base-50";
  return (
    <div className="rounded-lg border border-base-700 bg-base-800/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-base-400">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular ${color}`}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Improvement card                                                   */
/* ------------------------------------------------------------------ */

function ImprovementCard({ plan }: { plan: TomorrowsPlan }) {
  const imp = plan.biggestImprovement;
  return (
    <div className="rounded-lg border border-bear-500/20 bg-bear-500/5 p-4">
      <h4 className="text-sm font-bold text-base-50">{imp.title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-base-300">{imp.detail}</p>
      {imp.estimatedImpact > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-base-400">Est. Impact</span>
          <span className="text-sm font-bold tabular text-bear-500">
            ${imp.estimatedImpact.toLocaleString("en-US")}/period
          </span>
        </div>
      )}
      <div className="mt-3 rounded-md border border-base-700/50 bg-base-900/50 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">Action</p>
        <p className="mt-0.5 text-xs leading-relaxed text-base-200">{imp.action}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Setup focus card                                                   */
/* ------------------------------------------------------------------ */

function SetupFocusCard({ setup, positive }: { setup: NonNullable<TomorrowsPlan["bestSetup"]>; positive: boolean }) {
  const tone = positive ? "bull" : "bear";
  const border = positive ? "border-bull-500/20" : "border-bear-500/20";
  const bg = positive ? "bg-bull-500/5" : "bg-bear-500/5";
  const textColor = positive ? "text-bull-500" : "text-bear-500";
  return (
    <div className={`rounded-lg border ${border} ${bg} p-4`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-base-50">{setup.name}</h4>
        <span className={`text-xs font-bold tabular ${textColor}`}>
          {setup.expectancy >= 0 ? "+" : ""}${setup.expectancy.toLocaleString("en-US", { maximumFractionDigits: 0 })}/trade
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-base-300">{setup.rationale}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <MiniStat label="Win Rate" value={`${setup.winRate.toFixed(0)}%`} />
        <MiniStat label="Trades" value={String(setup.tradeCount)} />
        <MiniStat label="PF" value={setup.profitFactor === 99 ? "∞" : setup.profitFactor.toFixed(2)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Setups to avoid                                                    */
/* ------------------------------------------------------------------ */

function SetupsToAvoidList({ setups }: { setups: NonNullable<TomorrowsPlan["setupsToAvoid"]> }) {
  if (setups.length === 0) {
    return (
      <div className="rounded-lg border border-bull-500/20 bg-bull-500/5 p-4 text-center">
        <CheckCircle2 size={20} className="mx-auto text-bull-500" />
        <p className="mt-1.5 text-xs text-base-200">No setups are consistently losing. Keep executing your plan.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {setups.map((s) => (
        <div key={s.name} className="rounded-lg border border-bear-500/20 bg-bear-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-100">{s.name}</span>
            <span className="text-xs font-bold tabular text-bear-500">
              ${Math.abs(s.expectancy).toLocaleString("en-US", { maximumFractionDigits: 0 })}/trade loss
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-base-400">{s.rationale}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Max trades                                                         */
/* ------------------------------------------------------------------ */

function MaxTradesCard({ plan }: { plan: TomorrowsPlan }) {
  return (
    <div className="rounded-lg border border-info-500/20 bg-info-500/5 p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular text-info-400">{plan.maxTrades}</span>
        <span className="text-sm text-base-300">trades maximum</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-base-300">
        Based on your historical daily trade distribution, your expectancy stays highest
        when you cap your session at {plan.maxTrades} trades. More trades than this and
        decision quality degrades.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Time window                                                        */
/* ------------------------------------------------------------------ */

function TimeWindowCard({ window }: { window: NonNullable<TomorrowsPlan["bestTimeWindow"]> }) {
  return (
    <div className="rounded-lg border border-accent-400/20 bg-accent-400/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-base-50">{window.label}</h4>
          <p className="text-xs text-base-400">{window.timeRange}</p>
        </div>
        <span className="text-sm font-bold tabular text-accent-400">
          {window.expectancy >= 0 ? "+" : ""}${window.expectancy.toLocaleString("en-US", { maximumFractionDigits: 0 })}/trade
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-base-300">{window.rationale}</p>
      <div className="mt-3 flex gap-2">
        <MiniStat label="Win Rate" value={`${window.winRate.toFixed(0)}%`} />
        <MiniStat label="Trades" value={String(window.tradeCount)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Psychology                                                         */
/* ------------------------------------------------------------------ */

function PsychologyCard({ reminder, streak }: { reminder: string; streak: { value: number; type: "winning" | "losing" | "none" } }) {
  const streakColor =
    streak.type === "losing" ? "text-bear-500 bg-bear-500/10"
    : streak.type === "winning" ? "text-bull-500 bg-bull-500/10"
    : "text-base-400 bg-base-700/30";
  return (
    <div className="rounded-lg border border-accent-400/20 bg-accent-400/5 p-4">
      {streak.type !== "none" && (
        <div className={`mb-2 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${streakColor}`}>
          {streak.type === "losing" ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
          {streak.value} {streak.type === "winning" ? "Win" : "Loss"} Streak
        </div>
      )}
      <p className="text-xs leading-relaxed text-base-200">{reminder}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Priority rule                                                      */
/* ------------------------------------------------------------------ */

function PriorityRuleCard({ rule }: { rule: NonNullable<TomorrowsPlan["highestPriorityRule"]> }) {
  return (
    <div className="rounded-lg border border-bear-500/20 bg-bear-500/5 p-4">
      <h4 className="text-sm font-bold text-base-50">{rule.name}</h4>
      {rule.description && (
        <p className="mt-1 text-xs text-base-400">{rule.description}</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-base-300">{rule.impact}</p>
      {rule.violationCount > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-bull-500" />
            <span className="text-[11px] font-medium tabular text-bull-500">{rule.followedCount} followed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-bear-500" />
            <span className="text-[11px] font-medium tabular text-bear-500">{rule.violationCount} violated</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Market conditions                                                  */
/* ------------------------------------------------------------------ */

function MarketConditionsCard({ conditions, confidence }: { conditions: NonNullable<TomorrowsPlan["expectedMarketConditions"]>; confidence: number }) {
  return (
    <div className="rounded-lg border border-info-500/20 bg-info-500/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ConditionRow icon={<TrendingUp size={14} />} label="Trend Bias" value={conditions.trendBias} />
        <ConditionRow icon={<Zap size={14} />} label="Volatility" value={conditions.volatility} />
        <ConditionRow icon={<Clock size={14} />} label="Session Focus" value={conditions.sessionFocus} />
        <ConditionRow icon={<Info size={14} />} label="Notes" value={conditions.notes} />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-base-700/50 bg-base-900/50 p-2.5">
        <Gauge size={14} className="text-info-400" />
        <span className="text-[11px] text-base-400">
          Plan confidence: <span className={`font-bold ${confidence >= 70 ? "text-bull-500" : confidence >= 50 ? "text-accent-400" : "text-bear-500"}`}>{confidence}/100</span>
          {" — based on sample size and consistency of your historical edge"}
        </span>
      </div>
    </div>
  );
}

function ConditionRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-info-400">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-base-400">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-base-200">{value}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist                                                          */
/* ------------------------------------------------------------------ */

function Checklist({ items }: { items: ChecklistItem[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categories: { key: ChecklistItem["category"]; label: string; icon: React.ReactNode }[] = [
    { key: "preparation", label: "Preparation", icon: <ClipboardList size={12} /> },
    { key: "rules", label: "Rules", icon: <Shield size={12} /> },
    { key: "execution", label: "Execution", icon: <Crosshair size={12} /> },
    { key: "psychology", label: "Psychology", icon: <Brain size={12} /> },
  ];

  return (
    <div className="rounded-lg border border-base-700 bg-base-800/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-base-400">
          Review before tomorrow's open. Check off each item.
        </p>
        <span className="text-xs font-medium tabular text-base-300">
          {checked.size}/{items.length} done
        </span>
      </div>
      <div className="space-y-4">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.key);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.key}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-400">
                {cat.icon}
                {cat.label}
              </div>
              <div className="space-y-1">
                {catItems.map((item) => {
                  const isChecked = checked.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-base-700/30"
                    >
                      <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all ${
                        isChecked
                          ? "border-bull-500 bg-bull-500/20"
                          : "border-base-600 bg-base-800"
                      }`}>
                        {isChecked && <CheckCircle2 size={11} className="text-bull-500" />}
                      </div>
                      <span className={`text-xs leading-relaxed transition-colors ${
                        isChecked ? "text-base-500 line-through" : "text-base-200"
                      }`}>
                        {item.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini stat                                                          */
/* ------------------------------------------------------------------ */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-base-700/50 bg-base-800/40 px-2 py-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-base-400">{label}</span>
      <span className="text-[11px] font-bold tabular text-base-200">{value}</span>
    </div>
  );
}
