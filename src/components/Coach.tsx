import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Target,
  AlertCircle,
  Loader2,
  MessageSquare,
  Database,
  CheckCircle2,
  BarChart3,
  Trash2,
  Lightbulb,
  Activity,
  RotateCcw,
  Download,
  ExternalLink,
} from "lucide-react";
import type { Trade, TradingRule } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import type { TraderProfile } from "@/lib/traderProfile";
import { InsightFeedback } from "@/components/InsightFeedback";
import {
  ensureFreshProfile,
  loadRecentConversations,
  saveConversation,
  clearConversations,
  type ConversationRecord,
} from "@/lib/coachMemory";

interface CoachProps {
  trades: Trade[];
  rules: TradingRule[];
  onImportTrades: () => void;
  onViewSupportingTrades?: (ids: string[]) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: number;
  dataSources?: {
    tradeCount: number;
    patternCount: number;
    ruleCount: number;
    sources: string[];
  };
  supportingTradeIds?: string[];
}

const SUGGESTED_PROMPTS = [
  {
    icon: <TrendingDown size={18} />,
    title: "Why did I lose money today?",
    subtitle: "Today's loss analyzed against your patterns",
    question: "Why did I lose money today?",
  },
  {
    icon: <TrendingUp size={18} />,
    title: "Am I getting better?",
    subtitle: "Trend analysis across your history",
    question: "Am I getting better?",
  },
  {
    icon: <Target size={18} />,
    title: "What should I work on tomorrow?",
    subtitle: "Your highest-impact improvement area",
    question: "What should I work on tomorrow?",
  },
  {
    icon: <BarChart3 size={18} />,
    title: "What is my best setup?",
    subtitle: "Find your most profitable edge",
    question: "What is my best setup?",
  },
  {
    icon: <AlertCircle size={18} />,
    title: "What mistakes do I repeat?",
    subtitle: "Recurring behavioral patterns",
    question: "What mistakes do I repeat?",
  },
  {
    icon: <Shield size={18} />,
    title: "What rule costs me the most?",
    subtitle: "Quantify rule violations",
    question: "What rule costs me the most money?",
  },
];

const CLOSED_TRADE_COUNT = (trades: Trade[]) =>
  trades.filter((t) => t.exit_time !== null).length;

export function Coach({ trades, rules, onImportTrades, onViewSupportingTrades }: CoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const closedCount = CLOSED_TRADE_COUNT(trades);
  const hasTrades = closedCount > 0;

  // Load profile and conversation history on mount / when trades change
  const loadMemory = useCallback(async () => {
    if (trades.length === 0) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const [freshProfile, recentConversations] = await Promise.all([
        ensureFreshProfile(trades, rules),
        loadRecentConversations(20),
      ]);
      setProfile(freshProfile);
      setConversations(recentConversations);
    } catch (e) {
      console.error("Failed to load coach memory", e);
    } finally {
      setProfileLoading(false);
    }
  }, [trades, rules]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`;
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: trimmed,
            trades,
            rules,
            profile,
            conversations: conversations.slice(0, 10).map((c) => ({
              id: c.id,
              question: c.question,
              answer: c.answer.slice(0, 500),
              data_sources: c.data_sources,
              created_at: c.created_at,
            })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        const body = await res.json();
        if (body.error) throw new Error(body.error);
        if (!body.answer) throw new Error("No answer returned");

        const coachMsg: ChatMessage = {
          id: `c-${Date.now()}`,
          role: "coach",
          content: body.answer,
          timestamp: Date.now(),
          dataSources: body.dataSources,
          supportingTradeIds: Array.isArray(body.supportingTradeIds) ? body.supportingTradeIds : undefined,
        };
        setMessages((prev) => [...prev, coachMsg]);

        // Persist conversation to database
        saveConversation({
          question: trimmed,
          answer: body.answer,
          dataSources: body.dataSources ?? { tradeCount: closedCount, patternCount: 0, ruleCount: rules.length, sources: [] },
          profileSnapshot: profile ? {
            closedTrades: profile.closedTrades,
            currentImprovementGoal: profile.currentImprovementGoal,
            tradingStrengths: profile.tradingStrengths,
            recurringWeaknesses: profile.recurringWeaknesses,
          } : {},
        }).catch(() => {});

        // Refresh conversation list
        loadRecentConversations(20).then(setConversations).catch(() => {});
      } catch (e) {
        console.error("Coach request failed", e);
        setError("We couldn't get a response right now. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [trades, rules, profile, conversations, loading, closedCount]
  );

  const handleClearMemory = useCallback(async () => {
    await clearConversations();
    setConversations([]);
    setMessages([]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-700 text-white shadow-lg">
            <Brain size={22} />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-base-50">
              AI Coach
              {profile && (
                <span className="rounded-md border border-info-500/30 bg-info-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-info-400">
                  {profile.closedTrades} trades remembered
                </span>
              )}
              {profileLoading && (
                <span className="flex items-center gap-1 text-xs font-medium text-base-400">
                  <Loader2 size={12} className="animate-spin" /> loading memory...
                </span>
              )}
            </h1>
            <p className="mt-0.5 text-sm text-base-400">
              Persistent coach with long-term memory — answers grounded in your real data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile && (
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 py-2 text-xs font-medium text-base-300 transition-colors hover:bg-base-700"
            >
              <Database size={14} />
              Trader Profile
            </button>
          )}
          {conversations.length > 0 && (
            <button
              onClick={handleClearMemory}
              className="flex items-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 py-2 text-xs font-medium text-base-400 transition-colors hover:bg-base-700 hover:text-bear-500"
            >
              <Trash2 size={14} />
              Clear memory
            </button>
          )}
          <button
            onClick={loadMemory}
            disabled={profileLoading}
            className="flex items-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 py-2 text-xs font-medium text-base-300 transition-colors hover:bg-base-700 disabled:opacity-50"
          >
            <RotateCcw size={14} className={profileLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Profile panel */}
      {showProfile && profile && (
        <ProfilePanel profile={profile} onClose={() => setShowProfile(false)} />
      )}

      {/* Conversation history indicator */}
      {conversations.length > 0 && messages.length === 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-base-800 bg-base-850/50 px-3 py-2 text-xs text-base-400">
          <MessageSquare size={14} className="text-info-400" />
          I remember {conversations.length} previous conversation{conversations.length !== 1 ? "s" : ""} with you.
          Ask a follow-up or try a new question.
        </div>
      )}

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-base-800 bg-base-900/50 p-4 sm:p-6"
      >
        {messages.length === 0 ? (
          <EmptyState
            hasTrades={hasTrades}
            closedCount={closedCount}
            profile={profile}
            profileLoading={profileLoading}
            onPromptClick={sendQuestion}
            onImportTrades={onImportTrades}
          />
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onViewSupportingTrades={onViewSupportingTrades} />
            ))}
            {loading && <TypingIndicator />}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-4 py-3 text-sm text-bear-500">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-4 flex-shrink-0">
        <div className="flex items-end gap-3 rounded-2xl border border-base-700 bg-base-850 p-3 focus-within:border-info-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask your coach anything about your trading..."
            className="flex-1 resize-none bg-transparent text-sm text-base-100 placeholder:text-base-500 focus:outline-none"
            style={{ maxHeight: "120px" }}
            disabled={loading}
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-info-600 text-white transition-all hover:bg-info-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-base-500">
          Press Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile panel                                                      */
/* ------------------------------------------------------------------ */

function ProfilePanel({ profile, onClose }: { profile: TraderProfile; onClose: () => void }) {
  return (
    <div className="mb-4 rounded-2xl border border-info-500/20 bg-base-850 p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-info-400" />
          <h3 className="text-sm font-bold text-base-50">Your Trader Profile</h3>
          <span className="text-xs text-base-400">
            Built {new Date(profile.builtAt).toLocaleDateString()} from {profile.closedTrades} trades
          </span>
        </div>
        <button onClick={onClose} className="text-base-400 hover:text-base-200 text-xs">Hide</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Instruments */}
        {profile.primaryInstruments.length > 0 && (
          <ProfileSection title="Primary Instruments">
            {profile.primaryInstruments.map((i) => (
              <ProfileRow key={i.name} label={i.name} value={`${i.tradeCount}T · ${i.winRate.toFixed(0)}% WR`} pnl={i.netPnl} />
            ))}
          </ProfileSection>
        )}

        {/* Sessions */}
        {profile.preferredSessions.length > 0 && (
          <ProfileSection title="Preferred Sessions">
            {profile.preferredSessions.map((s) => (
              <ProfileRow key={s.name} label={s.name} value={`${s.tradeCount}T · ${s.winRate.toFixed(0)}% WR`} pnl={s.netPnl} />
            ))}
          </ProfileSection>
        )}

        {/* Best setups */}
        {profile.bestPerformingSetups.length > 0 && (
          <ProfileSection title="Best Setups" accent="bull">
            {profile.bestPerformingSetups.slice(0, 3).map((s) => (
              <ProfileRow key={s.name} label={s.name} value={`${s.tradeCount}T · ${s.winRate.toFixed(0)}% WR`} pnl={s.netPnl} />
            ))}
          </ProfileSection>
        )}

        {/* Worst setups */}
        {profile.worstPerformingSetups.length > 0 && (
          <ProfileSection title="Worst Setups" accent="bear">
            {profile.worstPerformingSetups.slice(0, 3).map((s) => (
              <ProfileRow key={s.name} label={s.name} value={`${s.tradeCount}T · ${s.winRate.toFixed(0)}% WR`} pnl={s.netPnl} />
            ))}
          </ProfileSection>
        )}

        {/* Strengths */}
        {profile.tradingStrengths.length > 0 && (
          <ProfileSection title="Strengths" accent="bull">
            {profile.tradingStrengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-base-300 py-0.5">
                <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-bull-500" />
                <span>{s}</span>
              </div>
            ))}
          </ProfileSection>
        )}

        {/* Weaknesses */}
        {profile.recurringWeaknesses.length > 0 && (
          <ProfileSection title="Recurring Weaknesses" accent="bear">
            {profile.recurringWeaknesses.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-base-300 py-0.5">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0 text-bear-500" />
                <span>{w}</span>
              </div>
            ))}
          </ProfileSection>
        )}

        {/* Risk */}
        <ProfileSection title="Risk Profile">
          <ProfileRow label="Avg position size" value={`${profile.riskPreferences.avgPositionSize.toFixed(1)} lots`} />
          {profile.riskPreferences.avgStopSize !== null && (
            <ProfileRow label="Avg stop size" value={`${profile.riskPreferences.avgStopSize.toFixed(2)} pts`} />
          )}
          {profile.riskPreferences.avgRRRatio !== null && (
            <ProfileRow label="Avg R:R ratio" value={`${profile.riskPreferences.avgRRRatio.toFixed(1)}:1`} />
          )}
          {profile.riskPreferences.noStopCount > 0 && (
            <ProfileRow label="Trades without stop" value={`${profile.riskPreferences.noStopCount}`} pnl={profile.riskPreferences.noStopPnl} />
          )}
        </ProfileSection>

        {/* Discipline */}
        {profile.disciplinePatterns.avgDisciplineScore !== null && (
          <ProfileSection title="Discipline">
            <ProfileRow label="Avg discipline score" value={`${profile.disciplinePatterns.avgDisciplineScore.toFixed(0)}/100`} />
            <ProfileRow label="High-discipline trades" value={`${profile.disciplinePatterns.highDisciplineTrades}T · ${profile.disciplinePatterns.highDisciplineWinRate.toFixed(0)}% WR`} pnl={profile.disciplinePatterns.highDisciplineExpectancy * profile.disciplinePatterns.highDisciplineTrades} />
            <ProfileRow label="Low-discipline trades" value={`${profile.disciplinePatterns.lowDisciplineTrades}T · ${profile.disciplinePatterns.lowDisciplineWinRate.toFixed(0)}% WR`} pnl={profile.disciplinePatterns.lowDisciplineExpectancy * profile.disciplinePatterns.lowDisciplineTrades} />
          </ProfileSection>
        )}

        {/* Psychology */}
        {profile.psychologicalPatterns.emotionalTradeCount > 0 && (
          <ProfileSection title="Psychology" accent="bear">
            <ProfileRow label="Emotional trades" value={`${profile.psychologicalPatterns.emotionalTradeCount}T · ${profile.psychologicalPatterns.emotionalWinRate.toFixed(0)}% WR`} pnl={profile.psychologicalPatterns.emotionalPnl} />
            {profile.psychologicalPatterns.revengeTrades > 0 && (
              <ProfileRow label="Revenge trades" value={`${profile.psychologicalPatterns.revengeTrades}T`} pnl={profile.psychologicalPatterns.revengePnl} />
            )}
            {profile.psychologicalPatterns.fomoTrades > 0 && (
              <ProfileRow label="FOMO trades" value={`${profile.psychologicalPatterns.fomoTrades}T`} pnl={profile.psychologicalPatterns.fomoPnl} />
            )}
          </ProfileSection>
        )}

        {/* Improvement goal */}
        {profile.currentImprovementGoal && (
          <ProfileSection title="Current Improvement Goal" accent="accent">
            <div className="flex items-start gap-2 text-xs text-base-200 py-0.5">
              <Target size={12} className="mt-0.5 flex-shrink-0 text-accent-400" />
              <span>{profile.currentImprovementGoal}</span>
            </div>
          </ProfileSection>
        )}

        {/* Patterns count */}
        <ProfileSection title="Discovered Patterns">
          <ProfileRow label="Active patterns" value={`${profile.discoveredPatterns.length}`} />
          <ProfileRow label="Edge Discovery" value={profile.edgeDiscoveryReady ? "Ready" : "Needs more data"} />
        </ProfileSection>

        {/* Performance trend */}
        {profile.performanceTrend.length > 0 && (
          <ProfileSection title="Performance Trend">
            {profile.performanceTrend.map((t) => (
              <div key={t.label} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-base-300">{t.label}</span>
                <span className={`flex items-center gap-1 font-medium ${t.improving ? "text-bull-500" : "text-bear-500"}`}>
                  {t.improving ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {t.change}
                </span>
              </div>
            ))}
          </ProfileSection>
        )}
      </div>
    </div>
  );
}

function ProfileSection({ title, accent, children }: { title: string; accent?: "bull" | "bear" | "accent"; children: React.ReactNode }) {
  const color = accent === "bull" ? "text-bull-500" : accent === "bear" ? "text-bear-500" : accent === "accent" ? "text-accent-400" : "text-base-300";
  return (
    <div className="rounded-lg border border-base-700/50 bg-base-900/40 p-3">
      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wider ${color}`}>{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ProfileRow({ label, value, pnl }: { label: string; value: string; pnl?: number }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-base-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-base-200">{value}</span>
        {pnl !== undefined && (
          <span className={`tabular font-medium ${pnl >= 0 ? "text-bull-500" : "text-bear-500"}`}>
            {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasTrades,
  closedCount,
  profile,
  profileLoading,
  onPromptClick,
  onImportTrades,
}: {
  hasTrades: boolean;
  closedCount: number;
  profile: TraderProfile | null;
  profileLoading: boolean;
  onPromptClick: (q: string) => void;
  onImportTrades: () => void;
}) {
  if (!hasTrades) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-base-800 to-base-850 border border-base-700">
          <Brain size={36} className="text-base-400" />
        </div>
        <h2 className="text-lg font-semibold text-base-200">Your AI Coach is ready</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-base-400">
          Once you log some trades, I'll build a Trader Profile with long-term memory of your
          patterns, strengths, weaknesses, and rules. Every answer will be grounded in your real data.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={onImportTrades}
            className="flex items-center gap-2 rounded-lg bg-info-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500"
          >
            <Download size={16} /> Import My Trades
          </button>
          <button
            onClick={onImportTrades}
            className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800 px-5 py-2.5 text-sm font-semibold text-base-200 transition-colors hover:bg-base-700"
          >
            <Sparkles size={16} /> Try Demo Data
          </button>
        </div>
        <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <div
              key={p.title}
              className="flex items-center gap-3 rounded-xl border border-base-800 bg-base-850/50 px-4 py-3 opacity-50"
            >
              <span className="text-base-500">{p.icon}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-base-300">{p.title}</p>
                <p className="text-xs text-base-500">{p.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-info-500/20 to-info-700/20 border border-info-500/30">
        <Sparkles size={36} className="text-info-400" />
      </div>
      <h2 className="text-lg font-semibold text-base-100">Ask me anything</h2>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-base-400">
        {profileLoading
          ? "Loading your Trader Profile and conversation history..."
          : `I've analyzed all ${closedCount} of your closed trades${profile ? ` and remember ${profile.discoveredPatterns.length} discovered patterns` : ""}. Every answer is grounded in your verified data.`}
      </p>
      {profile && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {profile.tradingStrengths.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-bull-500/20 bg-bull-500/10 px-2 py-1 text-xs text-bull-500">
              <CheckCircle2 size={12} /> {profile.tradingStrengths.length} strengths
            </span>
          )}
          {profile.recurringWeaknesses.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-bear-500/20 bg-bear-500/10 px-2 py-1 text-xs text-bear-500">
              <AlertCircle size={12} /> {profile.recurringWeaknesses.length} weaknesses
            </span>
          )}
          {profile.tradingRules.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-info-500/20 bg-info-500/10 px-2 py-1 text-xs text-info-400">
              <Shield size={12} /> {profile.tradingRules.length} rules tracked
            </span>
          )}
          {profile.performanceTrend.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-accent-400/20 bg-accent-400/10 px-2 py-1 text-xs text-accent-400">
              <Activity size={12} /> Trend tracked
            </span>
          )}
        </div>
      )}
      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.title}
            onClick={() => onPromptClick(p.question)}
            className="group flex items-center gap-3 rounded-xl border border-base-700 bg-base-850 px-4 py-3 text-left transition-all hover:border-info-500/40 hover:bg-base-800"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-base-800 text-base-400 transition-colors group-hover:bg-info-500/15 group-hover:text-info-400">
              {p.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-base-100">{p.title}</p>
              <p className="text-xs text-base-400">{p.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Message bubble                                                     */
/* ------------------------------------------------------------------ */

function MessageBubble({ message, onViewSupportingTrades }: { message: ChatMessage; onViewSupportingTrades?: (ids: string[]) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}>
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? "bg-base-700 text-base-300"
            : "bg-gradient-to-br from-info-500 to-info-700 text-white shadow-md"
        }`}
      >
        {isUser ? <MessageSquare size={16} /> : <Brain size={16} />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "" : "w-full max-w-2xl"}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-base-700/60 text-base-100 rounded-tr-sm"
              : "bg-base-850 border border-base-800 text-base-200 rounded-tl-sm"
          }`}
        >
          <FormattedContent content={message.content} />
        </div>
        {/* Data source indicator */}
        {!isUser && message.dataSources && (
          <DataSourceBadge dataSources={message.dataSources} />
        )}
        {!isUser && (
          <InsightFeedback insightId={message.id} page="coach" />
        )}
        {!isUser && message.supportingTradeIds && message.supportingTradeIds.length > 0 && onViewSupportingTrades && (
          <button
            onClick={() => onViewSupportingTrades(message.supportingTradeIds!)}
            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-info-400 transition-colors hover:text-info-300"
          >
            <ExternalLink size={11} />
            View {message.supportingTradeIds.length} supporting trade{message.supportingTradeIds.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data source badge                                                  */
/* ------------------------------------------------------------------ */

function DataSourceBadge({ dataSources }: { dataSources: NonNullable<ChatMessage["dataSources"]> }) {
  const sources = dataSources.sources ?? [];
  if (sources.length === 0) return null;

  const sourceConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    verified_data: { label: "Verified Data", icon: <Database size={11} />, color: "text-bull-500 bg-bull-500/10 border-bull-500/20" },
    strong_pattern: { label: "Strong Pattern", icon: <CheckCircle2 size={11} />, color: "text-accent-400 bg-accent-400/10 border-accent-400/20" },
    emerging_pattern: { label: "Emerging Pattern", icon: <Activity size={11} />, color: "text-info-400 bg-info-500/10 border-info-500/20" },
    trend_analysis: { label: "Trend Analysis", icon: <TrendingUp size={11} />, color: "text-info-400 bg-info-500/10 border-info-500/20" },
    ai_interpretation: { label: "AI Interpretation", icon: <Lightbulb size={11} />, color: "text-warn-500 bg-warn-500/10 border-warn-500/20" },
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium text-base-500">
        Based on {dataSources.tradeCount} trade{dataSources.tradeCount !== 1 ? "s" : ""}
        {dataSources.patternCount > 0 && ` · ${dataSources.patternCount} patterns`}
        {dataSources.ruleCount > 0 && ` · ${dataSources.ruleCount} rules`} ·
      </span>
      {sources.map((s) => {
        const cfg = sourceConfig[s] ?? sourceConfig.ai_interpretation;
        return (
          <span
            key={s}
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.color}`}
          >
            {cfg.icon}
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formatted content                                                  */
/* ------------------------------------------------------------------ */

function FormattedContent({ content }: { content: string }) {
  const paragraphs = content.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (trimmed.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-base-500" />
              <span>{formatBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.slice(2, -2).includes("**")) {
          return (
            <p key={i} className="font-semibold text-base-100">
              {trimmed.slice(2, -2)}
            </p>
          );
        }
        if (trimmed.startsWith("_") && trimmed.endsWith("_")) {
          return (
            <p key={i} className="text-xs italic text-base-500">
              {trimmed.slice(1, -1)}
            </p>
          );
        }
        return <p key={i}>{formatBold(trimmed)}</p>;
      })}
    </div>
  );
}

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-base-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-info-500 to-info-700 text-white shadow-md">
        <Brain size={16} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-base-800 bg-base-850 px-4 py-4">
        <span className="h-2 w-2 animate-bounce rounded-full bg-base-500 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-base-500 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-base-500" />
      </div>
    </div>
  );
}
