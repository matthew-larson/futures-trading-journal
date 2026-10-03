import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const demoEmail = "demo@edgepilot.app";
const demoPassword = "EdgePilot2024!";

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
      console.error("ensure-demo-account: service role key is not configured");
      return jsonResponse({ error: "Demo account is unavailable right now." }, 503);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.users.find((user) => user.email?.toLowerCase() === demoEmail);
    if (existingUser) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: demoPassword,
        email_confirm: true,
      });
      if (updateError) throw updateError;
    } else {
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
      });
      if (createError) throw createError;
    }

    return jsonResponse({ ready: true });
  } catch (error) {
    console.error("ensure-demo-account failed", error);
    return jsonResponse({ error: "Demo account is unavailable right now." }, 500);
  }
});
