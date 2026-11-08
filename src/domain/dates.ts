/**
 * Calendar-day utilities.
 *
 * Contribution platforms bucket activity into calendar days on their side, so a
 * day is an opaque `YYYY-MM-DD` key — not an instant. All arithmetic here runs
 * on UTC midnight so results never depend on the host machine's timezone.
 * Never parse an ISODate with `new Date("YYYY-MM-DD")` + local getters.
 */

declare const isoDateBrand: unique symbol;
export type ISODate = string & { readonly [isoDateBrand]: true };

export interface DateRange {
  start: ISODate;
  end: ISODate; // inclusive
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True when `value` is a well-formed, real calendar date (rejects 2026-02-30). */
export function isISODate(value: string): value is ISODate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function toISODate(value: string): ISODate {
  if (!isISODate(value)) throw new RangeError(`Invalid ISO date: "${value}"`);
  return value;
}

function toUTCMs(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUTCMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10) as ISODate;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTCMs(toUTCMs(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTCMs(to) - toUTCMs(from)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: ISODate): number {
  return new Date(toUTCMs(date)).getUTCDay();
}

/** Every date from `start` to `end`, inclusive. Empty if `end` < `start`. */
export function eachDay({ start, end }: DateRange): ISODate[] {
  const count = diffDays(start, end) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i));
}

export function isWithinRange(date: ISODate, { start, end }: DateRange): boolean {
  // Lexicographic comparison is correct for zero-padded ISO dates.
  return date >= start && date <= end;
}

/** `YYYY-MM` key for monthly bucketing. */
export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

/** The Sunday on or before `date`. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -dayOfWeek(date));
}

/** The calendar date it currently is in `timeZone` (IANA name, default UTC). */
export function todayInTimeZone(timeZone = "UTC", now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return toISODate(`${get("year")}-${get("month")}-${get("day")}`);
}

/** The same calendar date one year earlier; Feb 29 maps to Feb 28. */
export function oneYearBefore(date: ISODate): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return fromUTCMs(Date.UTC(y - 1, m - 1, Math.min(d, lastDay)));
}

/** A one-year window ending on `end` (inclusive), e.g. 2025-11-07 … 2026-11-06. */
export function trailingYear(end: ISODate): DateRange {
  return { start: addDays(end, -364), end };
}

const dateFormatters = {
  long: new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  medium: new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  monthYear: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }),
  month: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }),
} as const;

/** Deterministic, locale-fixed formatting (SVG output must not vary by server). */
export function formatDate(date: ISODate, style: keyof typeof dateFormatters = "medium"): string {
  return dateFormatters[style].format(new Date(toUTCMs(date)));
}
