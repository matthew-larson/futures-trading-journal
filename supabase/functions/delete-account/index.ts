import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
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

    // The project's anon key is itself a valid JWT published in the browser
    // bundle, so platform verification alone would let an anonymous caller
    // through. Resolve the bearer token to a real end user, and delete only
    // that user: the id is never taken from the request body.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authUser, error: authUserError } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", "").trim()
    );
    if (authUserError || !authUser?.user) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      console.error("delete-account: service role key is not configured");
      return jsonResponse({ error: "Account deletion is unavailable right now." }, 503);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUser.user.id);
    if (deleteError) {
      console.error("delete-account: deleteUser failed", deleteError);
      return jsonResponse({ error: "Account deletion failed. Please try again." }, 500);
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return jsonResponse({ error: "Account deletion failed. Please try again." }, 500);
  }
});
