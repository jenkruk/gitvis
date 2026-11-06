import { describe, expect, it, vi } from "vitest";
import { recoverLoaderError } from "./cached";

describe("recoverLoaderError", () => {
  it("turns unexpected exceptions into a generic error without leaking details", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = recoverLoaderError("gitlab", new Error("socket hang up: Bearer ghp_secret"));
    expect(result).toEqual({
      ok: false,
      error: {
        platform: "gitlab",
        kind: "upstream",
        message: "Couldn't load contributions right now. Please try again.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("ghp_secret");
    expect(log).toHaveBeenCalled(); // details go to server logs only
  });
});
