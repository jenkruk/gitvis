import { normalizeDailyCounts } from "@/domain/combine";
import { PLATFORMS } from "@/domain/types";
import type { AdapterResult } from "./types";

/**
 * GitLab.com profile calendar. Unauthenticated; returns a sparse
 * `{ "YYYY-MM-DD": count }` map covering roughly the past 12 months.
 * Unknown/private users respond with a 302 to sign-in (verified 2026-11-06).
 */
export function gitlabCalendarUrl(username: string): string {
  return `https://gitlab.com/users/${encodeURIComponent(username)}/calendar.json`;
}

/**
 * Normalizes a `calendar.json` body. GitLab doesn't expose a separate private
 * total, so `privateCount` is intentionally left undefined.
 */
export function normalizeGitLabCalendar(username: string, body: unknown): AdapterResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid("Unexpected calendar format from GitLab.");
  }
  const entries = Object.entries(body);
  if (entries.some(([, count]) => typeof count !== "number")) {
    return invalid("Unexpected calendar values from GitLab.");
  }

  return {
    ok: true,
    data: {
      platform: "gitlab",
      username,
      profileUrl: PLATFORMS.gitlab.profileUrl(username),
      days: normalizeDailyCounts(entries.map(([date, count]) => ({ date, count: count as number }))),
    },
  };
}

function invalid(message: string): AdapterResult {
  return { ok: false, error: { platform: "gitlab", kind: "invalid_response", message } };
}
