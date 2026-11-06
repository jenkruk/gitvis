import "server-only";

export type DeploymentEnvironment = "production" | "preview" | "development" | "local";

export interface PublicOrigin {
  /** Origin used in every published URL (README image, Edit link). */
  origin: string;
  environment: DeploymentEnvironment;
  /** Where the origin came from — surfaced in the UI on non-production deployments. */
  source: "SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "request";
}

type Env = Record<string, string | undefined>;

function parseOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Picks the origin for README URLs. Published URLs are permanent, so on Vercel
 * they must always point at production — never at a preview deployment's
 * hostname (which also sits behind Deployment Protection and would break).
 *
 * Order: SITE_URL → https://VERCEL_PROJECT_PRODUCTION_URL (set on every Vercel
 * deployment, including previews) → the request host (local development only).
 * A candidate equal to this deployment's own preview hostname is rejected.
 */
export function resolvePublicOrigin(env: Env, request: { host?: string | null; proto?: string | null }): PublicOrigin {
  const environment = (["production", "preview", "development"] as const).find((e) => e === env.VERCEL_ENV) ?? "local";
  const ownPreviewHosts = new Set(
    environment === "preview"
      ? [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => h!.toLowerCase())
      : [],
  );
  const acceptable = (url: URL | null): url is URL => !!url && !ownPreviewHosts.has(url.host.toLowerCase());

  const site = parseOrigin(env.SITE_URL);
  if (acceptable(site)) return { origin: site.origin, environment, source: "SITE_URL" };

  const production = parseOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (acceptable(production))
    return { origin: production.origin, environment, source: "VERCEL_PROJECT_PRODUCTION_URL" };

  if (environment !== "local") {
    // Should never happen on Vercel (VERCEL_PROJECT_PRODUCTION_URL is always set); make it loud if it does.
    console.error(
      "[gitvis] Neither SITE_URL nor VERCEL_PROJECT_PRODUCTION_URL is usable; published URLs fall back to the request host.",
    );
  }
  const host = request.host ?? "localhost:3000";
  const proto = request.proto ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return { origin: `${proto}://${host}`, environment, source: "request" };
}
