import posthog from "posthog-js";

let initialized = false;

/** Event properties PostHog fills with a full URL. */
const URL_PROPERTIES = [
  "$current_url",
  "$initial_current_url",
  "$referrer",
  "$initial_referrer",
  "$referring_domain",
  "$pathname",
] as const;

/**
 * Reduce a URL to origin + path. Auth tokens arrive in the fragment
 * (`#access_token=...`) or as a `?code=` parameter, and neither is anything an
 * analytics event needs.
 */
function stripUrlSecrets(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    // Not a URL (e.g. "$direct" for referrer): drop anything after ? or #.
    return value.split(/[?#]/)[0];
  }
}

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
    // Password-reset and email-confirmation links land back on the app with a
    // live access token in the URL fragment (or a `code` query parameter).
    // Captured verbatim, a page view would publish a working session token into
    // the analytics store, so only ever record the origin and path.
    before_send: (event) => {
      if (!event?.properties) return event;
      for (const prop of URL_PROPERTIES) {
        const value = event.properties[prop];
        if (typeof value === "string" && value) {
          event.properties[prop] = stripUrlSecrets(value);
        }
      }
      return event;
    },
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
