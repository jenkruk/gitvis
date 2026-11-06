import type { NextRequest } from "next/server";
import { validateConnectRequest } from "@/adapters/connect";
import { serverLoaders } from "@/server/cached";
import { loadContributions } from "@/server/contributions";

/**
 * GET /api/contributions?github=<user>&gitlab=<user>
 * Returns a ContributionsResponse: a combined `live` dataset (or null) plus a
 * status per requested platform. Tokens never leave the server.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateConnectRequest({ github: params.get("github"), gitlab: params.get("gitlab") });

  if (!validation.ok) {
    const error =
      validation.reason === "empty"
        ? "Provide a GitHub and/or GitLab username."
        : `Invalid username for: ${validation.fields.join(", ")}.`;
    return Response.json({ error }, { status: 400 });
  }

  const response = await loadContributions(validation.request, serverLoaders);
  // Only let CDNs cache stable answers; failures should be retryable immediately.
  const stable = response.results.every((r) => r.status === "ok" || r.status === "not_found");

  return Response.json(response, {
    headers: { "Cache-Control": stable ? "public, s-maxage=900, stale-while-revalidate=3600" : "no-store" },
  });
}
