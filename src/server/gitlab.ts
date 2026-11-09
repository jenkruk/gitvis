import "server-only";
import { gitlabCalendarUrl, normalizeGitLabCalendar } from "@/adapters/gitlab";
import { adapterError, type AdapterResult, displayUsername } from "@/adapters/types";
import type { FetchOptions } from "./github";

export async function fetchGitLabContributions(
  username: string,
  { fetchImpl = fetch, timeoutMs = 5_000, url }: FetchOptions = {},
): Promise<AdapterResult> {
  let response: Response;
  try {
    response = await fetchImpl(gitlabCalendarUrl(username, url), {
      headers: { Accept: "application/json", "User-Agent": "GitVis" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return adapterError("gitlab", "upstream", "Couldn't reach GitLab. Please try again.");
  }

  const redirected = response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
  if (redirected || response.status === 404) {
    return adapterError(
      "gitlab",
      "not_found",
      `No public GitLab profile found for “${displayUsername(username)}”. It may not exist, or the profile may be private.`,
    );
  }
  if (response.status === 429) {
    return adapterError("gitlab", "rate_limited", "GitLab is rate-limiting requests. Try again in a minute.");
  }
  if (!response.ok) {
    return adapterError("gitlab", "upstream", `GitLab responded with an error (${response.status}). Please try again.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return adapterError("gitlab", "invalid_response", "Unexpected response from GitLab. Please try again.");
  }
  return normalizeGitLabCalendar(username, body);
}
