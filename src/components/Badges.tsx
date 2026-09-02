interface PnlBadgeProps {
  value: number;
  size?: "sm" | "md";
}

export function PnlBadge({ value, size = "md" }: PnlBadgeProps) {
  const positive = value > 0;
  const zero = value === 0;
  const cls = positive
    ? "bg-bull-500/15 text-bull-500 border-bull-500/30"
    : zero
      ? "bg-base-700/50 text-base-300 border-base-600"
      : "bg-bear-500/15 text-bear-500 border-bear-500/30";
  const text = `${positive ? "+" : ""}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const sizeCls = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex rounded-md border font-semibold tabular ${cls} ${sizeCls}`}>
      {text}
    </span>
  );
}

interface DirectionBadgeProps {
  direction: "long" | "short";
}

export function DirectionBadge({ direction }: DirectionBadgeProps) {
  const isLong = direction === "long";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        isLong
          ? "border-bull-500/30 bg-bull-500/10 text-bull-500"
          : "border-bear-500/30 bg-bear-500/10 text-bear-500"
      }`}
    >
      {isLong ? "LONG" : "SHORT"}
    </span>
  );
}

interface ComplianceRingProps {
  score: number;
  size?: number;
}

export function ComplianceRing({ score, size = 40 }: ComplianceRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#16c784" : score >= 50 ? "#f5a623" : "#ea3943";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#242e3e"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
      <span
        className="absolute tabular text-xs font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
