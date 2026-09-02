import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Brain,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { fetchAllFeedback, type FeedbackEntry, type FeedbackType } from "@/lib/feedback";

interface FeedbackAdminProps {
  onBack: () => void;
}

const TYPE_META: Record<FeedbackType, { label: string; icon: React.ReactNode; color: string }> = {
  general: { label: "General", icon: <MessageSquare size={14} />, color: "text-base-300 bg-base-800 border-base-700" },
  bug: { label: "Bug", icon: <Bug size={14} />, color: "text-bear-500 bg-bear-500/10 border-bear-500/20" },
  feature: { label: "Feature", icon: <Lightbulb size={14} />, color: "text-accent-400 bg-accent-400/10 border-accent-400/20" },
  confusing: { label: "Confusing", icon: <HelpCircle size={14} />, color: "text-warn-500 bg-warn-500/10 border-warn-500/20" },
  insight: { label: "Insight", icon: <Brain size={14} />, color: "text-info-400 bg-info-500/10 border-info-500/20" },
};

export function FeedbackAdmin({ onBack }: FeedbackAdminProps) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackType | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllFeedback();
      setEntries(data);
    } catch {
      setError("We couldn't load feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.feedback_type === filter);
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.feedback_type] = (acc[e.feedback_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-base-400 transition-colors hover:text-base-200"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-xl font-bold text-base-50">Feedback Review</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 py-2 text-xs font-medium text-base-300 transition-colors hover:bg-base-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeft size={14} className="rotate-180" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-3 text-sm text-bear-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-info-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-700 bg-base-850/50 px-6 py-16 text-center">
          <MessageSquare size={28} className="mx-auto mb-3 text-base-600" />
          <p className="text-sm font-medium text-base-300">No feedback yet</p>
          <p className="mt-1 text-xs text-base-500">Feedback submitted by users will appear here.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "border-info-500/40 bg-info-500/10 text-info-400"
                  : "border-base-700 bg-base-850 text-base-400 hover:bg-base-800"
              }`}
            >
              All ({entries.length})
            </button>
            {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === t
                    ? "border-info-500/40 bg-info-500/10 text-info-400"
                    : "border-base-700 bg-base-850 text-base-400 hover:bg-base-800"
                }`}
              >
                {TYPE_META[t].icon}
                {TYPE_META[t].label} ({counts[t] ?? 0})
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((entry) => {
              const meta = TYPE_META[entry.feedback_type];
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-base-800 bg-base-900/60 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      {entry.rating && (
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          entry.rating === "yes"
                            ? "bg-bull-500/10 text-bull-500"
                            : "bg-bear-500/10 text-bear-500"
                        }`}>
                          {entry.rating === "yes" ? "Useful" : "Not useful"}
                        </span>
                      )}
                      {entry.page && (
                        <span className="text-[11px] text-base-500">on {entry.page}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-base-500">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {entry.message && (
                    <p className="text-sm leading-relaxed text-base-200">{entry.message}</p>
                  )}

                  {!entry.message && entry.feedback_type === "insight" && (
                    <p className="text-sm text-base-400">
                      {entry.rating === "yes" ? "Marked as useful" : "Marked as not useful"}
                      {entry.insight_id ? ` (insight ${entry.insight_id.slice(0, 12)})` : ""}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-base-600">
                    <span>User: {entry.owner_id?.slice(0, 16) ?? "..."}</span>
                    {entry.insight_id && <span>Insight: {entry.insight_id}</span>}
                    {entry.trade_id && <span>Trade: {entry.trade_id.slice(0, 8)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
