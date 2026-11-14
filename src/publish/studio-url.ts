// Imported by next.config.ts: keep this module dependency-free.

export const STUDIO_PATH = "/studio";

export const SAMPLE_PARAM = "sample";

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

export function legacyStudioRedirects() {
  return STUDIO_QUERY_KEYS.map((key) => ({
    source: "/",
    has: [{ type: "query" as const, key }],
    destination: STUDIO_PATH,
    permanent: false,
  }));
}
