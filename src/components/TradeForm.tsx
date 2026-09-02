import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, ImageIcon, AlertCircle } from "lucide-react";
import type { Trade, TradeInput, TradingRule, Direction, MarketSession, DisciplineChecks, DisciplineKey } from "@/lib/types";
import { DISCIPLINE_RULES, STRATEGY_TAGS } from "@/lib/types";
import { scoreTradeDiscipline } from "@/lib/discipline";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { toLocalInput, fromLocalInput } from "@/lib/format";

interface TradeFormProps {
  trade: Trade | null;
  rules: TradingRule[];
  onSave: (input: TradeInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError?: string | null;
}

const instruments = ["ES", "NQ", "CL", "GC", "ZN", "ZB", "RTY", "YM", "NG", "SI", "HG", "ZC", "ZS"];
const setups = ["Breakout", "Pullback", "Reversal", "Trend Continuation", "Range", "Scalp", "Momentum", "Other"];

export function TradeForm({ trade, rules, onSave, onCancel, saving, saveError }: TradeFormProps) {
  const [instrument, setInstrument] = useState(trade?.instrument ?? "ES");
  const [direction, setDirection] = useState<Direction>(trade?.direction ?? "long");
  const [entryPrice, setEntryPrice] = useState(trade?.entry_price?.toString() ?? "");
  const [exitPrice, setExitPrice] = useState(trade?.exit_price?.toString() ?? "");
  const [stopPrice, setStopPrice] = useState(trade?.stop_price?.toString() ?? "");
  const [targetPrice, setTargetPrice] = useState(trade?.target_price?.toString() ?? "");
  const [quantity, setQuantity] = useState(trade?.quantity?.toString() ?? "1");
  const [entryTime, setEntryTime] = useState(
    toLocalInput(trade?.entry_time ?? new Date().toISOString())
  );
  const [exitTime, setExitTime] = useState(toLocalInput(trade?.exit_time ?? null));
  const [pnl, setPnl] = useState(trade?.pnl?.toString() ?? "");
  const [fees, setFees] = useState(trade?.fees?.toString() ?? "0");
  const [setup, setSetup] = useState(trade?.setup ?? "");
  const [marketSession, setMarketSession] = useState<MarketSession | "">(
    trade?.market_session ?? ""
  );
  const [emotions, setEmotions] = useState(trade?.emotions ?? "");
  const [mistakes, setMistakes] = useState(trade?.mistakes ?? "");
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [screenshotPath, setScreenshotPath] = useState(trade?.screenshot_path ?? null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ruleCompliance, setRuleCompliance] = useState<Record<string, boolean>>(
    trade?.rule_compliance ?? {}
  );
  const [disciplineChecks, setDisciplineChecks] = useState<DisciplineChecks>(
    trade?.discipline_checks ?? {}
  );
  const [strategyTags, setStrategyTags] = useState<string[]>(
    trade?.strategy_tags ?? []
  );
  const [customTag, setCustomTag] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load screenshot URL if exists
  useEffect(() => {
    let cancelled = false;
    if (screenshotPath) {
      supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(screenshotPath, 3600)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error || !data?.signedUrl) {
            console.error("Failed to sign screenshot URL", error);
            setScreenshotUrl(null);
            return;
          }
          setScreenshotUrl(data.signedUrl);
        });
    } else {
      setScreenshotUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [screenshotPath]);

  const handleUpload = async (file: File) => {
    const ALLOWED_TYPES = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];
    const MAX_BYTES = 5 * 1024 * 1024;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Please choose a PNG, JPG, WEBP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("That image is larger than 5 MB. Please choose a smaller file.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `screenshots/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      // Clean up old screenshot
      if (screenshotPath && screenshotPath !== path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([screenshotPath]);
      }
      setScreenshotPath(path);
    } catch (e) {
      console.error("Screenshot upload failed", e);
      setUploadError("We couldn't upload that image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveScreenshot = async () => {
    if (screenshotPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([screenshotPath]);
    }
    setScreenshotPath(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleRule = (ruleId: string, value: boolean) => {
    setRuleCompliance((prev) => ({ ...prev, [ruleId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!instrument.trim()) {
      setFormError("Instrument is required");
      return;
    }
    if (!entryPrice || isNaN(Number(entryPrice))) {
      setFormError("A valid entry price is required");
      return;
    }
    if (!quantity || isNaN(Number(quantity))) {
      setFormError("A valid quantity is required");
      return;
    }

    const input: TradeInput = {
      instrument: instrument.trim().toUpperCase().slice(0, 32),
      direction,
      entry_price: Number(entryPrice),
      exit_price: exitPrice ? Number(exitPrice) : null,
      stop_price: stopPrice ? Number(stopPrice) : null,
      target_price: targetPrice ? Number(targetPrice) : null,
      quantity: Number(quantity),
      entry_time: fromLocalInput(entryTime),
      exit_time: exitTime ? fromLocalInput(exitTime) : null,
      pnl: pnl ? Number(pnl) : null,
      fees: Number(fees) || 0,
      setup: setup.trim().slice(0, 500) || null,
      market_session: (marketSession || null) as MarketSession | null,
      emotions: emotions.trim().slice(0, 500) || null,
      mistakes: mistakes.trim().slice(0, 500) || null,
      notes: notes.trim().slice(0, 10000) || null,
      screenshot_path: screenshotPath,
      rule_compliance: ruleCompliance,
      discipline_checks: disciplineChecks,
      strategy_tags:
        strategyTags.length > 0
          ? strategyTags.slice(0, 20).map((t) => t.slice(0, 60))
          : null,
    };

    try {
      await onSave(input);
    } catch (e) {
      console.error("Failed to save trade", e);
      setFormError("We couldn't save this trade. Please check the details and try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Core trade details */}
      <Section title="Trade Details">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Instrument" required>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className={inputCls}
            >
              {instruments.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
              {instrument && !instruments.includes(instrument) && (
                <option value={instrument}>{instrument}</option>
              )}
            </select>
          </Field>

          <Field label="Direction" required>
            <div className="flex gap-2">
              <DirButton
                active={direction === "long"}
                onClick={() => setDirection("long")}
                tone="bull"
                label="Long"
              />
              <DirButton
                active={direction === "short"}
                onClick={() => setDirection("short")}
                tone="bear"
                label="Short"
              />
            </div>
          </Field>

          <Field label="Quantity" required>
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Entry Price" required>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Exit Price">
            <input
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className={inputCls}
              placeholder="Open trade"
            />
          </Field>

          <Field label="Stop Loss">
            <input
              type="number"
              step="any"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>

          <Field label="Target">
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>

          <Field label="P&L ($)">
            <input
              type="number"
              step="any"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              className={inputCls}
              placeholder="Gross P&L"
            />
          </Field>

          <Field label="Entry Time" required>
            <input
              type="datetime-local"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Exit Time">
            <input
              type="datetime-local"
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Fees ($)">
            <input
              type="number"
              step="any"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Setup + session */}
      <Section title="Setup & Context">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Setup Type">
            <select
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className={inputCls}
            >
              <option value="">Select setup...</option>
              {setups.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Market Session">
            <select
              value={marketSession}
              onChange={(e) => setMarketSession(e.target.value as MarketSession | "")}
              className={inputCls}
            >
              <option value="">Select session...</option>
              <option value="asian">Asian</option>
              <option value="london">London</option>
              <option value="new_york">New York</option>
              <option value="overnight">Overnight</option>
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Strategy Tags">
            <p className="mb-2 text-xs text-base-400">
              Tag this trade with one or more strategies for the Strategy Explorer.
            </p>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_TAGS.map((tag) => {
                const active = strategyTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setStrategyTags((prev) =>
                        active ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "border-info-500 bg-info-500/15 text-info-400"
                        : "border-base-700 bg-base-800/50 text-base-300 hover:border-base-600 hover:text-base-100"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {strategyTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {strategyTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-info-500/10 px-2 py-0.5 text-xs text-info-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setStrategyTags((prev) => prev.filter((t) => t !== tag))
                      }
                      className="text-info-400/60 hover:text-bear-500"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = customTag.trim();
                    if (val && !strategyTags.includes(val)) {
                      setStrategyTags((prev) => [...prev, val]);
                    }
                    setCustomTag("");
                  }
                }}
                className={`${inputCls} flex-1`}
                placeholder="Add custom tag + press Enter"
              />
              <button
                type="button"
                onClick={() => {
                  const val = customTag.trim();
                  if (val && !strategyTags.includes(val)) {
                    setStrategyTags((prev) => [...prev, val]);
                  }
                  setCustomTag("");
                }}
                className="rounded-lg border border-base-600 px-3 py-2 text-xs font-medium text-base-200 transition-colors hover:bg-base-700"
              >
                Add
              </button>
            </div>
          </Field>
        </div>
      </Section>
      <Section title="Chart Screenshot">
        {screenshotUrl ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-base-700 bg-base-900">
              <img
                src={screenshotUrl}
                alt="Trade screenshot"
                className="max-h-64 w-full object-contain"
              />
              <button
                type="button"
                onClick={handleRemoveScreenshot}
                className="absolute right-2 top-2 rounded-lg bg-base-900/80 p-1.5 text-base-200 transition-colors hover:bg-bear-600 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-base-400">Screenshot uploaded. Click the X to replace it.</p>
          </div>
        ) : (
          <div>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-base-600 px-6 py-8 text-center transition-colors hover:border-base-500 hover:bg-base-800/50"
            >
              {uploading ? (
                <Loader2 size={24} className="animate-spin text-info-400" />
              ) : (
                <Upload size={24} className="text-base-400" />
              )}
              <span className="mt-2 text-sm text-base-300">
                {uploading ? "Uploading..." : "Click to upload chart screenshot"}
              </span>
              <span className="mt-1 text-xs text-base-500">PNG, JPG up to 10MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
            {uploadError && (
              <p className="mt-2 text-xs text-bear-500">{uploadError}</p>
            )}
          </div>
        )}
      </Section>

      {/* Discipline checklist */}
      <Section title="Discipline Checklist">
        <p className="mb-3 text-xs text-base-400">
          Did you follow your trading discipline? Each check contributes to your 0-100 discipline score for this trade.
        </p>
        <div className="space-y-2">
          {DISCIPLINE_RULES.map((rule) => {
            const state = disciplineChecks[rule.key];
            return (
              <div
                key={rule.key}
                className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/50 px-4 py-2.5"
              >
                <div className="pr-4">
                  <div className="text-sm font-medium text-base-100">{rule.label}</div>
                  <div className="text-xs text-base-400">{rule.description}</div>
                </div>
                <div className="flex gap-1.5">
                  <RuleButton
                    active={state === true}
                    onClick={() => setDisciplineChecks((prev) => ({ ...prev, [rule.key]: true }))}
                    tone="bull"
                    label="Yes"
                  />
                  <RuleButton
                    active={state === false}
                    onClick={() => setDisciplineChecks((prev) => ({ ...prev, [rule.key]: false }))}
                    tone="bear"
                    label="No"
                  />
                  {state !== undefined && (
                    <button
                      type="button"
                      onClick={() => {
                        setDisciplineChecks((prev) => {
                          const next = { ...prev };
                          delete next[rule.key];
                          return next;
                        });
                      }}
                      className="rounded-md px-2 py-1 text-xs text-base-500 transition-colors hover:text-base-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {Object.keys(disciplineChecks).length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-base-700 bg-base-850 px-4 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-base-400">Live discipline score</span>
            <span className={`text-lg font-bold tabular ${(() => {
              const r = scoreTradeDiscipline(disciplineChecks);
              if (r.score === null) return "text-base-400";
              if (r.score >= 90) return "text-bull-500";
              if (r.score >= 70) return "text-info-400";
              if (r.score >= 50) return "text-accent-500";
              if (r.score >= 30) return "text-warn-500";
              return "text-bear-500";
            })()}`}>
              {scoreTradeDiscipline(disciplineChecks).score ?? "—"}
            </span>
          </div>
        )}
      </Section>

      {/* Rule compliance */}
      {rules.length > 0 && (
        <Section title="Rule Compliance">
          <p className="mb-3 text-xs text-base-400">
            Mark whether this trade followed each rule. This drives your compliance score.
          </p>
          <div className="space-y-2">
            {rules.map((rule) => {
              const state = ruleCompliance[rule.id];
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/50 px-4 py-2.5"
                >
                  <div className="pr-4">
                    <div className="text-sm font-medium text-base-100">{rule.name}</div>
                    {rule.description && (
                      <div className="text-xs text-base-400">{rule.description}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <RuleButton
                      active={state === true}
                      onClick={() => toggleRule(rule.id, true)}
                      tone="bull"
                      label="Followed"
                    />
                    <RuleButton
                      active={state === false}
                      onClick={() => toggleRule(rule.id, false)}
                      tone="bear"
                      label="Violated"
                    />
                    {state !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          setRuleCompliance((prev) => {
                            const next = { ...prev };
                            delete next[rule.id];
                            return next;
                          });
                        }}
                        className="rounded-md px-2 py-1 text-xs text-base-500 transition-colors hover:text-base-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Journal */}
      <Section title="Journal Notes">
        <div className="space-y-4">
          <Field label="Emotions (e.g. calm, fomo, revenge, confident)">
            <input
              type="text"
              value={emotions}
              onChange={(e) => setEmotions(e.target.value)}
              className={inputCls}
              placeholder="How did you feel during this trade?"
            />
          </Field>
          <Field label="Mistakes">
            <textarea
              value={mistakes}
              onChange={(e) => setMistakes(e.target.value)}
              className={`${inputCls} min-h-[60px] resize-y`}
              placeholder="What went wrong? What would you do differently?"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} min-h-[80px] resize-y`}
              placeholder="Any additional observations..."
            />
          </Field>
        </div>
      </Section>

      {formError && (
        <div className="flex items-center gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-3 text-sm text-bear-500">
          <ImageIcon size={16} />
          {formError}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-base-700 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-base-600 px-5 py-2.5 text-sm font-medium text-base-200 transition-colors hover:bg-base-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {trade ? "Save Changes" : "Log Trade"}
        </button>
      </div>
      {saveError && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-2.5 text-sm text-bear-500">
          <AlertCircle size={16} className="flex-shrink-0" />
          {saveError}
        </div>
      )}
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-sm text-base-100 outline-none transition-colors focus:border-info-500 focus:ring-1 focus:ring-info-500/50 placeholder:text-base-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-base-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-base-300">
        {label}
        {required && <span className="text-bear-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function DirButton({
  active,
  onClick,
  tone,
  label,
}: {
  active: boolean;
  onClick: () => void;
  tone: "bull" | "bear";
  label: string;
}) {
  const color =
    tone === "bull"
      ? active
        ? "bg-bull-500/20 border-bull-500 text-bull-500"
        : "border-base-600 text-base-400 hover:border-base-500"
      : active
        ? "bg-bear-500/20 border-bear-500 text-bear-500"
        : "border-base-600 text-base-400 hover:border-base-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${color}`}
    >
      {label}
    </button>
  );
}

function RuleButton({
  active,
  onClick,
  tone,
  label,
}: {
  active: boolean;
  onClick: () => void;
  tone: "bull" | "bear";
  label: string;
}) {
  const color =
    tone === "bull"
      ? active
        ? "bg-bull-500/20 border-bull-500 text-bull-500"
        : "border-base-600 text-base-400 hover:border-base-500"
      : active
        ? "bg-bear-500/20 border-bear-500 text-bear-500"
        : "border-base-600 text-base-400 hover:border-base-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${color}`}
    >
      {label}
    </button>
  );
}
