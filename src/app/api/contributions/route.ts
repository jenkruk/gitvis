import type { NextRequest } from "next/server";
import { parseYears, validateConnectRequest } from "@/adapters/connect";
import { serverLoaders } from "@/server/cached";
import { loadContributions } from "@/server/contributions";
import { clientKey, contributionsLimiter, tooManyRequests } from "@/server/rate-limit";

export async function GET(request: NextRequest) {
  const limit = contributionsLimiter.hit(clientKey(request.headers));
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const params = request.nextUrl.searchParams;
  const validation = validateConnectRequest({ github: params.get("github"), gitlab: params.get("gitlab") });

  if (!validation.ok) {
    const error =
      validation.reason === "empty"
        ? "Provide a GitHub and/or GitLab username."
        : `Invalid username for: ${validation.fields.join(", ")}.`;
    return Response.json({ error }, { status: 400 });
  }
  const years = parseYears(params.get("years"));
  if (years === null) return Response.json({ error: "years must be 1, 2 or 3." }, { status: 400 });

  const response = await loadContributions(validation.request, serverLoaders, { years });
  const stable =
    response.results.every((r) => (r.status === "ok" && !r.stale) || r.status === "not_found") &&
    (!response.history || response.history.status === "ok");

  return Response.json(response, {
    headers: stable
      ? { "Cache-Control": "no-cache", "Vercel-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" }
      : { "Cache-Control": "no-store" },
  });
}
