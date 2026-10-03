import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import type { Trade, TradingRule } from "@/lib/types";

interface ExportData {
  exported_at: string;
  trades: Trade[];
  trading_rules: TradingRule[];
  coach_conversations: unknown[];
  feedback: unknown[];
}

export async function exportUserData(): Promise<void> {
  const [tradesRes, rulesRes, conversationsRes, feedbackRes] = await Promise.all([
    supabase.from("trades").select("*").order("entry_time", { ascending: false }),
    supabase.from("trading_rules").select("*").order("created_at", { ascending: true }),
    supabase.from("coach_conversations").select("*").order("created_at", { ascending: false }),
    supabase.from("feedback").select("*").order("created_at", { ascending: false }),
  ]);

  const exportObject: ExportData = {
    exported_at: new Date().toISOString(),
    trades: (tradesRes.data as Trade[]) ?? [],
    trading_rules: (rulesRes.data as TradingRule[]) ?? [],
    coach_conversations: conversationsRes.data ?? [],
    feedback: feedbackRes.data ?? [],
  };

  const json = JSON.stringify(exportObject, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `edgepilot-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteAccount(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list("screenshots/");
  const files = storageError ? [] : (storageError as unknown as { data?: { name: string }[] }).data ?? [];
  if (files.length > 0) {
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(files.map((f) => `screenshots/${f.name}`));
  }

  await supabase.from("coach_conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("feedback").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("discovered_patterns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trader_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trading_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trades").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  await supabase.auth.signOut();
}
