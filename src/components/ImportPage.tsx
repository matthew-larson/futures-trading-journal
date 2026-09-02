import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Zap,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Activity,
  Sparkles,
  Trash2,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { scoreTradeDiscipline } from "@/lib/discipline";
import {
  PLATFORM_PARSERS,
  type ImportSource,
  type ParseResult,
  type ParsedTrade,
} from "@/lib/importCsv";
import type { TradeInput } from "@/lib/types";
import { loadDemoData, resetDemoData, hasDemoData, DEMO_IMPORT_SOURCE } from "@/lib/demoData";

interface ImportPageProps {
  onTradesChanged: () => void;
  /** Fired when an import lands enough trades to show the Edge Discovery report. */
  onEdgeDiscovery?: (importedCount: number) => void;
  /** Whether demo data is currently loaded (for showing reset option). */
  demoActive: boolean;
}

type PlatformId = ImportSource;

interface Platform {
  id: PlatformId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  type: "csv" | "api";
  csvHint?: string;
  sampleColumns?: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "tradovate",
    name: "Tradovate",
    description: "Connect your Tradovate account and sync trades automatically via API.",
    icon: <Zap size={22} />,
    color: "from-blue-500 to-cyan-500",
    accent: "text-blue-400",
    type: "api",
  },
  {
    id: "tradingview",
    name: "TradingView",
    description: "Export your strategy tester results and import the CSV file.",
    icon: <TrendingUp size={22} />,
    color: "from-emerald-500 to-teal-500",
    accent: "text-emerald-400",
    type: "csv",
    csvHint: "tradingview_export.csv",
    sampleColumns: "Trade #, Type, Date/Time, Price, Quantity, P/L, Commission",
  },
  {
    id: "ninjatrader",
    name: "NinjaTrader",
    description: "Export your trade history from NinjaTrader and import the CSV file.",
    icon: <BarChart3 size={22} />,
    color: "from-amber-500 to-orange-500",
    accent: "text-amber-400",
    type: "csv",
    csvHint: "ninjatrader_trades.csv",
    sampleColumns: "Instrument, Type, Quantity, Entry Price, Exit Price, Entry Time, Exit Time, Profit",
  },
  {
    id: "rithmic",
    name: "Rithmic",
    description: "Export your Rithmic trade history and import the CSV file.",
    icon: <Activity size={22} />,
    color: "from-violet-500 to-purple-500",
    accent: "text-violet-400",
    type: "csv",
    csvHint: "rithmic_trades.csv",
    sampleColumns: "Trade ID, Symbol, Side, Qty, Entry Price, Exit Price, Entry Time, Exit Time, P&L",
  },
];

interface ImportProgress {
  status: "idle" | "parsing" | "saving" | "syncing" | "done" | "error";
  message: string;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: string[];
}

const initialProgress: ImportProgress = {
  status: "idle",
  message: "",
  imported: 0,
  duplicates: 0,
  invalid: 0,
  errors: [],
};

export function ImportPage({ onTradesChanged, onEdgeDiscovery, demoActive }: ImportPageProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoSuccess, setDemoSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(initialProgress);
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const [pendingTrades, setPendingTrades] = useState<ParsedTrade[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Tradovate credentials state
  const [tvUser, setTvUser] = useState("");
  const [tvPass, setTvPass] = useState("");
  const [tvMode, setTvMode] = useState<"demo" | "live">("demo");
  const [tvCid, setTvCid] = useState("");
  const [tvSec, setTvSec] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = PLATFORMS.find((p) => p.id === selectedPlatform);

  const reset = () => {
    setProgress(initialProgress);
    setParsedResult(null);
    setPendingTrades([]);
    setShowPreview(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    setDemoSuccess(null);
    try {
      const result = await loadDemoData();
      setDemoSuccess(`Loaded ${result.tradesInserted} sample trades and ${result.rulesInserted} trading rules. All features are now ready to explore.`);
      onTradesChanged();
      if (onEdgeDiscovery) {
        setTimeout(() => onEdgeDiscovery(result.tradesInserted), 500);
      }
    } catch (e) {
      console.error("Demo load failed", e);
      setDemoError("We couldn't load the sample data. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    setDemoSuccess(null);
    try {
      const count = await resetDemoData();
      setDemoSuccess(`Removed ${count} demo trades. Your real trades (if any) are untouched.`);
      onTradesChanged();
    } catch (e) {
      console.error("Demo reset failed", e);
      setDemoError("We couldn't reset the demo data. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    if (!selectedPlatform || selected?.type !== "csv") return;
    const parser = PLATFORM_PARSERS[selectedPlatform];

    setProgress({ ...initialProgress, status: "parsing", message: `Parsing ${file.name}...` });

    try {
      const text = await file.text();
      const result = parser.parse(text);
      setParsedResult(result);

      if (result.trades.length === 0) {
        setProgress({
          ...initialProgress,
          status: "error",
          message: "No valid trades found in this file.",
          errors: result.errors,
        });
        return;
      }

      setPendingTrades(result.trades);
      setShowPreview(true);
      setProgress({ ...initialProgress, status: "idle", message: "" });
    } catch (e) {
      console.error("CSV parse failed", e);
      setProgress({
        ...initialProgress,
        status: "error",
        message: "We couldn't read this file. Make sure it's a valid CSV export.",
      });
    }
  }, [selectedPlatform, selected]);

  const confirmImport = async () => {
    if (pendingTrades.length === 0) return;
    setProgress({
      ...initialProgress,
      status: "saving",
      message: `Saving ${pendingTrades.length} trades...`,
    });

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;
    const errors: string[] = [];

    for (const pt of pendingTrades) {
      try {
        // Check dedup: same source + importRef means this trade was already imported
        const { data: existing } = await supabase
          .from("trades")
          .select("id")
          .eq("import_source", pt.source)
          .eq("import_ref", pt.importRef)
          .limit(1);

        if (existing && existing.length > 0) {
          duplicates++;
          continue;
        }

        const disciplineResult = scoreTradeDiscipline(pt.input.discipline_checks);
        const payload = {
          ...pt.input,
          discipline_score: disciplineResult.score,
          import_source: pt.source,
          import_ref: pt.importRef,
        };

        const { error } = await supabase.from("trades").insert(payload);
        if (error) {
          if (error.code === "23505") {
            duplicates++;
          } else {
            errors.push(`Trade ${pt.importRef}: could not save.`);
            invalid++;
          }
        } else {
          imported++;
        }
      } catch {
        errors.push(`Trade ${pt.importRef}: unexpected error.`);
        invalid++;
      }
    }

    const summaryParts: string[] = [];
    if (imported > 0) summaryParts.push(`${imported} new trade${imported === 1 ? "" : "s"} imported`);
    if (duplicates > 0) summaryParts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`);
    if (invalid > 0) summaryParts.push(`${invalid} invalid row${invalid === 1 ? "" : "s"} skipped`);

    setProgress({
      status: imported > 0 ? "done" : "error",
      message:
        summaryParts.length > 0
          ? summaryParts.join(" · ")
          : "No new trades were imported.",
      imported,
      duplicates,
      invalid,
      errors,
    });
    setShowPreview(false);
    setPendingTrades([]);
    setParsedResult(null);
    onTradesChanged();
    if (imported >= 5 && onEdgeDiscovery) {
      onEdgeDiscovery(imported);
    }
  };

  const handleTradovateSync = async () => {
    if (!tvUser.trim() || !tvPass.trim()) return;

    setProgress({
      ...initialProgress,
      status: "syncing",
      message: "Connecting to Tradovate...",
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setProgress({ ...initialProgress, status: "error", message: "Please sign in to sync trades." });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-tradovate`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: tvUser.trim(),
          password: tvPass,
          mode: tvMode,
          cid: tvCid.trim() || undefined,
          sec: tvSec.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProgress({
          ...initialProgress,
          status: "error",
          message: data.error ?? "Could not sync with Tradovate.",
        });
        return;
      }

      setProgress({
        status: "done",
        message:
          data.imported > 0
            ? `${data.imported} new trade${data.imported === 1 ? "" : "s"} imported${data.skippedDup > 0 ? ` · ${data.skippedDup} duplicate${data.skippedDup === 1 ? "" : "s"} skipped` : ""}`
            : `No new trades found. ${data.skippedDup > 0 ? `${data.skippedDup} duplicate${data.skippedDup === 1 ? "" : "s"} skipped.` : "Your Tradovate trades may already be imported."}`,
        imported: data.imported ?? 0,
        duplicates: data.skippedDup ?? 0,
        invalid: 0,
        errors: data.errors ?? [],
      });
      onTradesChanged();
      if ((data.imported ?? 0) >= 5 && onEdgeDiscovery) {
        onEdgeDiscovery(data.imported);
      }
    } catch (e) {
      console.error("Tradovate sync failed", e);
      setProgress({
        ...initialProgress,
        status: "error",
        message: "We couldn't reach the Tradovate sync service. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform selection grid */}
      {!selectedPlatform && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-base-50">Import Trades</h2>
            <p className="mt-1 text-sm text-base-400">
              Automatically import your trade history from popular futures trading platforms.
            </p>
          </div>

          {/* Demo Mode option */}
          <div className="mb-6 overflow-hidden rounded-xl border border-info-500/30 bg-gradient-to-br from-info-500/10 to-info-700/5">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-700 text-white shadow-lg">
                  <Sparkles size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-base-50">Explore with Sample Trades</h3>
                    <span className="rounded-md border border-info-500/30 bg-info-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info-400">
                      Demo Mode
                    </span>
                  </div>
                  <p className="mt-1 max-w-md text-xs text-base-400">
                    No broker account or CSV needed. Load 150 realistic ES/MES futures trades with
                    full setup details, discipline scores, and rules — then explore every feature
                    of EdgePilot with real-looking data.
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warn-500">
                    <Info size={11} />
                    Sample data is clearly labeled as DEMO and is not real trading performance.
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 sm:items-end">
                {!demoActive ? (
                  <button
                    onClick={handleLoadDemo}
                    disabled={demoLoading}
                    className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-info-500 disabled:opacity-60"
                  >
                    {demoLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {demoLoading ? "Loading..." : "Load Sample Trades"}
                  </button>
                ) : (
                  <button
                    onClick={handleResetDemo}
                    disabled={demoLoading}
                    className="flex items-center gap-2 rounded-lg border border-bear-500/40 bg-bear-500/10 px-5 py-2.5 text-sm font-semibold text-bear-500 transition-all hover:bg-bear-500/20 disabled:opacity-60"
                  >
                    {demoLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {demoLoading ? "Resetting..." : "Reset Demo Data"}
                  </button>
                )}
              </div>
            </div>
            {demoSuccess && (
              <div className="border-t border-info-500/20 bg-bull-500/10 px-5 py-3 text-xs text-bull-500">
                <CheckCircle2 size={14} className="mr-1.5 inline" />
                {demoSuccess}
              </div>
            )}
            {demoError && (
              <div className="border-t border-bear-500/20 bg-bear-500/10 px-5 py-3 text-xs text-bear-500">
                <AlertCircle size={14} className="mr-1.5 inline" />
                {demoError}
              </div>
            )}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-base-800" />
            <span className="text-xs font-medium uppercase tracking-wider text-base-500">Or import your own</span>
            <div className="h-px flex-1 bg-base-800" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlatform(p.id);
                  reset();
                }}
                className="group flex items-start gap-4 rounded-xl border border-base-700 bg-base-850 p-5 text-left transition-all hover:border-base-600 hover:bg-base-800"
              >
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.color} text-white shadow-lg`}
                >
                  {p.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-base-50">{p.name}</h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        p.type === "api"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-base-700 text-base-300"
                      }`}
                    >
                      {p.type === "api" ? "Auto Sync" : "CSV Upload"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-base-400">{p.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-base-300 group-hover:text-base-100">
                    Get started
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platform detail view */}
      {selected && (
        <div>
          {/* Back button + header */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedPlatform(null);
                reset();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-base-300 transition-colors hover:bg-base-800"
            >
              <RefreshCw size={14} />
              Back to platforms
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${selected.color} text-white shadow-lg`}
            >
              {selected.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-base-50">{selected.name}</h2>
              <p className="text-sm text-base-400">{selected.description}</p>
            </div>
          </div>

          {/* CSV import flow */}
          {selected.type === "csv" && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="rounded-xl border border-base-700 bg-base-850 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-base-100">
                  <FileText size={16} className={selected.accent} />
                  How to export from {selected.name}
                </h3>
                <ol className="ml-4 list-decimal space-y-1.5 text-xs text-base-300">
                  <li>Open {selected.name} and navigate to your trade history or strategy tester.</li>
                  <li>Export your completed trades as a CSV file.</li>
                  <li>Upload the file below — we'll parse and preview the trades before saving.</li>
                </ol>
                {selected.sampleColumns && (
                  <div className="mt-3 rounded-lg border border-base-700 bg-base-900 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-base-400">
                      Expected columns
                    </p>
                    <p className="mt-1 font-mono text-xs text-base-200">{selected.sampleColumns}</p>
                  </div>
                )}
              </div>

              {/* Drop zone */}
              {!showPreview && progress.status !== "saving" && (
                <div>
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-base-600 px-6 py-12 text-center transition-colors hover:border-base-500 hover:bg-base-800/50"
                  >
                    {progress.status === "parsing" ? (
                      <Loader2 size={32} className="animate-spin text-info-400" />
                    ) : (
                      <Upload size={32} className="text-base-400" />
                    )}
                    <span className="mt-3 text-sm font-medium text-base-200">
                      {progress.status === "parsing" ? "Parsing..." : `Click to upload ${selected.name} CSV`}
                    </span>
                    <span className="mt-1 text-xs text-base-500">
                      {selected.csvHint ?? "Select a .csv file"}
                    </span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Parsing errors */}
              {parsedResult && parsedResult.errors.length > 0 && !showPreview && (
                <div className="rounded-xl border border-warn-500/30 bg-warn-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 text-warn-500" />
                    <div>
                      <p className="text-sm font-medium text-warn-500">
                        {parsedResult.errors.length} row{parsedResult.errors.length === 1 ? "" : "s"} had issues
                      </p>
                      <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5 text-xs text-warn-500/80">
                        {parsedResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {parsedResult.errors.length > 10 && (
                          <li>...and {parsedResult.errors.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview table */}
              {showPreview && pendingTrades.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-base-100">
                      Preview — {pendingTrades.length} trade{pendingTrades.length === 1 ? "" : "s"} found
                    </h3>
                    <button
                      onClick={reset}
                      className="text-xs text-base-400 transition-colors hover:text-base-200"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="max-h-96 overflow-auto rounded-xl border border-base-700 bg-base-900">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-base-850 text-base-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Instrument</th>
                          <th className="px-3 py-2 font-medium">Dir</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 text-right font-medium">Entry</th>
                          <th className="px-3 py-2 text-right font-medium">Exit</th>
                          <th className="px-3 py-2 text-right font-medium">P&L</th>
                          <th className="px-3 py-2 font-medium">Entry Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTrades.slice(0, 50).map((pt, i) => (
                          <tr
                            key={i}
                            className="border-t border-base-800 hover:bg-base-800/50"
                          >
                            <td className="px-3 py-2 font-medium text-base-100">
                              {pt.input.instrument}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  pt.input.direction === "long"
                                    ? "text-bull-500"
                                    : "text-bear-500"
                                }
                              >
                                {pt.input.direction === "long" ? "Long" : "Short"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular text-base-200">
                              {pt.input.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular text-base-200">
                              {pt.input.entry_price}
                            </td>
                            <td className="px-3 py-2 text-right tabular text-base-200">
                              {pt.input.exit_price ?? "—"}
                            </td>
                            <td
                              className={`px-3 py-2 text-right tabular font-medium ${
                                (pt.input.pnl ?? 0) > 0
                                  ? "text-bull-500"
                                  : (pt.input.pnl ?? 0) < 0
                                  ? "text-bear-500"
                                  : "text-base-300"
                              }`}
                            >
                              {pt.input.pnl !== null
                                ? `$${pt.input.pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-base-300">
                              {new Date(pt.input.entry_time).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pendingTrades.length > 50 && (
                      <div className="border-t border-base-800 bg-base-850 px-3 py-2 text-center text-xs text-base-400">
                        Showing first 50 of {pendingTrades.length} trades
                      </div>
                    )}
                  </div>

                  {parsedResult && parsedResult.errors.length > 0 && (
                    <p className="text-xs text-warn-500">
                      {parsedResult.errors.length} row{parsedResult.errors.length === 1 ? "" : "s"} were skipped due to parsing issues.
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={reset}
                      className="rounded-lg border border-base-600 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmImport}
                      disabled={progress.status === "saving"}
                      className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
                    >
                      {progress.status === "saving" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      {progress.status === "saving" ? "Saving..." : `Import ${pendingTrades.length} Trade${pendingTrades.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Saving progress */}
              {progress.status === "saving" && (
                <div className="flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/10 p-4">
                  <Loader2 size={20} className="animate-spin text-info-400" />
                  <p className="text-sm text-info-400">{progress.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Tradovate API sync flow */}
          {selected.type === "api" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-base-700 bg-base-850 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-base-100">
                  <Zap size={16} className={selected.accent} />
                  Connect your Tradovate account
                </h3>
                <p className="mb-4 text-xs text-base-400">
                  Enter your Tradovate credentials to automatically sync your trade history.
                  Your credentials are used only for this sync and are not stored.
                </p>

                <div className="space-y-4">
                  {/* Mode toggle */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-base-300">
                      Account type
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTvMode("demo")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          tvMode === "demo"
                            ? "border-info-500 bg-info-500/15 text-info-400"
                            : "border-base-600 text-base-400 hover:border-base-500"
                        }`}
                      >
                        Demo Account
                      </button>
                      <button
                        onClick={() => setTvMode("live")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          tvMode === "live"
                            ? "border-info-500 bg-info-500/15 text-info-400"
                            : "border-base-600 text-base-400 hover:border-base-500"
                        }`}
                      >
                        Live Account
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-base-300">
                        Tradovate username
                      </label>
                      <input
                        type="text"
                        value={tvUser}
                        onChange={(e) => setTvUser(e.target.value)}
                        className={inputCls}
                        placeholder="Your Tradovate username"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-base-300">
                        Password
                      </label>
                      <input
                        type="password"
                        value={tvPass}
                        onChange={(e) => setTvPass(e.target.value)}
                        className={inputCls}
                        placeholder="Your Tradovate password"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Optional fields */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-base-300">
                        Client ID <span className="text-base-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={tvCid}
                        onChange={(e) => setTvCid(e.target.value)}
                        className={inputCls}
                        placeholder="For API credentials"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-base-300">
                        Secret <span className="text-base-500">(optional)</span>
                      </label>
                      <input
                        type="password"
                        value={tvSec}
                        onChange={(e) => setTvSec(e.target.value)}
                        className={inputCls}
                        placeholder="For API credentials"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setSelectedPlatform(null);
                      reset();
                      setTvUser("");
                      setTvPass("");
                      setTvCid("");
                      setTvSec("");
                    }}
                    className="rounded-lg border border-base-600 px-4 py-2 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTradovateSync}
                    disabled={
                      !tvUser.trim() ||
                      !tvPass.trim() ||
                      progress.status === "syncing"
                    }
                    className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
                  >
                    {progress.status === "syncing" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    {progress.status === "syncing" ? "Syncing..." : "Sync Trades"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-base-700 bg-base-900 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-base-400">
                  How it works
                </h4>
                <ul className="space-y-1.5 text-xs text-base-300">
                  <li>1. We securely authenticate with Tradovate using your credentials.</li>
                  <li>2. Your complete fill history is downloaded and paired into round-trip trades.</li>
                  <li>3. Each trade is saved with its platform ID, so re-syncing won't create duplicates.</li>
                  <li>4. Your credentials are never stored — they're used only for this sync request.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Success / error result */}
          {(progress.status === "done" || progress.status === "error") && (
            <div
              className={`mt-6 rounded-xl border p-5 ${
                progress.status === "done"
                  ? "border-bull-500/30 bg-bull-500/10"
                  : "border-bear-500/30 bg-bear-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {progress.status === "done" ? (
                  <CheckCircle2 size={20} className="mt-0.5 text-bull-500" />
                ) : (
                  <AlertCircle size={20} className="mt-0.5 text-bear-500" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      progress.status === "done" ? "text-bull-500" : "text-bear-500"
                    }`}
                  >
                    {progress.message}
                  </p>
                  {(progress.imported > 0 || progress.duplicates > 0 || progress.invalid > 0) && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <SummaryStat label="New" value={progress.imported} tone="bull" />
                      <SummaryStat label="Duplicates skipped" value={progress.duplicates} tone="base" />
                      <SummaryStat label="Invalid skipped" value={progress.invalid} tone="bear" />
                    </div>
                  )}
                  {progress.errors.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-base-400">
                      {progress.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={reset}
                      className="rounded-lg border border-base-600 px-3 py-1.5 text-xs font-medium text-base-200 transition-colors hover:bg-base-700"
                    >
                      Import more
                    </button>
                    {progress.status === "done" && (
                      <button
                        onClick={() => {
                          setSelectedPlatform(null);
                          reset();
                        }}
                        className="rounded-lg border border-base-600 px-3 py-1.5 text-xs font-medium text-base-200 transition-colors hover:bg-base-700"
                      >
                        Back to platforms
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Syncing progress */}
          {progress.status === "syncing" && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-info-500/30 bg-info-500/10 p-4">
              <Loader2 size={20} className="animate-spin text-info-400" />
              <p className="text-sm text-info-400">{progress.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-base-100 outline-none transition-colors focus:border-info-500 focus:ring-1 focus:ring-info-500/50 placeholder:text-base-500";

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: "bull" | "bear" | "base" }) {
  const color = tone === "bull" ? "text-bull-500" : tone === "bear" ? "text-bear-500" : "text-base-300";
  return (
    <div className="rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-base-500">{label}</div>
    </div>
  );
}
