import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GITVIS_REPO_URL } from "@/config/site";
import { AppShell } from "./AppShell";

describe("AppShell footer", () => {
  it("says GitVis is open source and links to the repository", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Open source (MIT)");
    const link = screen.getByRole("link", { name: "View the source on GitHub (opens in a new tab)" });
    expect(link).toHaveAttribute("href", GITVIS_REPO_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(footer).toContainElement(link);
  });
});
