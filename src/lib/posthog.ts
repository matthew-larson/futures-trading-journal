import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

  if (!key) {
    return;
  }

  posthog.init(key, {
    api_host: host || "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
    persistence: "localStorage",
  });
  initialized = true;
}

export function identifyUser(userId: string): void {
  if (!initialized) return;
  posthog.identify(userId);
}

export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

export function trackTradeLogged(): void {
  if (!initialized) return;
  posthog.capture("trade_logged");
}

export function trackCsvImported(source: string): void {
  if (!initialized) return;
  posthog.capture("csv_imported", { source });
}

export function trackAiQuestionAsked(): void {
  if (!initialized) return;
  posthog.capture("ai_question_asked");
}
