import { describe, expect, it, vi } from "vitest";
import { resolvePublicOrigin } from "./origin";

const previewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_URL: "gitvis-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "gitvis-git-feature-team.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "gitvis.app",
};
const previewRequest = { host: "gitvis-git-feature-team.vercel.app", proto: "https" };

describe("resolvePublicOrigin", () => {
  it("uses SITE_URL in production", () => {
    expect(
      resolvePublicOrigin({ VERCEL_ENV: "production", SITE_URL: "https://gitvis.app/" }, { host: "x.vercel.app" }),
    ).toEqual({ origin: "https://gitvis.app", environment: "production", source: "SITE_URL" });
  });

  it("never lets a preview deployment publish its own hostname, even with no SITE_URL", () => {
    expect(resolvePublicOrigin(previewEnv, previewRequest)).toEqual({
      origin: "https://gitvis.app",
      environment: "preview",
      source: "VERCEL_PROJECT_PRODUCTION_URL",
    });
  });

  it("rejects a SITE_URL that was misconfigured to the preview's own URL", () => {
    const result = resolvePublicOrigin(
      { ...previewEnv, SITE_URL: "https://gitvis-git-feature-team.vercel.app" },
      previewRequest,
    );
    expect(result.origin).toBe("https://gitvis.app");
  });

  it("falls back to the production vercel.app domain when there is no custom domain", () => {
    expect(
      resolvePublicOrigin({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "gitvis-team.vercel.app" }, {})
        .origin,
    ).toBe("https://gitvis-team.vercel.app");
  });

  it("ignores invalid SITE_URL values", () => {
    expect(
      resolvePublicOrigin(
        { VERCEL_ENV: "production", SITE_URL: "javascript:alert(1)", VERCEL_PROJECT_PRODUCTION_URL: "gitvis.app" },
        {},
      ).origin,
    ).toBe("https://gitvis.app");
  });

  it("uses the request host only for local development", () => {
    expect(resolvePublicOrigin({}, { host: "localhost:3000" })).toEqual({
      origin: "http://localhost:3000",
      environment: "local",
      source: "request",
    });
  });

  it("logs loudly instead of silently trusting Host on a misconfigured Vercel deployment", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    resolvePublicOrigin({ VERCEL_ENV: "production" }, { host: "evil.example" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
