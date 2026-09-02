import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Shield,
  Eye,
} from "lucide-react";
import type { Trade, TradingRule, AiAnalysis, RiskRating } from "@/lib/types";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { complianceScore } from "@/lib/stats";
import { formatCurrency, formatDateTimeET, formatDuration } from "@/lib/format";
import {
  PnlBadge,
  DirectionBadge,
  ComplianceRing,
} from "@/components/Badges";

interface TradeDetailProps {
  trade: Trade;
  rules: TradingRule[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TradeDetail({ trade, rules, onBack, onEdit, onDelete }: TradeDetailProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(trade.ai_analysis);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (trade.screenshot_path) {
      supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(trade.screenshot_path, 3600)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error || !data?.signedUrl) {
            console.error("Failed to sign screenshot URL", error);
            setScreenshotUrl(null);
            return;
          }
          setScreenshotUrl(data.signedUrl);
        });
    } else {
      setScreenshotUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [trade.screenshot_path]);

  useEffect(() => {
    setAnalysis(trade.ai_analysis);
  }, [trade.ai_analysis]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-trade`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tradeId: trade.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Analysis failed (${res.status})`);
      }
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      if (!body.analysis) throw new Error("No analysis returned");
      setAnalysis(body.analysis as AiAnalysis);
    } catch (e) {
      console.error("Trade analysis failed", e);
      setAnalysisError("We couldn't analyze this trade right now. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const net = Number(trade.pnl ?? 0) - Number(trade.fees ?? 0);
  const cs = complianceScore(trade, rules);
  const isOpen = !trade.exit_time;
  const holdMin =
    trade.entry_time && trade.exit_time
      ? (new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime()) / 60000
      : null;

  const violatedRules = rules.filter(
    (r) => trade.rule_compliance?.[r.id] === false
  );
  const followedRules = rules.filter(
    (r) => trade.rule_compliance?.[r.id] === true
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-base-400 transition-colors hover:text-base-100"
        >
          <ArrowLeft size={16} /> Back to trades
        </button>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg border border-base-600 px-3 py-1.5 text-sm text-base-200 transition-colors hover:bg-base-700"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 rounded-lg border border-base-600 px-3 py-1.5 text-sm text-base-200 transition-colors hover:border-bear-500/40 hover:bg-bear-500/10 hover:text-bear-500"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Trade summary card */}
      <div className="rounded-2xl border border-base-700 bg-base-850 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold ${
                trade.direction === "long"
                  ? "bg-bull-500/15 text-bull-500"
                  : "bg-bear-500/15 text-bear-500"
              }`}
            >
              {trade.direction === "long" ? "L" : "S"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-base-50">{trade.instrument}</h2>
                <DirectionBadge direction={trade.direction} />
                {isOpen && (
                  <span className="rounded border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent-400">
                    Open
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-base-400">
                {formatDateTimeET(trade.entry_time)}
                {holdMin !== null && ` · ${formatDuration(holdMin)} hold`}
                {trade.market_session && ` · ${trade.market_session.replace("_", " ")} session`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {cs.total > 0 && (
              <div className="flex flex-col items-center">
                <ComplianceRing score={cs.score} size={56} />
                <span className="mt-1 text-xs text-base-400">rules</span>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-base-400">
                Net P&L
              </p>
              {isOpen ? (
                <p className="mt-1 text-2xl font-bold text-base-300">—</p>
              ) : (
                <PnlBadge value={net} />
              )}
              {trade.fees > 0 && (
                <p className="mt-1 text-xs text-base-500 tabular">
                  Gross {formatCurrency(Number(trade.pnl ?? 0))} · Fees {formatCurrency(trade.fees)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price details */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DetailItem label="Quantity" value={String(trade.quantity)} />
          <DetailItem label="Entry" value={Number(trade.entry_price).toFixed(2)} />
          <DetailItem
            label="Exit"
            value={trade.exit_price ? Number(trade.exit_price).toFixed(2) : "—"}
          />
          <DetailItem
            label="Setup"
            value={trade.setup ?? "—"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: screenshot + journal */}
        <div className="space-y-5 lg:col-span-2">
          {/* Screenshot */}
          {screenshotUrl ? (
            <div className="overflow-hidden rounded-xl border border-base-700 bg-base-850">
              <div className="flex items-center gap-2 border-b border-base-700 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-base-400">
                <Eye size={14} /> Chart Screenshot
              </div>
              <div className="bg-base-900 p-2">
                <img
                  src={screenshotUrl}
                  alt="Trade screenshot"
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          ) : null}

          {/* Journal notes */}
          <div className="rounded-xl border border-base-700 bg-base-850 p-5">
            <h3 className="mb-3 text-sm font-semibold text-base-200">Journal Notes</h3>
            <div className="space-y-4">
              {trade.emotions && (
                <NoteBlock label="Emotions" content={trade.emotions} />
              )}
              {trade.mistakes && (
                <NoteBlock label="Mistakes" content={trade.mistakes} />
              )}
              {trade.notes && (
                <NoteBlock label="Notes" content={trade.notes} />
              )}
              {!trade.emotions && !trade.mistakes && !trade.notes && (
                <p className="text-sm text-base-500">No journal notes recorded.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI analysis + rules */}
        <div className="space-y-5">
          {/* AI Analysis */}
          <div className="rounded-xl border border-base-700 bg-gradient-to-br from-base-850 to-base-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-base-200">
                <Sparkles size={16} className="text-info-400" /> AI Analysis
              </h3>
            </div>

            {analysis ? (
              <div className="space-y-4 animate-fade-in">
                <RiskRatingBadge rating={analysis.riskRating} />
                <p className="text-sm leading-relaxed text-base-200">{analysis.summary}</p>

                {analysis.strengths.length > 0 && (
                  <AnalysisSection
                    title="Strengths"
                    icon={<TrendingUp size={14} className="text-bull-500" />}
                tone="bull"
                  >
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-base-300">
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-bull-500" />
                        {s}
                      </li>
                    ))}
                  </AnalysisSection>
                )}

                {analysis.weaknesses.length > 0 && (
                  <AnalysisSection
                    title="Weaknesses"
                    icon={<TrendingDown size={14} className="text-bear-500" />}
                    tone="bear"
                  >
                    {analysis.weaknesses.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-base-300">
                        <XCircle size={14} className="mt-0.5 flex-shrink-0 text-bear-500" />
                        {s}
                      </li>
                    ))}
                  </AnalysisSection>
                )}

                {analysis.recommendations.length > 0 && (
                  <AnalysisSection
                    title="Recommendations"
                    icon={<Lightbulb size={14} className="text-accent-400" />}
                    tone="accent"
                  >
                    {analysis.recommendations.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-base-300">
                        <Lightbulb size={14} className="mt-0.5 flex-shrink-0 text-accent-400" />
                        {s}
                      </li>
                    ))}
                  </AnalysisSection>
                )}

                {analysis.patternRecognition.length > 0 && (
                  <AnalysisSection
                    title="Patterns"
                    icon={<Eye size={14} className="text-info-400" />}
                    tone="info"
                  >
                    {analysis.patternRecognition.map((s, i) => (
                      <li key={i} className="text-sm text-base-300">• {s}</li>
                    ))}
                  </AnalysisSection>
                )}

                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-600 py-2 text-xs font-medium text-base-300 transition-colors hover:bg-base-700 disabled:opacity-60"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Re-run analysis
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-base-400">
                  Run AI analysis to get automated insights on this trade — strengths, weaknesses,
                  risk rating, and actionable recommendations based on your rules and trade data.
                </p>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-info-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
                >
                  {analyzing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {analyzing ? "Analyzing..." : "Run AI Analysis"}
                </button>
                {analysisError && (
                  <p className="text-xs text-bear-500">{analysisError}</p>
                )}
              </div>
            )}
          </div>

          {/* Rule compliance breakdown */}
          {(followedRules.length > 0 || violatedRules.length > 0) && (
            <div className="rounded-xl border border-base-700 bg-base-850 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-base-200">
                <Shield size={16} className="text-base-400" /> Rule Compliance
              </h3>
              <div className="space-y-2">
                {followedRules.map((r) => (
                  <RuleResult key={r.id} rule={r} followed />
                ))}
                {violatedRules.map((r) => (
                  <RuleResult key={r.id} rule={r} followed={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800/50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wider text-base-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-base-100 tabular">{value}</p>
    </div>
  );
}

function NoteBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-base-400">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-base-200">{content}</p>
    </div>
  );
}

function AnalysisSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-base-400">
        {icon} {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function RuleResult({ rule, followed }: { rule: TradingRule; followed: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
        followed
          ? "border-bull-500/20 bg-bull-500/5"
          : "border-bear-500/20 bg-bear-500/5"
      }`}
    >
      {followed ? (
        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-bull-500" />
      ) : (
        <XCircle size={14} className="mt-0.5 flex-shrink-0 text-bear-500" />
      )}
      <div>
        <p className="text-sm font-medium text-base-100">{rule.name}</p>
        {rule.description && (
          <p className="text-xs text-base-400">{rule.description}</p>
        )}
      </div>
    </div>
  );
}

function RiskRatingBadge({ rating }: { rating: RiskRating }) {
  const map = {
    low: { label: "Low Risk", cls: "border-bull-500/30 bg-bull-500/10 text-bull-500", icon: <CheckCircle2 size={14} /> },
    moderate: { label: "Moderate Risk", cls: "border-accent-500/30 bg-accent-500/10 text-accent-400", icon: <AlertTriangle size={14} /> },
    high: { label: "High Risk", cls: "border-bear-500/30 bg-bear-500/10 text-bear-500", icon: <AlertTriangle size={14} /> },
  };
  const r = map[rating];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${r.cls}`}>
      {r.icon} {r.label}
    </span>
  );
}
