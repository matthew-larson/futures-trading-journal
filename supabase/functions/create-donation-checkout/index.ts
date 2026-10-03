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

    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null) return jsonResponse({ error: "Invalid request" }, 400);

    const amount = "amount" in body && typeof body.amount === "number" ? body.amount : NaN;
    const originUrl = new URL(req.headers.get("origin") ?? "");
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return jsonResponse({ error: "Donation must be between $1 and $10,000" }, 400);
    }
    if (!["http:", "https:"].includes(originUrl.protocol) || originUrl.username || originUrl.password) {
      return jsonResponse({ error: "Invalid checkout origin" }, 400);
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
