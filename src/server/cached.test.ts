import { describe, expect, it, vi } from "vitest";
import { recoverLoaderError } from "./cached";

describe("recoverLoaderError", () => {
  it("restores the user-safe error carried by an uncacheable failure", () => {
    const error = { platform: "github", kind: "rate_limited", message: "GitHub is rate-limiting requests." };
    expect(recoverLoaderError("github", new Error(`gitvis-uncacheable:${JSON.stringify(error)}`))).toEqual({
      ok: false,
      error,
    });
  });

  it("turns anything unexpected into a generic error without leaking details", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = recoverLoaderError("gitlab", new Error("socket hang up: Bearer ghp_secret"));
    expect(result).toEqual({
      ok: false,
      error: {
        platform: "gitlab",
        kind: "upstream",
        message: "Couldn't load contributions right now. Please try again.",
      },
    });
    expect(recoverLoaderError("gitlab", new Error("gitvis-uncacheable:{not json"))).toMatchObject({
      error: { kind: "upstream" },
    });
  });
});
