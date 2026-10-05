import { Lock, Sparkles, ArrowRight } from "lucide-react";

interface PremiumLockProps {
  featureName: string;
  description: string;
  onSignOut: () => void;
}

export function PremiumLock({ featureName, description, onSignOut }: PremiumLockProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-base-700 bg-base-850/50 px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-warn-500/15 p-4 text-warn-500">
        <Lock size={28} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base-lg font-semibold text-base-100">{featureName}</h3>
        <span className="flex items-center gap-1 rounded-md border border-warn-500/30 bg-warn-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn-500">
          <Sparkles size={10} /> Pro
        </span>
      </div>
      <p className="mt-1 max-w-md text-sm text-base-400">{description}</p>
      <p className="mt-3 max-w-sm text-xs text-base-500">
        You're using a demo account. Create a free account to unlock this and other advanced features.
      </p>
      <div className="mt-6">
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-info-500"
        >
          Create a free account
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
