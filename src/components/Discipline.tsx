import { useMemo } from "react";
import {
  ShieldCheck,
  Award,
  Crown,
  Flame,
  Star,
  Medal,
  Flag,
  HeartPulse,
  Gem,
  CalendarCheck,
  TrendingUp,
  Lock,
  CheckCircle2,
  Download,
  Sparkles,
} from "lucide-react";
import type { Trade, Achievement } from "@/lib/types";
import {
  computeDailyDiscipline,
  computeWeeklyDiscipline,
  computeMonthlyDiscipline,
  computeOverallDiscipline,
  computeAchievements,
  scoreColor,
  scoreBgColor,
  scoreLabel,
  tradeDisciplineScore,
  isPerfectTrade,
} from "@/lib/discipline";
import { DISCIPLINE_RULES } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

interface DisciplineProps {
  trades: Trade[];
  onImportTrades: () => void;
}

const ACHIEVEMENT_ICONS: Record<string, React.ReactNode> = {
  star: <Star size={22} />,
  "calendar-check": <CalendarCheck size={22} />,
  crown: <Crown size={22} />,
  "shield-check": <ShieldCheck size={22} />,
  medal: <Medal size={22} />,
  "heart-shield": <HeartPulse size={22} />,
  flame: <Flame size={22} />,
  award: <Award size={22} />,
  gem: <Gem size={22} />,
  flag: <Flag size={22} />,
};

const TIER_STYLES: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  bronze: { ring: "border-amber-700/40", bg: "bg-amber-700/10", text: "text-amber-600", label: "Bronze" },
  silver: { ring: "border-slate-400/40", bg: "bg-slate-400/10", text: "text-slate-300", label: "Silver" },
  gold: { ring: "border-accent-500/40", bg: "bg-accent-500/10", text: "text-accent-500", label: "Gold" },
  platinum: { ring: "border-info-500/40", bg: "bg-info-500/10", text: "text-info-400", label: "Platinum" },
};

export function Discipline({ trades, onImportTrades }: DisciplineProps) {
  const daily = useMemo(() => computeDailyDiscipline(trades, 14), [trades]);
  const weekly = useMemo(() => computeWeeklyDiscipline(trades, 8), [trades]);
  const monthly = useMemo(() => computeMonthlyDiscipline(trades, 6), [trades]);
  const overall = useMemo(() => computeOverallDiscipline(trades), [trades]);
  const achievements = useMemo(() => computeAchievements(trades), [trades]);
  const recentScored = useMemo(
    () =>
      trades
        .filter((t) => t.exit_time !== null && tradeDisciplineScore(t) !== null)
        .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
        .slice(0, 8),
    [trades]
  );

  const unlocked = achievements.filter((a) => a.unlocked).length;
  const hasScoredTrades = recentScored.length > 0;

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="No discipline data yet"
          description="This page tracks how well you follow your trading rules — confirmation, risk, revenge trading, and more. It scores every trade, charts your consistency over time, and unlocks achievement badges. Log or import trades with discipline checks to start building your score."
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
      {/* Overall Score Hero */}
      <div className="rounded-2xl border border-base-800 bg-gradient-to-br from-base-850 to-base-900 p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <DisciplineRing score={overall} size={120} />
            <div>
              <h2 className="text-lg font-bold text-base-50">Overall Discipline</h2>
              <p className={`text-2xl font-bold ${scoreColor(overall)}`}>
                {overall > 0 ? overall : "—"} {overall > 0 && `/ 100`}
              </p>
              <p className="text-sm text-base-400">
                {overall > 0 ? scoreLabel(overall) : "No scored trades yet"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat label="Achievements" value={`${unlocked}/${achievements.length}`} />
            <MiniStat
              label="Scored Trades"
              value={String(trades.filter((t) => tradeDisciplineScore(t) !== null).length)}
            />
            <MiniStat
              label="Perfect Trades"
              value={String(trades.filter((t) => isPerfectTrade(t)).length)}
            />
          </div>
        </div>
      </div>

      {/* Period Scores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PeriodCard title="Daily Discipline" subtitle="Last 14 days" periods={daily} />
        <PeriodCard title="Weekly Discipline" subtitle="Last 8 weeks" periods={weekly} />
        <PeriodCard title="Monthly Discipline" subtitle="Last 6 months" periods={monthly} />
      </div>

      {/* Recent Trade Scores */}
      {hasScoredTrades && (
        <div className="rounded-2xl border border-base-800 bg-base-900/50 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-200">
            <TrendingUp size={18} className="text-info-400" />
            Recent Trade Scores
          </h3>
          <div className="space-y-2">
            {recentScored.map((t) => {
              const score = tradeDisciplineScore(t) ?? 0;
              const perfect = isPerfectTrade(t);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-base-800 bg-base-850/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${scoreBgColor(score)} text-white`}>
                      {score}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-base-100">
                        {t.instrument}
                        {perfect && (
                          <span className="flex items-center gap-1 rounded-md bg-bull-500/15 px-1.5 py-0.5 text-xs font-semibold text-bull-500">
                            <Star size={10} /> Perfect
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-base-400">
                        {new Date(t.entry_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.direction} · {t.setup ?? "No setup"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${scoreColor(score)}`}>
                      {scoreLabel(score)}
                    </div>
                    <div className="text-xs text-base-500">
                      {Object.values(t.discipline_checks ?? {}).filter((v) => v === true).length}/{DISCIPLINE_RULES.length} checks passed
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="rounded-2xl border border-base-800 bg-base-900/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-base-200">
            <Award size={18} className="text-accent-500" />
            Achievements
          </h3>
          <span className="text-xs text-base-400">
            {unlocked} of {achievements.length} unlocked
          </span>
        </div>
        {!hasScoredTrades ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-base-800">
              <Lock size={24} className="text-base-500" />
            </div>
            <p className="text-sm font-medium text-base-300">No achievements yet</p>
            <p className="mt-1 max-w-sm text-xs text-base-500">
              Log trades with discipline checks to start unlocking achievements and earning badges.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DisciplineRing({ score, size }: { score: number; size: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? "#16c784" : score >= 70 ? "#38bdf8" : score >= 50 ? "#f5a623" : score >= 30 ? "#f59e0b" : "#ea3943";
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-base-700)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <ShieldCheck size={size * 0.28} style={{ color }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-base-100 tabular">{value}</div>
      <div className="text-xs text-base-400">{label}</div>
    </div>
  );
}

function PeriodCard({
  title,
  subtitle,
  periods,
}: {
  title: string;
  subtitle: string;
  periods: { label: string; score: number; tradeCount: number; perfectCount: number }[];
}) {
  const avgScore = periods.filter((p) => p.tradeCount > 0).reduce((s, p) => s + p.score, 0);
  const activeDays = periods.filter((p) => p.tradeCount > 0).length;
  const avg = activeDays > 0 ? Math.round(avgScore / activeDays) : 0;

  return (
    <div className="rounded-xl border border-base-800 bg-base-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-base-100">{title}</h4>
          <p className="text-xs text-base-400">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold tabular ${scoreColor(avg)}`}>{avg || "—"}</div>
          <div className="text-xs text-base-500">avg</div>
        </div>
      </div>
      <div className="flex h-20 items-end gap-1">
        {periods.map((p, i) => (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t ${p.tradeCount > 0 ? scoreBgColor(p.score) : "bg-base-800"} transition-all`}
              style={{ height: p.tradeCount > 0 ? `${Math.max(p.score, 4)}%` : "4px", opacity: p.tradeCount > 0 ? 1 : 0.4 }}
            />
            <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-base-800 px-2 py-1 text-xs text-base-100 group-hover:block">
              {p.label}: {p.tradeCount > 0 ? p.score : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const tier = TIER_STYLES[achievement.tier];
  const pct = Math.min((achievement.progress / achievement.target) * 100, 100);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
        achievement.unlocked
          ? `${tier.ring} ${tier.bg}`
          : "border-base-800 bg-base-850/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
            achievement.unlocked
              ? `${tier.bg} ${tier.text}`
              : "bg-base-800 text-base-500"
          }`}
        >
          {achievement.unlocked ? ACHIEVEMENT_ICONS[achievement.icon] : <Lock size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h5 className={`text-sm font-semibold ${achievement.unlocked ? "text-base-50" : "text-base-300"}`}>
              {achievement.title}
            </h5>
            {achievement.unlocked && (
              <CheckCircle2 size={14} className="flex-shrink-0 text-bull-500" />
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-base-400">{achievement.description}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-700">
              <div
                className={`h-full rounded-full transition-all ${achievement.unlocked ? tier.text.replace("text", "bg") : "bg-base-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular text-base-400">
              {achievement.progress}/{achievement.target}
            </span>
          </div>
          <span className={`mt-1.5 inline-block text-xs font-medium ${tier.text}`}>
            {tier.label}
          </span>
        </div>
      </div>
    </div>
  );
}
