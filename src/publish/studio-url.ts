/**
 * Where the studio lives, and how older studio URLs reach it.
 *
 * Until Nov 2026 the studio was served at `/`, so Edit links (and bookmarks of the studio) look
 * like `/?v=1&github=…#design`. `/` is now the landing page, and next.config.ts redirects any `/`
 * request carrying one of these query keys to `/studio` with the query unchanged (browsers keep
 * the `#step` fragment across the redirect). A bare `/#design` is forwarded on the client
 * (src/components/landing/LegacyStepRedirect.tsx).
 *
 * Dependency-free on purpose: next.config.ts imports it.
 */

export const STUDIO_PATH = "/studio";

/** Shown with sample data in Design (the landing page's "Explore with sample data"). */
export const SAMPLE_PARAM = "sample";

/**
 * Every query key the studio reads (card-params.ts) plus `sample`. card-params.test.ts checks
 * that the encoder never writes a key missing from this list.
 */
export const STUDIO_QUERY_KEYS = [
  "v",
  "github",
  "gitlab",
  "layout",
  "palette",
  "mode",
  "f",
  "size",
  "hdr",
  "hl",
  "av",
  "name",
  "title",
  "left",
  "avs",
  "bg",
  "pc",
  "ord",
  "range",
  "den",
  "pnl",
  "yrs",
  SAMPLE_PARAM,
] as const;

/** next.config.ts redirects: `/?<any studio key>` → `/studio?<same query>` (307, so it stays revisable). */
export function legacyStudioRedirects() {
  return STUDIO_QUERY_KEYS.map((key) => ({
    source: "/",
    has: [{ type: "query" as const, key }],
    destination: STUDIO_PATH,
    permanent: false,
  }));
}
