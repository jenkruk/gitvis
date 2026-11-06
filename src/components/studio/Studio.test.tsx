import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContributionsResponse } from "@/adapters/connect";
import { combineSources } from "@/domain/combine";
import { toISODate, trailingYear } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { Studio, type StudioProps } from "./Studio";

const dataset = createSampleDataset();
const live: ContributionsResponse = {
  dataset: combineSources(
    [
      {
        platform: "gitlab",
        username: "contactkruk",
        profileUrl: "https://gitlab.com/contactkruk",
        days: [{ date: toISODate("2026-11-01"), count: 175 }],
      },
    ],
    trailingYear(toISODate("2026-11-06")),
    "live",
  ),
  results: [{ platform: "gitlab", username: "contactkruk", status: "ok", total: 175 }],
};

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: Partial<StudioProps> = {}) {
  const user = userEvent.setup();
  render(<Studio sampleDataset={dataset} origin="https://gitvis.test" {...props} />);
  const preview = () => screen.getByRole("img", { name: "Contribution activity" });
  const stepButton = (label: string) =>
    within(screen.getByRole("navigation", { name: "Progress" })).getByRole("button", { name: new RegExp(label) });
  const heading = () => screen.getByRole("heading", { level: 2 });
  return { user, preview, stepButton, heading };
}

describe("guided steps", () => {
  it("starts new visitors on Connect with later steps locked and no design controls", () => {
    const { stepButton, heading } = setup();
    expect(heading()).toHaveTextContent("Connect your accounts");
    expect(stepButton("Connect")).toHaveAttribute("aria-current", "step");
    expect(stepButton("Design")).toBeDisabled();
    expect(stepButton("Publish")).toBeDisabled();
    expect(screen.getByRole("button", { name: "See my contributions" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Layout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "README Markdown" })).not.toBeInTheDocument();
  });

  it("opens shared links (data in the URL) on Design", () => {
    const { heading, stepButton } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    expect(heading()).toHaveTextContent("Design your graphic");
    expect(heading()).toHaveAccessibleDescription("Showing contributions for GitLab @contactkruk.");
    expect(stepButton("Connect")).toHaveAccessibleName(/completed/);
    expect(stepButton("Publish")).toBeEnabled();
  });

  it("advances to Design after a successful connect and moves focus to its heading", async () => {
    fetchMock.mockResolvedValue(Response.json(live));
    const { user, heading, stepButton } = setup();
    await user.type(screen.getByRole("textbox", { name: /gitlab username/i }), "contactkruk{Enter}");

    expect(await screen.findByRole("heading", { name: /design your graphic/i })).toHaveFocus();
    expect(heading()).toHaveAccessibleDescription(/GitLab @contactkruk/);
    expect(stepButton("Design")).toHaveAttribute("aria-current", "step");
    expect(window.location.hash).toBe("#design");
  });

  it("lets visitors explore with sample data, but routes Publish back to Connect", async () => {
    const { user, heading, stepButton, preview } = setup();
    await user.click(screen.getByRole("button", { name: /try it with sample data/i }));

    expect(heading()).toHaveTextContent("Design your graphic");
    expect(heading()).toHaveFocus();
    expect(preview()).toHaveAccessibleDescription(/sample data/i);
    expect(stepButton("Publish")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Connect accounts to publish" }));
    expect(heading()).toHaveTextContent("Connect your accounts");
    expect(heading()).toHaveFocus();
  });

  it("keeps every setting and typed value when moving back and forth", async () => {
    const { user, stepButton, heading } = setup({
      initialRequest: { gitlab: "contactkruk" },
      initialResponse: live,
    });
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /nordic frost/i }));
    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Avery");

    await user.click(screen.getByRole("button", { name: "Continue to publish" }));
    expect(heading()).toHaveTextContent("Publish to your README");
    expect(screen.getByRole("button", { name: "Copy README Markdown" })).toBeVisible();
    expect((screen.getByRole("textbox", { name: "README Markdown" }) as HTMLTextAreaElement).value).toContain(
      "layout=minimal",
    );

    await user.click(screen.getByRole("button", { name: "Edit design" }));
    expect(heading()).toHaveFocus();
    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /nordic frost/i })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Avery");

    await user.click(stepButton("Connect"));
    expect(screen.getByRole("textbox", { name: /gitlab username/i })).toHaveValue("contactkruk");
    await user.click(stepButton("Design"));
    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(new URLSearchParams(window.location.search).get("palette")).toBe("nordic-frost");
  });

  it("restores the step from the URL hash and follows Back/Forward", async () => {
    window.history.replaceState(null, "", "/?v=1&gitlab=contactkruk#publish");
    const { heading } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    expect(heading()).toHaveTextContent("Publish to your README");

    act(() => {
      window.history.pushState(null, "", "/?v=1&gitlab=contactkruk#connect");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(heading()).toHaveTextContent("Connect your accounts");
    expect(heading()).toHaveFocus();
  });

  it("ignores a hash for a step that isn't reachable yet", () => {
    window.history.replaceState(null, "", "/#publish");
    const { heading } = setup();
    expect(heading()).toHaveTextContent("Connect your accounts");
  });
});

describe("design step", () => {
  const design = () => setup({ initialStep: "design" });

  it("renders an accessible preview labeled as sample data", () => {
    const { preview } = design();
    expect(preview()).toHaveAccessibleDescription(/sample data, not real activity/i);
    expect(screen.getByText(/previewing/i)).toHaveTextContent(/sample data/i);
  });

  it("starting presets switch between a graphic and a profile card without touching the rest", async () => {
    fetchMock.mockImplementation(async () => Response.json({ dataUri: null })); // avatar lookups
    const { user } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    const search = () => new URLSearchParams(window.location.search);
    await user.click(screen.getByRole("radio", { name: /data-rich/i }));
    expect(screen.getByRole("radio", { name: /contribution graphic/i })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /developer profile card/i }));
    expect(screen.getByRole("radio", { name: /full profile/i })).toBeChecked();
    expect([search().get("hdr"), search().get("av"), search().get("layout")]).toEqual([
      "full",
      "github,gitlab",
      "data-rich",
    ]);

    await user.click(screen.getByRole("radio", { name: /contribution graphic/i }));
    expect(screen.getByRole("radio", { name: /^none/i })).toBeChecked();
    expect(search().get("hdr")).toBeNull();
    expect(search().get("layout")).toBe("data-rich");
  });

  it("shows six curated palettes until View all is pressed", async () => {
    const { user } = design();
    const group = () => screen.getByRole("group", { name: "Palette" });
    expect(within(group()).getAllByRole("radio")).toHaveLength(6);
    const toggle = screen.getByRole("button", { name: "View all 15 palettes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(within(group()).getAllByRole("radio")).toHaveLength(15);
    expect(screen.getByRole("button", { name: "Show fewer palettes" })).toHaveAttribute("aria-expanded", "true");
  });

  it("always lists the selected palette, even outside the curated six", async () => {
    const { user } = design();
    await user.click(screen.getByRole("button", { name: "View all 15 palettes" }));
    await user.click(screen.getByRole("radio", { name: /ember/i }));
    await user.click(screen.getByRole("button", { name: "Show fewer palettes" }));
    expect(within(screen.getByRole("group", { name: "Palette" })).getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: /ember/i })).toBeChecked();
  });

  it("groups advanced controls into collapsed sections with a summary of their state", () => {
    design();
    for (const [title, summary] of [
      ["Identity", "Off"],
      ["Colors & Background", "Dark · Solid"],
      ["Metrics & Charts", /of \d+ shown/],
      ["Display", "1 year · Spacious"],
    ] as const) {
      const details = screen.getByText(title, { selector: "summary span" }).closest("details")!;
      expect(details).not.toHaveAttribute("open");
      expect(details.querySelector("summary")).toHaveTextContent(summary);
    }
  });

  it("feature toggles are switches with defaults from the registry", () => {
    design();
    expect(screen.getByRole("switch", { name: /best day/i })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /total contributions/i })).toBeChecked();
  });

  it("keeps feature choices when switching layouts", async () => {
    const { user, preview } = design();
    await user.click(screen.getByRole("switch", { name: /best day/i }));
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /data-rich/i }));

    expect(screen.getByRole("switch", { name: /best day/i })).toBeChecked();
    expect(within(preview()).getByText("Best day")).toBeInTheDocument();
  });

  it("explains when an enabled feature isn't shown by the current layout", async () => {
    const { user, preview } = design();
    await user.click(screen.getByRole("radio", { name: /minimal/i }));

    const breakdown = screen.getByRole("switch", { name: /breakdown/i });
    expect(breakdown).toBeChecked();
    expect(breakdown).toHaveAccessibleDescription(/not shown in the minimal layout/i);
    expect(within(preview()).queryByText("Platform breakdown")).not.toBeInTheDocument();
  });

  it("supports keyboard: arrow keys move between layouts, Space toggles a switch", async () => {
    const { user } = design();
    screen.getByRole("radio", { name: /dashboard/i }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /data-rich/i })).toBeChecked();

    screen.getByRole("switch", { name: /active days/i }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("switch", { name: /active days/i })).not.toBeChecked();
  });

  it("changes palette without resetting layout or mode", async () => {
    const { user } = design();
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /light/i }));
    await user.click(screen.getByRole("radio", { name: /paper & ink/i }));

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /light/i })).toBeChecked();
    expect(screen.getByText("Minimal layout, Paper & Ink palette, light mode.")).toHaveAttribute("role", "status");
  });

  it("offers an expandable preview for small screens", async () => {
    const { user } = design();
    const toggle = screen.getByRole("button", { name: "Expand preview" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "preview-region");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse preview" })).toHaveAttribute("aria-expanded", "true");
  });
});
