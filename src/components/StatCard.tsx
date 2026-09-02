interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "neutral" | "bull" | "bear" | "accent" | "info";
  icon?: React.ReactNode;
}

const toneMap = {
  neutral: "text-base-50",
  bull: "text-bull-500",
  bear: "text-bear-500",
  accent: "text-accent-400",
  info: "text-info-400",
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-850 p-5 transition-colors hover:border-base-600">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-base-400">
          {label}
        </span>
        {icon && <span className="text-base-500">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular ${toneMap[tone]}`}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-base-400">{sublabel}</div>
      )}
    </div>
  );
}
