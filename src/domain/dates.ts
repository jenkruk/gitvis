declare const isoDateBrand: unique symbol;
export type ISODate = string & { readonly [isoDateBrand]: true };

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

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

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTCMs(to) - toUTCMs(from)) / MS_PER_DAY);
}

export function dayOfWeek(date: ISODate): number {
  return new Date(toUTCMs(date)).getUTCDay();
}

export function eachDay({ start, end }: DateRange): ISODate[] {
  const count = diffDays(start, end) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i));
}

export function isWithinRange(date: ISODate, { start, end }: DateRange): boolean {
  return date >= start && date <= end;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -dayOfWeek(date));
}

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

export function oneYearBefore(date: ISODate): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return fromUTCMs(Date.UTC(y - 1, m - 1, Math.min(d, lastDay)));
}

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

export function formatDate(date: ISODate, style: keyof typeof dateFormatters = "medium"): string {
  return dateFormatters[style].format(new Date(toUTCMs(date)));
}
