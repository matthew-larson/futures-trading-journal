export type Direction = "long" | "short";
export type MarketSession = "asian" | "london" | "new_york" | "overnight";
export type RuleCategory =
  | "risk"
  | "entry"
  | "exit"
  | "psychology"
  | "timing"
  | "general";

export type RiskRating = "low" | "moderate" | "high";

export interface Trade {
  id: string;
  instrument: string;
  direction: Direction;
  entry_price: number;
  exit_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  quantity: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  fees: number;
  setup: string | null;
  market_session: MarketSession | null;
  emotions: string | null;
  mistakes: string | null;
  notes: string | null;
  screenshot_path: string | null;
  rule_compliance: Record<string, boolean>;
  discipline_checks: DisciplineChecks;
  discipline_score: number | null;
  strategy_tags: string[] | null;
  ai_analysis: AiAnalysis | null;
  created_at: string;
  updated_at: string;
}

export interface AiAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  riskRating: RiskRating;
  patternRecognition: string[];
  grade: TradeGrade;
  scores: TradeScores;
  coaching: {
    whatYouDidWell: string[];
    mistakes: string[];
    howToImprove: string[];
    whatToRepeat: string[];
  };
  timeline: {
    entry: string;
    management: string;
    exit: string;
  };
}

export type TradeGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";

export interface TradeScores {
  setupQuality: number;
  entryTiming: number;
  exitTiming: number;
  riskManagement: number;
  emotionalDiscipline: number;
  ruleCompliance: number;
}

export interface TradingRule {
  id: string;
  name: string;
  description: string | null;
  category: RuleCategory;
  is_active: boolean;
  created_at: string;
}

export interface TradeInput {
  instrument: string;
  direction: Direction;
  entry_price: number;
  exit_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  quantity: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  fees: number;
  setup: string | null;
  market_session: MarketSession | null;
  emotions: string | null;
  mistakes: string | null;
  notes: string | null;
  screenshot_path: string | null;
  rule_compliance: Record<string, boolean>;
  discipline_checks: DisciplineChecks;
  strategy_tags: string[] | null;
}

export interface RuleInput {
  name: string;
  description: string | null;
  category: RuleCategory;
  is_active: boolean;
}

export type DisciplineKey =
  | "waited_for_confirmation"
  | "risk_under_plan"
  | "traded_plan_hours"
  | "did_not_chase"
  | "did_not_revenge_trade"
  | "held_winner_correctly"
  | "exited_per_plan";

export type DisciplineChecks = Partial<Record<DisciplineKey, boolean>>;

export interface DisciplineRuleDef {
  key: DisciplineKey;
  label: string;
  description: string;
  weight: number;
}

export const STRATEGY_TAGS: string[] = [
  "Opening Range Breakout",
  "Liquidity Sweep",
  "FVG",
  "VWAP Reversal",
  "Trend Pullback",
  "EMA Bounce",
  "News Trade",
  "Breakout",
  "Reversal",
  "Momentum",
  "Scalp",
  "Range",
  "Trend Continuation",
  "Pullback",
  "Other",
];

export const DISCIPLINE_RULES: DisciplineRuleDef[] = [
  { key: "waited_for_confirmation", label: "Waited for confirmation", description: "Waited for your setup to confirm before entering", weight: 15 },
  { key: "risk_under_plan", label: "Risk stayed under plan", description: "Position size and stop kept risk within your plan", weight: 15 },
  { key: "traded_plan_hours", label: "Entered during plan hours", description: "Only traded during your planned trading window", weight: 10 },
  { key: "did_not_chase", label: "Did not chase", description: "Let the entry come to you instead of chasing price", weight: 15 },
  { key: "did_not_revenge_trade", label: "Did not revenge trade", description: "No impulsive re-entry after a loss", weight: 15 },
  { key: "held_winner_correctly", label: "Held winner correctly", description: "Let the winner run to target or a planned exit", weight: 15 },
  { key: "exited_per_plan", label: "Exited according to plan", description: "Closed the trade for the reason you planned, not emotion", weight: 15 },
];

export interface DisciplineScoreResult {
  score: number | null;
  followed: number;
  total: number;
  checks: DisciplineChecks;
}

export interface PeriodScore {
  label: string;
  score: number;
  tradeCount: number;
  perfectCount: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

/* ------------------------------------------------------------------ */
/* Edge Discovery Engine — pattern types                              */
/* ------------------------------------------------------------------ */

export type PatternCategory =
  | "strength"
  | "weakness"
  | "opportunity"
  | "behavioral_leak"
  | "risk_pattern"
  | "time_effect"
  | "trend";

export type PatternDimension =
  | "instrument"
  | "direction"
  | "strategy"
  | "setup"
  | "entry_time"
  | "exit_time"
  | "day_of_week"
  | "session"
  | "holding_time"
  | "r_multiple"
  | "win_loss"
  | "position_size"
  | "stop_size"
  | "target_size"
  | "rule_compliance"
  | "discipline_score"
  | "emotional_tag"
  | "trade_grade"
  | "consecutive_wins"
  | "consecutive_losses"
  | "combination";

export type ConfidenceTier = "emerging" | "strong" | "high_confidence";

export interface DiscoveredPattern {
  id: string;
  pattern_key: string;
  category: PatternCategory;
  dimension: PatternDimension;
  label: string;
  description: string;
  recommended_action: string;
  trade_count: number;
  win_rate: number | null;
  net_pnl: number | null;
  avg_r: number | null;
  expectancy: number | null;
  confidence_score: number;
  confidence_tier: ConfidenceTier;
  estimated_pnl_impact: number;
  is_active: boolean;
  supporting_trade_ids: string[];
  first_seen_at: string;
  last_verified_at: string;
  degradation_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredPatternInput {
  pattern_key: string;
  category: PatternCategory;
  dimension: PatternDimension;
  label: string;
  description: string;
  recommended_action: string;
  trade_count: number;
  win_rate: number | null;
  net_pnl: number | null;
  avg_r: number | null;
  expectancy: number | null;
  confidence_score: number;
  confidence_tier: ConfidenceTier;
  estimated_pnl_impact: number;
  is_active: boolean;
  supporting_trade_ids: string[];
  degradation_note: string | null;
}
