import { LineChart, BookOpen, Ruler, BarChart3, TrendingUp, Brain, ShieldCheck, Crosshair, Download, Sparkles, CalendarClock, AlertTriangle, MessageSquare, ClipboardList, X, LogOut } from "lucide-react";

export type Page = "dashboard" | "trades" | "rules" | "analytics" | "strategy" | "coach" | "discipline" | "import" | "edge" | "plan" | "feedback-admin";

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  netPnl: number;
  tradeCount: number;
  demoActive: boolean;
  onGiveFeedback: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LineChart size={20} /> },
  { id: "trades", label: "Trades", icon: <BookOpen size={20} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={20} /> },
  { id: "strategy", label: "Strategy", icon: <Crosshair size={20} /> },
  { id: "edge", label: "Edge Discovery", icon: <Sparkles size={20} /> },
  { id: "plan", label: "Tomorrow's Plan", icon: <CalendarClock size={20} /> },
  { id: "coach", label: "AI Coach", icon: <Brain size={20} /> },
  { id: "discipline", label: "Discipline", icon: <ShieldCheck size={20} /> },
  { id: "import", label: "Import", icon: <Download size={20} /> },
  { id: "rules", label: "Rules", icon: <Ruler size={20} /> },
];

export function Sidebar({ current, onNavigate, netPnl, tradeCount, demoActive, onGiveFeedback, mobileOpen, onCloseMobile, userEmail, onSignOut }: SidebarProps) {
  const pnlPositive = netPnl > 0;
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col border-r border-base-800 bg-base-900 transition-transform duration-300 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg">
            <TrendingUp size={22} />
          </div>
          <div>
            <h1 className="text-base font-bold text-base-50">EdgePilot</h1>
            <p className="text-xs text-base-400">Discover Your Trading Edge</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-base-400 transition-colors hover:bg-base-800 hover:text-base-200 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="mt-2 flex-1 px-3">
        {navItems.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-base-800 text-base-50 shadow-sm"
                  : "text-base-400 hover:bg-base-800/60 hover:text-base-200"
              }`}
            >
              <span className={active ? "text-info-400" : ""}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {demoActive && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2.5">
          <AlertTriangle size={14} className="flex-shrink-0 text-warn-500" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-warn-500">Demo Data</p>
            <p className="text-[10px] leading-tight text-base-400">Sample trades — not real performance</p>
          </div>
        </div>
      )}

      <div className="m-3 rounded-xl border border-base-800 bg-base-850 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-base-400">
          Net P&L
        </p>
        <p
          className={`mt-1 text-xl font-bold tabular ${
            pnlPositive ? "text-bull-500" : netPnl < 0 ? "text-bear-500" : "text-base-200"
          }`}
        >
          {pnlPositive ? "+" : ""}
          {netPnl.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="mt-1 text-xs text-base-400">
          {tradeCount} {tradeCount === 1 ? "trade" : "trades"} logged
        </p>
      </div>

      <div className="mx-3 mb-3 border-t border-base-800 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={onGiveFeedback}
              className="flex items-center gap-1.5 text-[11px] font-medium text-base-500 transition-colors hover:text-base-300"
            >
              <MessageSquare size={13} /> Feedback
            </button>
            <span className="text-base-700">·</span>
            <button
              onClick={() => onNavigate("feedback-admin")}
              className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                current === "feedback-admin" ? "text-info-400" : "text-base-500 hover:text-base-300"
              }`
              }
            >
              <ClipboardList size={13} /> Admin
            </button>
          </div>
        </div>
        {userEmail && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-base-800 bg-base-850 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-base-300" title={userEmail}>{userEmail}</p>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="flex-shrink-0 rounded-md p-1.5 text-base-500 transition-colors hover:bg-base-700 hover:text-bear-500"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
