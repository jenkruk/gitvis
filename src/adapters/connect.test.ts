import { describe, expect, it } from "vitest";
import { connectSearchParams, validateConnectRequest } from "./connect";

describe("validateConnectRequest", () => {
  it("accepts either platform alone or both, with differing usernames", () => {
    expect(validateConnectRequest({ github: "jenkruk" })).toEqual({ ok: true, request: { github: "jenkruk" } });
    expect(validateConnectRequest({ gitlab: "contactkruk" })).toEqual({ ok: true, request: { gitlab: "contactkruk" } });
    expect(validateConnectRequest({ github: "jenkruk", gitlab: "contactkruk" })).toEqual({
      ok: true,
      request: { github: "jenkruk", gitlab: "contactkruk" },
    });
  });

  it("trims whitespace, strips a leading @ and ignores blank fields", () => {
    expect(validateConnectRequest({ github: "  @jenkruk ", gitlab: "   " })).toEqual({
      ok: true,
      request: { github: "jenkruk" },
    });
  });

  it("uses the first value of repeated query params", () => {
    expect(validateConnectRequest({ gitlab: ["contactkruk", "other"] })).toEqual({
      ok: true,
      request: { gitlab: "contactkruk" },
    });
  });

  it("reports empty input", () => {
    expect(validateConnectRequest({})).toEqual({ ok: false, reason: "empty" });
    expect(validateConnectRequest({ github: "", gitlab: null })).toEqual({ ok: false, reason: "empty" });
  });

  it("reports every invalid field", () => {
    expect(validateConnectRequest({ github: "bad name", gitlab: "a..b" })).toEqual({
      ok: false,
      reason: "invalid",
      fields: ["github", "gitlab"],
    });
  });

  it("rejects path traversal and URL-like input", () => {
    for (const value of ["../admin", "jen/kruk", "https://github.com/jenkruk", "jen?x=1"]) {
      expect(validateConnectRequest({ github: value }).ok, value).toBe(false);
    }
  });
});

describe("connectSearchParams", () => {
  it("only includes provided platforms", () => {
    expect(connectSearchParams({ gitlab: "contactkruk" }).toString()).toBe("gitlab=contactkruk");
    expect(connectSearchParams({ github: "a", gitlab: "b" }).toString()).toBe("github=a&gitlab=b");
  });
});
