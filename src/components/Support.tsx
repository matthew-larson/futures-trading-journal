import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Heart, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

const presetAmounts = [5, 10, 25, 50];

export function Support() {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("donation") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    }
    return false;
  });

  const amount = useMemo(() => {
    const parsed = Number(customAmount);
    return customAmount.trim() ? parsed : selectedAmount;
  }, [customAmount, selectedAmount]);

  const handleDonate = async () => {
    setError(null);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      setError("Choose an amount between $1 and $10,000.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again before donating.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-donation-checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount }),
      });

      const body: unknown = await response.json();
      if (!response.ok || typeof body !== "object" || body === null || !("url" in body) || typeof body.url !== "string") {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error
          : "We couldn't start checkout. Please try again.";
        throw new Error(message);
      }

      window.location.assign(body.url);
    } catch (donationError) {
      setError(donationError instanceof Error ? donationError.message : "We couldn't start checkout. Please try again.");
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="animate-fade-in mx-auto max-w-3xl">
        <div className="rounded-2xl border border-bull-500/30 bg-bull-500/10 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bull-500/15 text-bull-500">
            <CheckCircle2 size={34} />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-base-50">Thank you for supporting EdgePilot</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-base-300">
            Your contribution helps keep development moving and makes room for more thoughtful tools for serious traders.
          </p>
          <button
            onClick={() => setCompleted(false)}
            className="mt-7 rounded-lg bg-bull-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bull-500"
          >
            Make another donation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-base-800 bg-base-900 shadow-2xl shadow-black/20">
        <div className="relative overflow-hidden border-b border-base-800 px-6 py-8 sm:px-10 sm:py-10">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-info-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info-500/15 text-info-400">
              <Heart size={24} fill="currentColor" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-info-400">Keep building</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-base-50 sm:text-3xl">Support the next chapter of EdgePilot</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-base-300 sm:text-base">
              EdgePilot is built to help traders turn their journal into a clearer, more disciplined process. If it is useful to you, an optional contribution helps fund continued development.
            </p>
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_240px]">
          <div>
            <p className="text-sm font-semibold text-base-100">Choose your contribution</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setSelectedAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    !customAmount && selectedAmount === preset
                      ? "border-info-400 bg-info-500/15 text-info-300 shadow-lg shadow-info-500/10"
                      : "border-base-700 bg-base-850 text-base-300 hover:border-base-500 hover:text-base-100"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-base-300" htmlFor="custom-donation">
              Or enter another amount
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base-400">$</span>
              <input
                id="custom-donation"
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                placeholder="10.00"
                className="w-full rounded-xl border border-base-700 bg-base-850 py-3 pl-8 pr-4 text-base-100 outline-none transition-colors placeholder:text-base-600 focus:border-info-400"
              />
            </div>
            {error && <p className="mt-3 text-sm text-bear-500">{error}</p>}
            <button
              onClick={handleDonate}
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-info-600 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-info-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
              {submitting ? "Opening secure checkout..." : `Continue with $${amount.toFixed(2)}`}
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-base-500">
              <ShieldCheck size={14} className="text-bull-500" /> Secure payment handled by Stripe
            </div>
          </div>

          <div className="rounded-xl border border-base-800 bg-base-850 p-5">
            <div className="flex items-center gap-2 text-info-400"><Sparkles size={16} /><span className="text-xs font-semibold uppercase tracking-wider">What it supports</span></div>
            <ul className="mt-4 space-y-4 text-sm leading-5 text-base-300">
              <li>More focused journal and review tools</li>
              <li>Ongoing reliability and product improvements</li>
              <li>A sustainable path for independent development</li>
            </ul>
            <a href="https://stripe.com" target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-xs text-base-500 transition-colors hover:text-base-300">
              Payment security by Stripe <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
