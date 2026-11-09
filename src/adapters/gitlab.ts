import { normalizeDailyCounts } from "@/domain/combine";
import { PLATFORMS } from "@/domain/types";
import type { AdapterResult } from "./types";

export const GITLAB_ORIGIN = "https://gitlab.com";

export function gitlabCalendarUrl(username: string, origin: string = GITLAB_ORIGIN): string {
  return `${origin}/users/${encodeURIComponent(username)}/calendar.json`;
}

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
