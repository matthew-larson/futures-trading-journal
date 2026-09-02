import { supabase } from "@/lib/supabase";

export type FeedbackType = "general" | "bug" | "feature" | "confusing" | "insight";
export type InsightRating = "yes" | "no";

export interface FeedbackEntry {
  id: string;
  owner_id: string;
  feedback_type: FeedbackType;
  page: string | null;
  message: string | null;
  insight_id: string | null;
  trade_id: string | null;
  rating: InsightRating | null;
  created_at: string;
}

interface SubmitFeedbackParams {
  feedbackType: FeedbackType;
  page?: string;
  message?: string;
  insightId?: string;
  tradeId?: string;
  rating?: InsightRating;
}

export async function submitFeedback({
  feedbackType,
  page,
  message,
  insightId,
  tradeId,
  rating,
}: SubmitFeedbackParams): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    feedback_type: feedbackType,
    page: page ?? null,
    message: message?.trim() || null,
    insight_id: insightId ?? null,
    trade_id: tradeId ?? null,
    rating: rating ?? null,
  });
  if (error) throw error;
}

export async function fetchAllFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as FeedbackEntry[]) ?? [];
}
