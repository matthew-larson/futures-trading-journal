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

/**
 * The Origin header is attacker-controlled for any non-browser caller, and it
 * becomes the page Stripe returns the payer to. Only accept origins this app
 * is actually served from: an explicit ALLOWED_ORIGINS secret when set,
 * otherwise the production domain plus local development.
 *
 * This deliberately does NOT suffix-match shared hosting platforms such as
 * netlify.app, vercel.app or pages.dev. Anyone can register a subdomain on
 * those in minutes, so a suffix match would let an attacker obtain a genuine
 * EdgePilot-branded Stripe session whose return URL lands on their own site.
 * Preview deployments must be added to ALLOWED_ORIGINS explicitly.
 */
const defaultAllowedOrigins = [
  "https://tradingedgepilot.com",
  "https://www.tradingedgepilot.com",
];

/** Local development only: loopback on any port. */
function isLoopback(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function isAllowedOrigin(url: URL): boolean {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const allowed = configured.length > 0 ? configured : defaultAllowedOrigins;
  const matchesAllowlist = allowed.some((o) => {
    try {
      return new URL(o).origin === url.origin;
    } catch {
      return false;
    }
  });

  return matchesAllowlist || isLoopback(url);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    // The project's anon key is itself a valid JWT published in the browser
    // bundle, so platform-level verification alone would let an anonymous
    // caller through. Resolve the token to a real end user instead.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: authUser, error: authUserError } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", "").trim()
    );
    if (authUserError || !authUser?.user) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null) return jsonResponse({ error: "Invalid request" }, 400);

    const amount = "amount" in body && typeof body.amount === "number" ? body.amount : NaN;
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return jsonResponse({ error: "Donation must be between $1 and $10,000" }, 400);
    }

    let originUrl: URL;
    try {
      originUrl = new URL(req.headers.get("origin") ?? "");
    } catch {
      return jsonResponse({ error: "Invalid checkout origin" }, 400);
    }
    if (
      !["http:", "https:"].includes(originUrl.protocol) ||
      originUrl.username ||
      originUrl.password ||
      !isAllowedOrigin(originUrl)
    ) {
      return jsonResponse({ error: "Invalid checkout origin" }, 400);
    }

    // Durable per-account rate limit: a rolling hour of at most 10 checkout
    // sessions, claimed atomically so concurrent requests cannot both pass.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      // Fail closed: without the service role key the rate limit cannot be
      // claimed, and an unlimited checkout route against a live Stripe
      // account is worse than a temporarily unavailable one.
      console.error("create-donation-checkout: service role key is not configured");
      return jsonResponse({ error: "Payments are not configured" }, 503);
    }
    {
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
      const { data: allowed, error: limitError } = await adminClient.rpc(
        "claim_donation_checkout_slot",
        { p_user_id: authUser.user.id, p_max_per_hour: 10 }
      );
      if (limitError) {
        console.error("Donation rate limit check failed", limitError);
        return jsonResponse({ error: "Unable to start checkout" }, 500);
      }
      if (allowed === false) {
        return jsonResponse(
          { error: "Too many checkout attempts. Please wait a few minutes and try again." },
          429
        );
      }
    }

    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) return jsonResponse({ error: "Payments are not configured" }, 503);

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", "EdgePilot development support");
    params.set("line_items[0][price_data][product_data][description]", "Optional contribution toward continued EdgePilot development");
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.set("line_items[0][quantity]", "1");
    params.set("submit_type", "donate");
    params.set("success_url", `${originUrl.origin}${originUrl.pathname}?donation=success`);
    params.set("cancel_url", `${originUrl.origin}${originUrl.pathname}?donation=cancelled`);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const stripeBody: unknown = await stripeResponse.json();
    if (!stripeResponse.ok || typeof stripeBody !== "object" || stripeBody === null || !("url" in stripeBody) || typeof stripeBody.url !== "string") {
      return jsonResponse({ error: "Stripe could not create checkout" }, 502);
    }

    return jsonResponse({ url: stripeBody.url });
  } catch (error) {
    console.error("Donation checkout failed", error);
    return jsonResponse({ error: "Unable to start checkout" }, 500);
  }
});
