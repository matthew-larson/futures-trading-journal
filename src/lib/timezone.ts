/**
 * Timezone utilities for futures trading analytics.
 *
 * All stored timestamps are ISO UTC strings. All session/day/time analytics
 * for futures must be converted to America/New_York, because futures sessions
 * (RTH, ETH, globex) are defined in exchange-local time regardless of where
 * the user's browser is.
 *
 * We use Intl with the `America/New_York` IANA tz ID and extract parts via
 * `Intl.DateTimeFormat` with `formatToParts` so results are correct on any
 * browser or server (Deno edge functions) without relying on the host clock's
 * local zone.
 */

const NY_TZ = "America/New_York";

export interface NyParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0 = Sunday ... 6 = Saturday
  minuteOfDay: number; // 0-1439
  dateString: string; // YYYY-MM-DD in NY
}

const nyFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const partCache = new Map<string, NyParts>();

/** Convert an ISO UTC timestamp to its America/New_York wall-clock parts. */
export function toNyParts(iso: string): NyParts {
  const cached = partCache.get(iso);
  if (cached) return cached;

  const parts = nyFmt.formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  // Intl can emit "24" for midnight in hour12:false; normalize to 0.
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const minute = Number(map.minute);
  const minuteOfDay = hour * 60 + minute;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[map.weekday] ?? 0;
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const result: NyParts = { year, month, day, hour, minute, weekday, minuteOfDay, dateString };
  partCache.set(iso, result);
  return result;
}

/** Hour (0-23) in America/New_York for an ISO UTC timestamp. */
export function nyHour(iso: string): number {
  return toNyParts(iso).hour;
}

/** Minute of day (0-1439) in America/New_York for an ISO UTC timestamp. */
export function nyMinuteOfDay(iso: string): number {
  return toNyParts(iso).minuteOfDay;
}

/** Weekday (0=Sun ... 6=Sat) in America/New_York for an ISO UTC timestamp. */
export function nyWeekday(iso: string): number {
  return toNyParts(iso).weekday;
}

/** Day name (Sunday...Saturday) in NY for an ISO UTC timestamp. */
export function nyDayName(iso: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][toNyParts(iso).weekday];
}

/** YYYY-MM-DD date string in NY for an ISO UTC timestamp. */
export function nyDateString(iso: string): string {
  return toNyParts(iso).dateString;
}

/** True when two ISO timestamps fall on the same NY calendar day. */
export function isSameNyDay(aIso: string, bIso: string): boolean {
  return nyDateString(aIso) === nyDateString(bIso);
}

/** Start of the current NY trading day as a Date (midnight NY, represented as UTC). */
export function nyStartOfToday(): Date {
  const nowIso = new Date().toISOString();
  const parts = toNyParts(nowIso);
  // Build a Date from the NY midnight components; interpret as NY local.
  // We use the fact that NY midnight on date D = UTC date D at 04:00 or 05:00
  // depending on DST. Instead of hardcoding offsets, we use Intl to find the
  // exact UTC instant by formatting backwards.
  // Simpler: compute the UTC instant whose NY parts are (year, month, day, 0, 0).
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
  // target is "midnight in UTC" but we want "midnight in NY". Adjust by the
  // current NY UTC offset at that instant.
  const offsetMs = getNyOffsetMs(target);
  return new Date(target.getTime() - offsetMs);
}

/** UTC offset of America/New_York at the given instant, in milliseconds. */
function getNyOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const asUtc = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), m.hour === "24" ? 0 : Number(m.hour), Number(m.minute), Number(m.second));
  return asUtc - date.getTime();
}
