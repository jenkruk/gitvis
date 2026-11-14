import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { GITVIS_REPO_URL, LIVE_EXAMPLE_URL } from "@/config/site";
import { LandingDetails } from "./LandingDetails";
import { LandingHero } from "./LandingHero";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderLanding() {
  const user = userEvent.setup();
  render(
    <AppShell page="landing">
      <LandingHero />
      <LandingDetails />
    </AppShell>,
  );
  return { user };
}

describe("landing page", () => {
  it("leads with the headline, one sentence and two ways into the studio", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your work deserves to be seen.");
    expect(screen.getByText(/combine your github and gitlab contributions/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /create your graphic/i })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/studio\?/),
    );
    expect(screen.getByRole("link", { name: "Explore with sample data" })).toHaveAttribute(
      "href",
      expect.stringMatching(/sample=1#design$/),
    );
  });

  it("shows the real renderer's graphic, labelled as sample data", () => {
    renderLanding();
    const figure = screen.getByRole("figure");
    expect(figure).toHaveAccessibleName(/sample data/i);
    const graphic = within(figure).getByRole("img", { name: "Contribution activity" });
    expect(graphic).toHaveAccessibleDescription(/sample data, not real activity/i);
    expect(graphic).toHaveTextContent("Sample data");
  });

  it("links to a live example beside the sample-data caption, without changing the figure's name", () => {
    renderLanding();
    const figure = screen.getByRole("figure");
    expect(figure).toHaveAccessibleName("A live GitVis graphic, drawn from sample data.");
    const example = within(figure).getByRole("link", { name: "View a live example on GitHub (opens in a new tab)" });
    expect(example).toHaveAttribute("href", LIVE_EXAMPLE_URL);
    expect(example).toHaveAttribute("target", "_blank");
    expect(example).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has three small native radio groups that update the graphic and the links", async () => {
    const { user } = renderLanding();
    const groups = ["Style", "Palette", "Theme"].map((name) => screen.getByRole("group", { name }));
    expect(groups).toHaveLength(3);
    expect(screen.getAllByRole("radio")).toHaveLength(7);

    await user.click(screen.getByRole("radio", { name: "Light theme" }));
    expect(screen.getByRole("radio", { name: "Light theme" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Terracotta" }));
    await user.click(screen.getByRole("radio", { name: "Developer profile card" }));
    const href = screen.getByRole("link", { name: /create your graphic/i }).getAttribute("href")!;
    expect(href).toContain("palette=terracotta");
    expect(href).toContain("mode=light");
    expect(href).toContain("hdr=full");

    screen.getByRole("radio", { name: "Light theme" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Dark theme" })).toBeChecked();
  });

  it("explains the three steps and the data facts precisely, without overclaiming", () => {
    renderLanding();
    const steps = within(screen.getByRole("region", { name: "How it works" })).getAllByRole("listitem");
    expect(steps.map((li) => within(li).getByRole("heading").textContent)).toEqual([
      "One view of your work",
      "Make it yours",
      "Set it and forget it",
    ]);
    const trust = screen.getByRole("region", { name: /open source/i });
    expect(trust).toHaveTextContent(/no sign-in/i);
    expect(trust).toHaveTextContent(/repository contents are never read/i);
    expect(trust).toHaveTextContent(/private contributions appear only as counts/i);
    expect(trust).not.toHaveTextContent(/commits/i);
    expect(document.body).not.toHaveTextContent(/every 12 hours|guaranteed|instantly/i);
    const source = within(trust).getByRole("link", { name: "View the source on GitHub (opens in a new tab)" });
    expect(source).toHaveAttribute("href", GITVIS_REPO_URL);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has a compact header: home, source and the studio", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: /gitvis/i, current: "page" })).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: "Site" });
    const source = within(nav).getByRole("link", { name: "Source on GitHub (opens in a new tab)" });
    expect(source).toHaveAttribute("href", GITVIS_REPO_URL);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(nav).getByRole("link", { name: "Open studio" })).toHaveAttribute("href", "/studio");
  });
});
