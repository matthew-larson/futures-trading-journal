import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradovateFill {
  id: number;
  tradeDate: string;
  contractId: string;
  side: string; // "Buy" | "Sell"
  qty: number;
  price: number;
  orderId: number;
}

interface TradovateContract {
  id: string;
  name: string;
  displayName: string;
  tickSize: number;
}

interface PairedTrade {
  instrument: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  fees: number;
  importRef: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Authenticate the caller BEFORE any credential is used to contact the
    // brokerage, so this endpoint can never act as an unattributed
    // credential-testing proxy.
    //
    // The token must be VERIFIED, not merely present: the project's anon key is
    // itself a valid JWT and is published in the browser bundle, so a prefix
    // check would let anyone through. auth.getUser() resolves the token to a
    // real end user and fails for the anon key, which carries no user identity.
    const callerAuthHeader = req.headers.get("Authorization");
    if (!callerAuthHeader || !callerAuthHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userToken = callerAuthHeader.replace("Bearer ", "").trim();

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: authUser, error: authUserError } = await authClient.auth.getUser(userToken);
    if (authUserError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const {
      username,
      password,
      appId = "trade-journal",
      appVersion = "1.0",
      cid,
      sec,
      deviceId,
      mode = "demo",
    } = body ?? {};

    if (typeof username !== "string" || typeof password !== "string") {
      return new Response(
        JSON.stringify({ error: "Tradovate username and password are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (username.length > 200 || password.length > 500) {
      return new Response(
        JSON.stringify({ error: "Credentials are too long." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = mode === "live"
      ? "https://live.tradovateapi.com/v1"
      : "https://demo.tradovateapi.com/v1";

    // 1. Authenticate
    const authBody: Record<string, string> = {
      name: username,
      password,
      appId,
      appVersion,
    };
    if (cid) authBody.cid = String(cid);
    if (sec) authBody.sec = String(sec);
    if (deviceId) authBody.deviceId = String(deviceId);

    const authRes = await fetch(`${baseUrl}/auth/accessTokenRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(authBody),
    });

    if (!authRes.ok) {
      const authText = await authRes.text();
      console.error("Tradovate auth failed", authRes.status, authText.slice(0, 200));
      return new Response(
        JSON.stringify({ error: "Could not connect to Tradovate. Check your credentials and try again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await authRes.json();
    const accessToken = authData.accessToken;
    if (typeof accessToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Tradovate did not return a valid access token." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    // 2. Fetch fills
    const fillRes = await fetch(`${baseUrl}/fill/list`, { headers: authHeader });
    if (!fillRes.ok) {
      console.error("Tradovate fill/list failed", fillRes.status);
      return new Response(
        JSON.stringify({ error: "Connected to Tradovate but could not retrieve trade history." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const fills: TradovateFill[] = await fillRes.json();
    if (!Array.isArray(fills)) {
      return new Response(
        JSON.stringify({ error: "Unexpected response from Tradovate fill history." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch contracts for instrument names
    const contractRes = await fetch(`${baseUrl}/contract/list`, { headers: authHeader });
    let contracts: TradovateContract[] = [];
    if (contractRes.ok) {
      contracts = await contractRes.json();
      if (!Array.isArray(contracts)) contracts = [];
    }

    const contractMap = new Map<string, TradovateContract>();
    for (const c of contracts) {
      contractMap.set(c.id, c);
    }

    // 4. Pair fills into round-trip trades (FIFO per contract)
    const paired = pairFills(fills, contractMap);

    if (paired.length === 0) {
      return new Response(
        JSON.stringify({
          imported: 0,
          skipped: fills.length,
          message: "No completed round-trip trades found in your Tradovate account.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create a Supabase client scoped to the user's JWT so RLS
    //    associates trades with the correct user. The caller was already
    //    authenticated at the top of the handler.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${userToken}` } } }
    );

    let imported = 0;
    let skippedDup = 0;
    const errors: string[] = [];

    for (const pt of paired) {
      // Check dedup
      const { data: existing } = await supabase
        .from("trades")
        .select("id")
        .eq("import_source", "tradovate")
        .eq("import_ref", pt.importRef)
        .limit(1);

      if (existing && existing.length > 0) {
        skippedDup++;
        continue;
      }

      const { error: insertError } = await supabase.from("trades").insert({
        instrument: pt.instrument.slice(0, 32),
        direction: pt.direction,
        entry_price: pt.entryPrice,
        exit_price: pt.exitPrice,
        stop_price: null,
        target_price: null,
        quantity: pt.quantity,
        entry_time: pt.entryTime,
        exit_time: pt.exitTime,
        pnl: pt.pnl,
        fees: pt.fees,
        setup: null,
        market_session: guessSession(new Date(pt.entryTime).getUTCHours()),
        emotions: null,
        mistakes: null,
        notes: null,
        screenshot_path: null,
        rule_compliance: {},
        discipline_checks: {},
        discipline_score: null,
        strategy_tags: null,
        import_source: "tradovate",
        import_ref: pt.importRef,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          skippedDup++;
        } else {
          errors.push(`Failed to save trade ${pt.importRef}.`);
        }
      } else {
        imported++;
      }
    }

    return new Response(
      JSON.stringify({
        imported,
        skippedDup,
        totalFills: fills.length,
        totalTrades: paired.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-tradovate failed", err);
    return new Response(
      JSON.stringify({ error: "Tradovate sync is unavailable right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* ------------------------------------------------------------------ */
/* FIFO fill pairing                                                  */
/* ------------------------------------------------------------------ */

function pairFills(
  fills: TradovateFill[],
  contractMap: Map<string, TradovateContract>
): PairedTrade[] {
  // Sort by tradeDate ascending
  const sorted = [...fills].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  // Group by contractId
  const byContract = new Map<string, TradovateFill[]>();
  for (const f of sorted) {
    const arr = byContract.get(f.contractId) ?? [];
    arr.push(f);
    byContract.set(f.contractId, arr);
  }

  const results: PairedTrade[] = [];

  for (const [contractId, contractFills] of byContract) {
    const contract = contractMap.get(contractId);
    const instrumentName = contract?.name ?? contractId;

    // FIFO: match Buys (opening long) with Sells (closing long), and vice versa
    const openQueue: TradovateFill[] = [];
    let pairSeq = 0;

    for (const fill of contractFills) {
      const isBuy = fill.side.toLowerCase().includes("buy");

      // Check if this fill closes an existing position
      if (openQueue.length > 0) {
        const opener = openQueue[0];
        const openerIsBuy = opener.side.toLowerCase().includes("buy");

        if (openerIsBuy !== isBuy) {
          // This is a closing fill — pair it
          const direction: "long" | "short" = openerIsBuy ? "long" : "short";
          const entryPrice = opener.price;
          const exitPrice = fill.price;
          const quantity = Math.min(opener.qty, fill.qty);
          const entryTime = opener.tradeDate;
          const exitTime = fill.tradeDate;
          const tickSize = contract?.tickSize ?? 1;
          const tickValue = contract?.tickSize ? 1 : 1; // simplified

          // P&L: (exitPrice - entryPrice) * qty * tickValue / tickSize for longs
          const priceDiff = direction === "long"
            ? exitPrice - entryPrice
            : entryPrice - exitPrice;
          const pnl = (priceDiff / tickSize) * tickValue * quantity;

          pairSeq++;
          results.push({
            instrument: instrumentName,
            direction,
            entryPrice,
            exitPrice,
            quantity,
            entryTime,
            exitTime,
            pnl,
            fees: 0,
            importRef: `tradovate-${fill.orderId}-${pairSeq}`,
          });

          // Reduce or remove opener from queue
          if (fill.qty >= opener.qty) {
            openQueue.shift();
            const remainder = fill.qty - opener.qty;
            if (remainder > 0) {
              // Partial closing — the remainder opens a new position in the opposite direction
              const remainderFill: TradovateFill = { ...fill, qty: remainder };
              openQueue.push(remainderFill);
            }
          } else {
            opener.qty -= fill.qty;
          }
          continue;
        }
      }

      // Opening fill
      openQueue.push({ ...fill });
    }
  }

  return results;
}

function guessSession(hour: number): "asian" | "london" | "new_york" | "overnight" {
  if (hour >= 18 || hour < 3) return "overnight";
  if (hour >= 3 && hour < 9) return "asian";
  if (hour >= 9 && hour < 14) return "new_york";
  return "london";
}
