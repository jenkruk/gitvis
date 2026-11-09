import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  diffDays,
  eachDay,
  formatDate,
  isISODate,
  startOfWeek,
  toISODate,
  todayInTimeZone,
  trailingYear,
} from "./dates";

const d = toISODate;

describe("isISODate", () => {
  it("accepts real calendar dates", () => {
    expect(isISODate("2026-11-06")).toBe(true);
    expect(isISODate("2024-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    for (const bad of ["2026-2-1", "2026-02-30", "2025-02-29", "2026-13-01", "20261106", "", "2026-11-06T00:00:00Z"]) {
      expect(isISODate(bad), bad).toBe(false);
    }
  });

  it("toISODate throws on invalid input", () => {
    expect(() => toISODate("2026-02-30")).toThrow(RangeError);
  });
});

describe("date arithmetic", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays(d("2026-01-31"), 1)).toBe("2026-02-01");
    expect(addDays(d("2025-12-31"), 1)).toBe("2026-01-01");
    expect(addDays(d("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(d("2024-03-01"), -1)).toBe("2024-02-29");
  });

  it("is unaffected by DST transitions", () => {
    expect(addDays(d("2026-03-07"), 2)).toBe("2026-03-09");
    expect(addDays(d("2026-10-31"), 2)).toBe("2026-11-02");
    expect(diffDays(d("2026-03-01"), d("2026-04-01"))).toBe(31);
    expect(eachDay({ start: d("2026-10-24"), end: d("2026-10-26") })).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
  });

  it("computes weekdays and week starts (Sunday-first)", () => {
    expect(dayOfWeek(d("2026-11-06"))).toBe(5);
    expect(dayOfWeek(d("2026-11-01"))).toBe(0);
    expect(startOfWeek(d("2026-11-06"))).toBe("2026-11-01");
    expect(startOfWeek(d("2026-11-01"))).toBe("2026-11-01");
  });

  it("eachDay is inclusive and empty for reversed ranges", () => {
    expect(eachDay({ start: d("2026-01-01"), end: d("2026-01-01") })).toHaveLength(1);
    expect(eachDay({ start: d("2026-01-02"), end: d("2026-01-01") })).toEqual([]);
  });

  it("trailingYear spans exactly 365 days", () => {
    const range = trailingYear(d("2026-11-06"));
    expect(range.start).toBe("2025-11-07");
    expect(eachDay(range)).toHaveLength(365);
  });
});

describe("todayInTimeZone", () => {
  const instant = new Date("2026-01-01T03:30:00Z");

  it("returns the calendar date in the requested zone", () => {
    expect(todayInTimeZone("UTC", instant)).toBe("2026-01-01");
    expect(todayInTimeZone("America/Denver", instant)).toBe("2025-12-31");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-01-01");
    expect(todayInTimeZone("Pacific/Kiritimati", new Date("2026-01-01T10:30:00Z"))).toBe("2026-01-02");
  });
});

describe("formatDate", () => {
  it("formats deterministically regardless of host timezone", () => {
    expect(formatDate(d("2026-03-03"), "long")).toBe("Tue, Mar 3, 2026");
    expect(formatDate(d("2026-01-01"), "medium")).toBe("Jan 1, 2026");
    expect(formatDate(d("2026-01-01"), "month")).toBe("Jan");
  });
});
