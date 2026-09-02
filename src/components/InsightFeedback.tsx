import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { submitFeedback } from "@/lib/feedback";

interface InsightFeedbackProps {
  insightId: string;
  page: string;
}

export function InsightFeedback({ insightId, page }: InsightFeedbackProps) {
  const [rating, setRating] = useState<"yes" | "no" | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRate = async (value: "yes" | "no") => {
    if (rating && !showExplain) return;
    setRating(value);
    setSubmitting(true);
    try {
      await submitFeedback({
        feedbackType: "insight",
        page,
        insightId,
        rating: value,
      });
      if (value === "no") {
        setShowExplain(true);
      } else {
        setSaved(true);
      }
    } catch {
      setRating(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExplanation = async () => {
    if (!explanation.trim() || rating !== "no") return;
    setSubmitting(true);
    try {
      await submitFeedback({
        feedbackType: "insight",
        page,
        insightId,
        rating: "no",
        message: explanation,
      });
      setShowExplain(false);
      setSaved(true);
    } catch {
      // keep the explanation form open so they can retry
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-base-500">
        <Check size={12} className="text-bull-500" />
        Thanks for the feedback
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-base-500">Was this insight useful?</span>
        <button
          onClick={() => handleRate("yes")}
          disabled={submitting}
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
            rating === "yes"
              ? "border-bull-500/40 bg-bull-500/10 text-bull-500"
              : "border-base-700 bg-base-850 text-base-400 hover:bg-base-800"
          }`}
        >
          {submitting && rating === "yes" ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />}
          Yes
        </button>
        <button
          onClick={() => handleRate("no")}
          disabled={submitting}
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
            rating === "no"
              ? "border-bear-500/40 bg-bear-500/10 text-bear-500"
              : "border-base-700 bg-base-850 text-base-400 hover:bg-base-800"
          }`}
        >
          {submitting && rating === "no" ? <Loader2 size={11} className="animate-spin" /> : <ThumbsDown size={11} />}
          No
        </button>
      </div>

      {showExplain && (
        <div className="mt-2 flex flex-col gap-2 animate-fade-in">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            placeholder="What was off? (optional)"
            className="resize-none rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-xs text-base-100 placeholder:text-base-500 focus:border-info-500/40 focus:outline-none"
          />
          <button
            onClick={handleSubmitExplanation}
            disabled={submitting || !explanation.trim()}
            className="self-start rounded-md bg-base-700 px-3 py-1 text-[11px] font-medium text-base-200 transition-colors hover:bg-base-600 disabled:opacity-40"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
