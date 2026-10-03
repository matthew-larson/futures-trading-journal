import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_EMAIL = "demo@edgepilot.app";
const DEMO_PASSWORD = "EdgePilot2024!";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("ensure-demo-account: missing env vars");
      return jsonResponse({ error: "Demo account is unavailable right now." }, 503);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to update the demo user's password — if the user doesn't exist this will error
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(
      // We store the known demo user UUID hardcoded so we never need listUsers
      "b4464b14-10e8-462e-8cf2-4f2dfbe3b655",
      { password: DEMO_PASSWORD, email_confirm: true }
    );

    if (updateError) {
      // User doesn't exist (or different error) — create fresh
      console.log("ensure-demo-account: update failed, creating user:", updateError.message);
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (createError) {
        console.error("ensure-demo-account: createUser failed:", createError.message);
        return jsonResponse({ error: "Demo account is unavailable right now." }, 500);
      }
    } else {
      console.log("ensure-demo-account: password reset for", updateData?.user?.email);
    }

    return jsonResponse({ ready: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ensure-demo-account unhandled:", msg);
    return jsonResponse({ error: "Demo account is unavailable right now." }, 500);
  }
});
