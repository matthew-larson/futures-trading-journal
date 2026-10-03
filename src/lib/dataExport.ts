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

  // Collect the caller's own screenshot paths from their trades (row level
  // security already scopes this read to them) and delete the files first,
  // while the rows that point at them still exist.
  const { data: screenshotRows } = await supabase
    .from("trades")
    .select("screenshot_path")
    .not("screenshot_path", "is", null);

  const paths = Array.from(
    new Set(
      ((screenshotRows as { screenshot_path: string | null }[] | null) ?? [])
        .map((row) => row.screenshot_path)
        .filter((p): p is string => typeof p === "string" && p.length > 0)
    )
  );

  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths.slice(i, i + 100));
    if (removeError) {
      console.error("Failed to remove stored screenshots", removeError);
    }
  }

  await supabase.from("coach_conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("feedback").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("discovered_patterns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trader_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trading_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("trades").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Remove the login itself. Only the service role can delete an auth user,
  // so this runs server-side; the local session is cleared either way.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      if (!response.ok) {
        console.error("Account removal request failed", response.status);
      }
    }
  } catch (e) {
    console.error("Account removal request failed", e);
  }

  await supabase.auth.signOut();
}
