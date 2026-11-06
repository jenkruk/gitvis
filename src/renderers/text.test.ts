import { describe, expect, it } from "vitest";
import { maxCharsFor, wrapText } from "./text";

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("Account not found", 700, 13)).toEqual(["Account not found"]);
  });

  it("wraps on word boundaries within the character budget", () => {
    const lines = wrapText("one two three four five six seven eight nine ten", 100, 13);
    const limit = maxCharsFor(100, 13);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(limit);
    expect(lines.join(" ")).toBe("one two three four five six seven eight nine ten");
  });

  it("hard-breaks a single overlong token such as a 255-character username", () => {
    const username = "a".repeat(255);
    const lines = wrapText(`No profile for “${username}”.`, 400, 13);
    const limit = maxCharsFor(400, 13);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(limit);
    expect(lines.join("").replace(/\s/g, "")).toContain(username);
  });

  it("caps the number of lines with an ellipsis", () => {
    const lines = wrapText("word ".repeat(200), 200, 13, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2]!.endsWith("…")).toBe(true);
  });
});
