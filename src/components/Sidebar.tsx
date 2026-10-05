import { LineChart, BookOpen, Ruler, BarChart3, TrendingUp, Brain, ShieldCheck, Crosshair, Download, Sparkles, CalendarClock, AlertTriangle, MessageSquare, ClipboardList, X, LogOut, Heart, Settings as SettingsIcon, Lock } from "lucide-react";

export type Page = "dashboard" | "trades" | "rules" | "analytics" | "strategy" | "coach" | "discipline" | "import" | "edge" | "plan" | "support" | "feedback-admin" | "settings";

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  netPnl: number;
  tradeCount: number;
  demoActive: boolean;
  isDemoAccount: boolean;
  onGiveFeedback: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

const PREMIUM_PAGES: Set<Page> = new Set(["analytics", "strategy", "edge", "plan", "coach"]);

const navItems: { id: Page; label: string; icon: React.ReactNode; premium?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LineChart size={20} /> },
  { id: "trades", label: "Trades", icon: <BookOpen size={20} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={20} />, premium: true },
  { id: "strategy", label: "Strategy", icon: <Crosshair size={20} />, premium: true },
  { id: "edge", label: "Edge Discovery", icon: <Sparkles size={20} />, premium: true },
  { id: "plan", label: "Tomorrow's Plan", icon: <CalendarClock size={20} />, premium: true },
  { id: "coach", label: "AI Coach", icon: <Brain size={20} />, premium: true },
  { id: "discipline", label: "Discipline", icon: <ShieldCheck size={20} /> },
  { id: "import", label: "Import", icon: <Download size={20} /> },
  { id: "rules", label: "Rules", icon: <Ruler size={20} /> },
  { id: "support", label: "Support Development", icon: <Heart size={20} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={20} /> },
];

export function Sidebar({ current, onNavigate, netPnl, tradeCount, demoActive, isDemoAccount, onGiveFeedback, mobileOpen, onCloseMobile, userEmail, onSignOut }: SidebarProps) {
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

      <div className="mx-3 rounded-xl border border-base-800 bg-base-850 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-base-400">Net P&L</p>
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

      {demoActive && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2.5">
          <AlertTriangle size={14} className="flex-shrink-0 text-warn-500" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-warn-500">Demo Data</p>
            <p className="text-[10px] leading-tight text-base-400">Sample trades — not real performance</p>
          </div>
        </div>
      )}

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const active = current === item.id;
          const locked = isDemoAccount && item.premium === true;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? item.id === "support"
                    ? "bg-bull-500/10 text-bull-400 shadow-sm"
                    : "bg-base-800 text-base-50 shadow-sm"
                  : "text-base-400 hover:bg-base-800/60 hover:text-base-200"
              } ${locked ? "opacity-60" : ""}`}
            >
              <span className={active ? (item.id === "support" ? "text-bull-400" : "text-info-400") : ""}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {locked && (
                <span className="flex items-center gap-1 rounded bg-warn-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warn-500">
                  <Lock size={9} /> Pro
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={onGiveFeedback}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-info-500/30 bg-info-500/10 px-3 py-2.5 text-xs font-semibold text-info-300 transition-all hover:border-info-400/50 hover:bg-info-500/15 hover:text-info-200"
        >
          <MessageSquare size={15} /> Send feedback
        </button>
      </nav>

      <div className="mx-3 mb-3 border-t border-base-800 pt-3">
        <div className="mb-2 flex items-center justify-center">
          <button
            onClick={() => onNavigate("feedback-admin")}
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              current === "feedback-admin" ? "text-info-400" : "text-base-500 hover:text-base-300"
            }`}
          >
            <ClipboardList size={13} /> Admin feedback
          </button>
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
