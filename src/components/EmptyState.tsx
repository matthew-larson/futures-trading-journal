import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-700 bg-base-850/50 px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-base-800 p-4 text-base-400">
        {icon ?? <Inbox size={28} />}
      </div>
      <h3 className="text-base-lg font-semibold text-base-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-base-400">{description}</p>
      )}
      {action && (
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      )}
      {!action && secondaryAction && (
        <div className="mt-5">{secondaryAction}</div>
      )}
    </div>
  );
}
