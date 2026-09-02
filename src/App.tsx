import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Loader2, AlertCircle, TrendingUp, Menu } from "lucide-react";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Auth } from "@/components/Auth";
import type { Trade, TradingRule, TradeInput, RuleInput } from "@/lib/types";
import { computeStats } from "@/lib/stats";
import { scoreTradeDiscipline } from "@/lib/discipline";
import { Sidebar, type Page } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { TradeList } from "@/components/TradeList";
import { TradeDetail } from "@/components/TradeDetail";
import { TradeForm } from "@/components/TradeForm";
import { RulesManager } from "@/components/RulesManager";
import { Analytics } from "@/components/Analytics";
import { StrategyExplorer } from "@/components/StrategyExplorer";
import { ImportPage } from "@/components/ImportPage";
import { EdgeDiscovery } from "@/components/EdgeDiscovery";
import { EdgeDiscoveryReport } from "@/components/EdgeDiscoveryReport";
import { persistDiscoveredPatterns } from "@/lib/edgePersistence";
import { hasDemoData, DEMO_IMPORT_SOURCE } from "@/lib/demoData";
import { TomorrowsPlan } from "@/components/TomorrowsPlan";
import { Coach } from "@/components/Coach";
import { Discipline as DisciplineComponent } from "@/components/Discipline";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackModal } from "@/components/FeedbackModal";
import { FeedbackAdmin } from "@/components/FeedbackAdmin";

export default function App() {
  const { user, authState, signOut } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [viewingTradeId, setViewingTradeId] = useState<string | null>(null);
  const [savingTrade, setSavingTrade] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTradeId, setDeleteTradeId] = useState<string | null>(null);
  const [showEdgeDiscovery, setShowEdgeDiscovery] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = useCallback(async () => {
    // Don't query before there is a session: every table is owner-scoped, so an
    // unauthenticated read is guaranteed to be denied.
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [tradesRes, rulesRes] = await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .order("entry_time", { ascending: false }),
        supabase
          .from("trading_rules")
          .select("*")
          .order("created_at", { ascending: true }),
      ]);
      if (tradesRes.error) throw tradesRes.error;
      if (rulesRes.error) throw rulesRes.error;
      setTrades((tradesRes.data as Trade[]) ?? []);
      setRules((rulesRes.data as TradingRule[]) ?? []);
      // Check if demo data is present
      const demoCount = (tradesRes.data as Trade[])?.filter(
        (t) => (t as any).import_source === DEMO_IMPORT_SOURCE
      ).length ?? 0;
      setDemoActive(demoCount > 0);
    } catch (e) {
      console.error("Failed to load data", e);
      setLoadError("We couldn't load your trading data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const editingTrade = useMemo(
    () => trades.find((t) => t.id === editingTradeId) ?? null,
    [trades, editingTradeId]
  );
  const viewingTrade = useMemo(
    () => trades.find((t) => t.id === viewingTradeId) ?? null,
    [trades, viewingTradeId]
  );

  const stats = useMemo(() => computeStats(trades), [trades]);

  // Trade CRUD
  const handleSaveTrade = async (input: TradeInput) => {
    setSavingTrade(true);
    setSaveError(null);
    try {
      const disciplineResult = scoreTradeDiscipline(input.discipline_checks);
      const payload = {
        ...input,
        discipline_score: disciplineResult.score,
      };
      if (editingTradeId) {
        const { error } = await supabase
          .from("trades")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingTradeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trades").insert(payload);
        if (error) throw error;
      }
      await loadData();
      setFormOpen(false);
      setEditingTradeId(null);
    } catch (e) {
      console.error("Failed to save trade", e);
      setSaveError("We couldn't save this trade. Please try again.");
    } finally {
      setSavingTrade(false);
    }
  };

  const handleDeleteTrade = async () => {
    if (!deleteTradeId) return;
    const trade = trades.find((t) => t.id === deleteTradeId);
    try {
      // Remove screenshot from storage
      if (trade?.screenshot_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([trade.screenshot_path]);
      }
      const { error } = await supabase.from("trades").delete().eq("id", deleteTradeId);
      if (error) throw error;
      setDeleteTradeId(null);
      if (viewingTradeId === deleteTradeId) setViewingTradeId(null);
      await loadData();
    } catch (e) {
      console.error("Failed to delete trade", e);
      setLoadError("We couldn't delete that trade. Please try again.");
      setDeleteTradeId(null);
    }
  };

  // Rule CRUD
  const handleAddRule = async (input: RuleInput) => {
    const { error } = await supabase.from("trading_rules").insert(input);
    if (error) throw error;
    await loadData();
  };

  const handleUpdateRule = async (id: string, input: RuleInput) => {
    const { error } = await supabase
      .from("trading_rules")
      .update(input)
      .eq("id", id);
    if (error) throw error;
    await loadData();
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from("trading_rules").delete().eq("id", id);
    if (error) throw error;
    await loadData();
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("trading_rules")
      .update({ is_active: active })
      .eq("id", id);
    if (error) throw error;
    await loadData();
  };

  const handleRuleError = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      console.error("Rule operation failed", e);
      setLoadError("We couldn't complete that action. Please try again.");
    }
  };

  const goToImport = useCallback(() => setPage("import"), []);

  const openAddTrade = () => {
    setEditingTradeId(null);
    setFormOpen(true);
  };

  const openEditTrade = (id: string) => {
    setViewingTradeId(null);
    setEditingTradeId(id);
    setFormOpen(true);
  };

  const viewTrade = (id: string) => {
    setViewingTradeId(id);
  };

  // Auth states: show loading screen, auth screen, or app
  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <div className="flex flex-col items-center gap-3 text-base-400">
          <Loader2 size={32} className="animate-spin text-info-400" />
          <p className="text-sm">Loading EdgePilot...</p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated" || !user) {
    return <Auth onAuthenticated={() => {}} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <div className="flex flex-col items-center gap-3 text-base-400">
          <Loader2 size={32} className="animate-spin text-info-400" />
          <p className="text-sm">Loading EdgePilot...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError && trades.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 p-6">
        <div className="max-w-md rounded-xl border border-bear-500/30 bg-bear-500/10 p-6 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-bear-500" />
          <h2 className="text-lg font-semibold text-base-50">Connection error</h2>
          <p className="mt-2 text-sm text-base-300">{loadError}</p>
          <button
            onClick={loadData}
            className="mt-4 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base-950">
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-base-800 bg-base-900 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-info-500 to-info-600 text-white">
            <TrendingUp size={18} />
          </div>
          <span className="text-sm font-bold text-base-50">EdgePilot</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg border border-base-700 p-2 text-base-300 transition-colors hover:bg-base-800"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        current={page}
        onNavigate={(p) => {
          setPage(p);
          setViewingTradeId(null);
          setHighlightIds(null);
          setSidebarOpen(false);
        }}
        netPnl={stats.netPnl}
        tradeCount={trades.length}
        demoActive={demoActive}
        onGiveFeedback={() => setFeedbackOpen(true)}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        userEmail={user.email ?? null}
        onSignOut={signOut}
      />

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Page header with action */}
          {page !== "rules" && !viewingTradeId && page !== "import" && page !== "edge" && page !== "plan" && (
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-base-50">
                  {page === "dashboard" && "Dashboard"}
                  {page === "trades" && "Trade Journal"}
                  {page === "analytics" && "Analytics"}
                  {page === "coach" && "AI Coach"}
                  {page === "discipline" && "Discipline Score"}
                </h1>
                <p className="mt-0.5 text-sm text-base-400">
                  {page === "dashboard" && "Overview of your trading performance and expectancy"}
                  {page === "trades" && "All your logged futures trades"}
                  {page === "analytics" && "Breakdown of performance by instrument, session, and rules"}
                  {page === "strategy" && "Analyze performance by strategy tag, time of day, and day of week"}
                  {page === "coach" && "Ask questions and get insights grounded in your real trade data"}
                  {page === "discipline" && "Track your trading discipline and unlock achievements"}
                </p>
              </div>
              {page === "trades" && (
                <button
                  onClick={openAddTrade}
                  className="hidden items-center gap-2 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500 sm:flex"
                >
                  <Plus size={18} /> Log Trade
                </button>
              )}
            </div>
          )}

          {loadError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-2 text-sm text-bear-500">
              <AlertCircle size={16} />
              {loadError}
            </div>
          )}

          {/* Content */}
          {viewingTrade && page === "trades" ? (
            <TradeDetail
              trade={viewingTrade}
              rules={rules}
              onBack={() => setViewingTradeId(null)}
              onEdit={() => openEditTrade(viewingTrade.id)}
              onDelete={() => setDeleteTradeId(viewingTrade.id)}
            />
          ) : (
            <>
              {page === "dashboard" && (
                <Dashboard
                  trades={trades}
                  rules={rules}
                  onAddTrade={openAddTrade}
                  onViewTrade={(id) => {
                    setPage("trades");
                    viewTrade(id);
                  }}
                  onViewSupportingTrades={(ids) => {
                    setHighlightIds(ids);
                    setPage("trades");
                    setViewingTradeId(null);
                  }}
                />
              )}
              {page === "trades" && (
                <TradeList
                  trades={trades}
                  rules={rules}
                  onAddTrade={openAddTrade}
                  onEditTrade={openEditTrade}
                  onViewTrade={viewTrade}
                  onDeleteTrade={(id) => setDeleteTradeId(id)}
                  onImportTrades={goToImport}
                  highlightIds={highlightIds}
                  onClearHighlight={() => setHighlightIds(null)}
                />
              )}
              {page === "analytics" && <Analytics trades={trades} rules={rules} onImportTrades={goToImport} />}
              {page === "strategy" && <StrategyExplorer trades={trades} onImportTrades={goToImport} />}
              {page === "import" && (
                <ImportPage
                  onTradesChanged={loadData}
                  demoActive={demoActive}
                  onEdgeDiscovery={() => {
                    persistDiscoveredPatterns(trades).catch(() => {});
                    setTimeout(() => setShowEdgeDiscovery(true), 400);
                  }}
                />
              )}
              {page === "edge" && <EdgeDiscovery trades={trades} onImportTrades={goToImport} />}
              {page === "plan" && <TomorrowsPlan trades={trades} rules={rules} onImportTrades={goToImport} />}
              {page === "coach" && (
                <Coach
                  trades={trades}
                  rules={rules}
                  onImportTrades={goToImport}
                  onViewSupportingTrades={(ids) => {
                    setHighlightIds(ids);
                    setPage("trades");
                    setViewingTradeId(null);
                  }}
                />
              )}
              {page === "discipline" && <DisciplineComponent trades={trades} onImportTrades={goToImport} />}
              {page === "feedback-admin" && (
                <FeedbackAdmin onBack={() => setPage("dashboard")} />
              )}
              {page === "rules" && (
                <RulesManager
                  rules={rules}
                  onAdd={(input) => handleRuleError(() => handleAddRule(input))}
                  onUpdate={(id, input) => handleRuleError(() => handleUpdateRule(id, input))}
                  onDelete={(id) => handleRuleError(() => handleDeleteRule(id))}
                  onToggle={(id, active) => handleRuleError(() => handleToggleRule(id, active))}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Trade form modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTradeId(null);
          setSaveError(null);
        }}
        title={editingTradeId ? "Edit Trade" : "Log New Trade"}
        subtitle={
          editingTradeId
            ? "Update the trade details and journal notes"
            : "Record your futures trade with full context"
        }
        size="xl"
      >
        <TradeForm
          trade={editingTrade}
          rules={rules}
          onSave={handleSaveTrade}
          onCancel={() => {
            setFormOpen(false);
            setEditingTradeId(null);
            setSaveError(null);
          }}
          saving={savingTrade}
          saveError={saveError}
        />
      </Modal>

      {/* Delete trade confirmation */}
      <ConfirmDialog
        open={!!deleteTradeId}
        title="Delete trade?"
        message="This trade will be permanently removed along with its screenshot. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDeleteTrade}
        onCancel={() => setDeleteTradeId(null)}
      />

      {showEdgeDiscovery && (
        <EdgeDiscoveryReport
          trades={trades}
          onClose={() => setShowEdgeDiscovery(false)}
        />
      )}

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        currentPage={page}
      />
    </div>
  );
}
