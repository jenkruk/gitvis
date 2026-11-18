import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GITVIS_REPO_URL, PRIVACY_PATH } from "@/config/site";
import { AppShell } from "./AppShell";

describe("AppShell footer", () => {
  it("shows the copyright and licence, with Source and Privacy links in a footer navigation", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("© 2026 GitVis · MIT licensed");
    const nav = within(footer).getByRole("navigation", { name: "Footer" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Source on GitHub (opens in a new tab)", "Privacy"]);

    const source = within(nav).getByRole("link", { name: "Source on GitHub (opens in a new tab)" });
    expect(source).toHaveAttribute("href", GITVIS_REPO_URL);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");

    const privacy = within(nav).getByRole("link", { name: "Privacy" });
    expect(privacy).toHaveAttribute("href", PRIVACY_PATH);
    expect(privacy).not.toHaveAttribute("target");
    expect(privacy).not.toHaveAttribute("aria-current");
  });

  it("keeps privacy claims out of the footer", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent(/cookie|analytics|repository contents/i);
  });

  it("marks the footer's Privacy link as the current page on the Privacy page, and offers the studio", () => {
    render(
      <AppShell page="privacy">
        <p>content</p>
      </AppShell>,
    );
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Open studio" })).toHaveAttribute("href", "/studio");
  });
});
