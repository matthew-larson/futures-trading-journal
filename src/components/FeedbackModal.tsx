import { useState } from "react";
import { MessageSquare, Bug, Lightbulb, HelpCircle, Loader2, CheckCircle2, Send } from "lucide-react";
import { submitFeedback, type FeedbackType } from "@/lib/feedback";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  currentPage: string;
}

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "general", label: "General Feedback", icon: <MessageSquare size={18} />, description: "Share any thoughts about the app" },
  { id: "bug", label: "Bug Report", icon: <Bug size={18} />, description: "Something isn't working right" },
  { id: "feature", label: "Feature Request", icon: <Lightbulb size={18} />, description: "Suggest a new feature or improvement" },
  { id: "confusing", label: "Confusing Experience", icon: <HelpCircle size={18} />, description: "Something was hard to understand or use" },
];

export function FeedbackModal({ open, onClose, currentPage }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({
        feedbackType: type,
        page: currentPage,
        message,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage("");
        setType("general");
        onClose();
      }, 1500);
    } catch {
      setError("We couldn't submit your feedback right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-base-700 bg-base-900 p-6 shadow-2xl animate-fade-in">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bull-500/15">
              <CheckCircle2 size={24} className="text-bull-500" />
            </div>
            <h3 className="text-base font-semibold text-base-50">Thank you!</h3>
            <p className="text-sm text-base-400">Your feedback helps us improve EdgePilot.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-info-400" />
                <h2 className="text-base font-semibold text-base-50">Give Feedback</h2>
              </div>
              <button onClick={handleClose} className="text-base-500 hover:text-base-300 text-sm">
                Cancel
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-base-400">
                Feedback Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FEEDBACK_TYPES.map((ft) => (
                  <button
                    key={ft.id}
                    onClick={() => setType(ft.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all ${
                      type === ft.id
                        ? "border-info-500/50 bg-info-500/10"
                        : "border-base-700 bg-base-850 hover:border-base-600"
                    }`}
                  >
                    <span className={type === ft.id ? "text-info-400" : "text-base-400"}>
                      {ft.icon}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${type === ft.id ? "text-base-100" : "text-base-200"}`}>
                        {ft.label}
                      </p>
                      <p className="text-[11px] leading-tight text-base-500">{ft.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-base-400">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Tell us what you think..."
                className="w-full resize-none rounded-lg border border-base-700 bg-base-850 px-3 py-2.5 text-sm text-base-100 placeholder:text-base-500 focus:border-info-500/50 focus:outline-none"
              />
            </div>

            {error && (
              <p className="mb-3 text-sm text-bear-500">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-base-500">From page: {currentPage}</p>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
                className="flex items-center gap-2 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                ) : (
                  <><Send size={16} /> Submit Feedback</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
