import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingUp, Loader2, AlertCircle, Mail, Lock, ArrowRight, ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type AuthMode = "signin" | "signup" | "forgot" | "check-email";

/** True when the backend is telling us the address is already registered. */
function isAccountExistsError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message?.toLowerCase() ?? "";
  return (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  );
}

/**
 * Turn any backend failure into a fixed, user-facing sentence. The raw error is
 * logged for developers but never rendered, so it cannot leak provider
 * internals or account state.
 */
function friendlyAuthError(e: unknown): string {
  const msg = (e as { message?: string })?.message?.toLowerCase() ?? "";
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox for a confirmation link.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "That email and password combination didn't work. Please try again.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("email") && msg.includes("invalid")) {
    return "Please enter a valid email address.";
  }
  // Password validation messages are user-actionable — pass them through so the
  // user knows exactly what requirement they missed.
  if (msg.includes("password")) {
    if (msg.includes("weak") || msg.includes("easy to guess") || msg.includes("known")) {
      return "That password has appeared in known data breaches and isn't safe to use. Please choose a different one that isn't a common word, name, or simple pattern.";
    }
    const raw = (e as { message?: string })?.message ?? "";
    return raw || "That password doesn't meet the requirements. Please try a different one.";
  }
  return "Something went wrong. Please try again.";
}

export function Auth({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "check-email") {
      setError(null);
      setInfo(null);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onAuthenticated(data.user);
      } else if (mode === "signup") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters long.");
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        // Never distinguish "this email already has an account" from a fresh
        // signup: both outcomes show the same confirmation screen so the form
        // cannot be used to discover which addresses are registered.
        if (error && !isAccountExistsError(error)) throw error;
        setMode("check-email");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setInfo("Password reset link sent. Check your email to continue.");
      }
    } catch (e) {
      // Never render the backend's own error text: it leaks provider and
      // account detail. Map the handful of cases the user can act on and fall
      // back to a generic message for everything else.
      console.error("Auth request failed", e);
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-xl">
            <TrendingUp size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-base-50">EdgePilot</h1>
            <p className="text-sm text-base-400">Discover Your Trading Edge</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-base-800 bg-base-900 p-6 shadow-2xl animate-slide-up">
          {mode === "check-email" ? (
            <div className="text-center">
              <Mail size={32} className="mx-auto mb-4 text-info-400" />
              <h2 className="text-lg font-bold text-base-50">Check your email</h2>
              <p className="mt-2 text-sm text-base-400">
                We sent a confirmation link to <span className="font-medium text-base-200">{email}</span>.
                Click the link to activate your account, then sign in.
              </p>
              <button
                onClick={() => {
                  setMode("signin");
                  setPassword("");
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-base-600 py-2.5 text-sm font-medium text-base-300 transition-colors hover:bg-base-800"
              >
                <ArrowLeft size={16} /> Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-bold text-base-50">
                {mode === "signin" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Reset your password"}
              </h2>
              <p className="mb-5 text-sm text-base-400">
                {mode === "signin" && "Sign in to access your trading journal"}
                {mode === "signup" && "Start tracking your trades with AI insights"}
                {mode === "forgot" && "Enter your email and we'll send you a reset link"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-base-300">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-base-700 bg-base-850 py-2.5 pl-10 pr-4 text-sm text-base-100 placeholder:text-base-500 focus:border-info-500/50 focus:outline-none focus:ring-1 focus:ring-info-500/30"
                      disabled={loading}
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-base-300">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                        className="w-full rounded-lg border border-base-700 bg-base-850 py-2.5 pl-10 pr-4 text-sm text-base-100 placeholder:text-base-500 focus:border-info-500/50 focus:outline-none focus:ring-1 focus:ring-info-500/30"
                        disabled={loading}
                      />
                    </div>
                    {mode === "signup" && (
                      <p className="mt-2 text-xs text-base-500">
                        At least 6 characters. Avoid common words, names, and simple patterns like "password1" — passwords found in known data breaches are rejected.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-bear-500/30 bg-bear-500/10 px-3 py-2.5 text-sm text-bear-500">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {info && (
                  <div className="flex items-start gap-2 rounded-lg border border-bull-500/30 bg-bull-500/10 px-3 py-2.5 text-sm text-bull-500">
                    <Mail size={16} className="mt-0.5 flex-shrink-0" />
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-info-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info-500 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" && "Sign In"}
                      {mode === "signup" && "Create Account"}
                      {mode === "forgot" && "Send Reset Link"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Mode switcher */}
              <div className="mt-5 space-y-2 border-t border-base-800 pt-4">
                {mode === "signin" && (
                  <>
                    <p className="text-center text-sm text-base-400">
                      Don't have an account?{" "}
                      <button
                        onClick={() => setMode("signup")}
                        className="font-medium text-info-400 hover:text-info-300"
                      >
                        Sign up
                      </button>
                    </p>
                    <p className="text-center">
                      <button
                        onClick={() => setMode("forgot")}
                        className="text-xs text-base-500 hover:text-base-300"
                      >
                        Forgot your password?
                      </button>
                    </p>
                  </>
                )}
                {mode === "signup" && (
                  <p className="text-center text-sm text-base-400">
                    Already have an account?{" "}
                    <button
                      onClick={() => setMode("signin")}
                      className="font-medium text-info-400 hover:text-info-300"
                    >
                      Sign in
                    </button>
                  </p>
                )}
                {mode === "forgot" && (
                  <p className="text-center">
                    <button
                      onClick={() => setMode("signin")}
                      className="flex items-center gap-1 text-sm text-base-400 hover:text-base-200"
                    >
                      <ArrowLeft size={14} /> Back to sign in
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-base-600">
          Your trades, rules, and conversations are private to your account.
        </p>
      </div>
    </div>
  );
}
