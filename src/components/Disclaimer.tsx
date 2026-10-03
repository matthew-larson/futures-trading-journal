import { AlertCircle } from "lucide-react";

export function AiDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-warn-500/20 bg-warn-500/5 px-3 py-2 text-xs leading-relaxed text-base-400 ${className}`}>
      <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-warn-500" />
      <span>
        AI-generated analysis is for educational purposes only and is not financial advice.
        Futures trading carries a substantial risk of loss and is not suitable for all investors.
        Always do your own research and consult a licensed professional before making trading decisions.
      </span>
    </div>
  );
}
