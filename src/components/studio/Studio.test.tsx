import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContributionsResponse } from "@/adapters/connect";
import { combineSources } from "@/domain/combine";
import { toISODate, trailingYear } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
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

  it("opens Design on labelled sample data when asked (the landing page's sample link), and keeps that in the URL", () => {
    const { heading, stepButton } = setup({ initialSample: true });
    expect(heading()).toHaveTextContent("Design your graphic");
    expect(screen.getByText(/previewing/i)).toHaveTextContent(/sample data/i);
    expect(stepButton("Publish")).toBeDisabled();
    expect(new URLSearchParams(window.location.search).get("sample")).toBe("1");
    expect(window.location.hash).toBe("#design");
  });

  it("ignores the sample request when accounts are in the URL", () => {
    const { heading } = setup({
      initialSample: true,
      initialRequest: { gitlab: "contactkruk" },
      initialResponse: live,
    });
    expect(heading()).toHaveTextContent("Design your graphic");
    expect(new URLSearchParams(window.location.search).has("sample")).toBe(false);
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
    await user.click(screen.getByRole("radio", { name: /terracotta/i }));
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
    expect(screen.getByRole("radio", { name: /terracotta/i })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Avery");

    await user.click(stepButton("Connect"));
    expect(screen.getByRole("textbox", { name: /gitlab username/i })).toHaveValue("contactkruk");
    await user.click(stepButton("Design"));
    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(new URLSearchParams(window.location.search).get("palette")).toBe("terracotta");
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
    fetchMock.mockImplementation(async () => Response.json({ dataUri: null }));
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

  it("switching presets back and forth never discards manual identity choices", async () => {
    fetchMock.mockImplementation(async () => Response.json({ dataUri: null }));
    const { user } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    await user.click(screen.getByRole("radio", { name: /developer profile card/i }));
    await user.click(screen.getByRole("radio", { name: /compact identity/i }));
    const avatars = () => within(screen.getByRole("group", { name: "Avatars" }));
    await user.click(avatars().getByRole("checkbox", { name: "GitHub" }));
    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Avery");

    await user.click(screen.getByRole("radio", { name: /contribution graphic/i }));
    await user.click(screen.getByRole("radio", { name: /developer profile card/i }));

    expect(screen.getByRole("radio", { name: /compact identity/i })).toBeChecked();
    expect(avatars().getByRole("checkbox", { name: "GitHub" })).not.toBeChecked();
    expect(avatars().getByRole("checkbox", { name: "GitLab" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Avery");
  });

  it("panel styles update the preview immediately and the shareable URL", async () => {
    const { user, preview } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    const group = screen.getByRole("group", { name: "Panels" });
    expect(within(group).getByRole("radio", { name: /filled/i })).toBeChecked();
    const panelRects = () => preview().querySelectorAll('rect[rx="10"]');
    const filled = panelRects().length;

    await user.click(within(group).getByRole("radio", { name: /outlined/i }));
    expect(panelRects()).toHaveLength(filled);
    for (const rect of panelRects()) expect(rect).toHaveAttribute("fill", "none");
    expect(new URLSearchParams(window.location.search).get("pnl")).toBe("outlined");

    await user.click(within(group).getByRole("radio", { name: /borderless/i }));
    expect(panelRects()).toHaveLength(0);
    expect(screen.getByRole("radio", { name: /^solid/i })).toBeChecked();
  });

  it("shows six curated palettes until View all is pressed", async () => {
    const { user } = design();
    const group = () => screen.getByRole("group", { name: "Palette" });
    expect(within(group()).getAllByRole("radio")).toHaveLength(6);
    const toggle = screen.getByRole("button", { name: "View all 24 palettes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(within(group()).getAllByRole("radio")).toHaveLength(24);
    expect(screen.getByRole("button", { name: "Show fewer palettes" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps six palettes collapsed, swapping a selected palette outside the curated six into the Monochrome slot", async () => {
    const { user } = design();
    await user.click(screen.getByRole("button", { name: "View all 24 palettes" }));
    await user.click(screen.getByRole("radio", { name: /ember/i }));
    await user.click(screen.getByRole("button", { name: "Show fewer palettes" }));
    const names = within(screen.getByRole("group", { name: "Palette" }))
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent);
    expect(names).toEqual(["GitHub Classic", "GitLab Inspired", "Ember", "Paper & Ink", "Terracotta", "Lagoon"]);
    expect(screen.getByRole("radio", { name: /ember/i })).toBeChecked();
  });

  it("keeps light/dark mode visible next to the palettes, outside the collapsed sections", () => {
    design();
    const mode = screen.getByRole("group", { name: "Mode" });
    expect(mode.closest("details")).toBeNull();
    expect(within(mode).getByRole("radio", { name: /dark/i })).toBeChecked();
    const palette = screen.getByRole("group", { name: "Palette" });
    expect(mode.compareDocumentPosition(palette) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("groups advanced controls into collapsed sections with a summary of their state", () => {
    design();
    for (const [title, summary] of [
      ["Identity", "Off"],
      ["Colors & Background", "Solid"],
      ["Metrics & Charts", /of \d+ shown/],
      ["Display", "1 year · Spacious"],
    ] as const) {
      const details = screen.getByText(title, { selector: "summary span" }).closest("details")!;
      expect(details).not.toHaveAttribute("open");
      expect(details.querySelector("summary")).toHaveTextContent(summary);
    }
  });

  it("makes the advanced sections one single-open accordion that keeps settings when closed", async () => {
    const { user } = design();
    const section = (title: string) => screen.getByText(title, { selector: "summary span" }).closest("details")!;
    const titles = ["Identity", "Colors & Background", "Metrics & Charts", "Display"];
    // Native exclusive accordion: every section shares one name, so opening one closes the others.
    expect(new Set(titles.map((t) => section(t).getAttribute("name")))).toEqual(new Set(["more-options"]));

    await user.click(within(section("Colors & Background")).getByText("Colors & Background"));
    await user.click(screen.getByRole("radio", { name: /gradient/i }));
    await user.click(within(section("Colors & Background")).getByText("Colors & Background"));
    expect(section("Colors & Background")).not.toHaveAttribute("open");
    // Closed, the setting survives and its header still summarizes it.
    expect(section("Colors & Background").querySelector("summary")).toHaveTextContent("Gradient");
    expect(screen.getByRole("radio", { name: /gradient/i, hidden: true })).toBeChecked();
  });

  it("marks selected cards with a check as well as color, and keeps the radio semantics", () => {
    design();
    const layout = screen.getByRole("group", { name: "Layout" });
    expect(layout).toHaveAccessibleDescription("Stat cards, heatmap and breakdown.");
    const checked = within(layout).getByRole("radio", { checked: true });
    expect(checked).toHaveAccessibleName("Dashboard");
    const preset = within(screen.getByRole("group", { name: "Start with" })).getByRole("radio", { checked: true });
    expect(preset.closest("label")!.querySelector("svg.lucide-check")).not.toBeNull();
  });

  it("keeps Reset design with the controls, away from the preview", () => {
    design();
    const reset = screen.getByRole("button", { name: "Reset design" });
    expect(screen.getByRole("region", { name: "Live preview" })).not.toContainElement(reset);
  });

  it("feature toggles are switches with defaults from the registry", () => {
    design();
    expect(screen.getByRole("switch", { name: /best day/i })).not.toBeChecked();
    expect(screen.queryByRole("switch", { name: /total contributions/i })).not.toBeInTheDocument();
    expect(screen.getByText(/sum of contributions reported by each platform\. always shown\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Total contributions down" })).toBeEnabled();
  });

  it("keeps feature choices when switching layouts", async () => {
    const { user, preview } = design();
    await user.click(screen.getByRole("switch", { name: /best day/i }));
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /data-rich/i }));

    expect(screen.getByRole("switch", { name: /best day/i })).toBeChecked();
    expect(within(preview()).getByText("Best day")).toBeInTheDocument();
  });

  it("shows layout-only features as off, and moves the layout when they're switched", async () => {
    const { user, preview } = design();
    const layout = (name: RegExp) => screen.getByRole("radio", { name });
    await user.click(layout(/minimal/i));
    await user.click(screen.getByText("Metrics & Charts"));

    const breakdown = () => screen.getByRole("switch", { name: /breakdown/i });
    const trends = () => screen.getByRole("switch", { name: /trends/i });
    expect(breakdown()).not.toBeChecked();
    expect(trends()).not.toBeChecked();
    expect(screen.queryByText(/not shown in the/i)).not.toBeInTheDocument();

    breakdown().focus();
    await user.keyboard(" ");
    expect(layout(/dashboard/i)).toBeChecked();
    expect(breakdown()).toBeChecked();
    expect(screen.getByText("Layout switched to Dashboard to show GitHub / GitLab breakdown.")).toBeVisible();
    expect(within(preview()).getByText("Platform breakdown")).toBeInTheDocument();

    await user.click(trends());
    expect(layout(/data-rich/i)).toBeChecked();

    await user.click(trends());
    expect(layout(/data-rich/i)).toBeChecked();
    await user.click(breakdown());
    expect(layout(/minimal/i)).toBeChecked();
    expect(screen.getByText("Layout switched to Minimal after hiding GitHub / GitLab breakdown.")).toBeVisible();

    await user.click(screen.getByRole("switch", { name: /active days/i }));
    expect(layout(/minimal/i)).toBeChecked();
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
    await user.click(within(screen.getByRole("group", { name: "Mode" })).getByRole("radio", { name: /light/i }));
    await user.click(screen.getByRole("radio", { name: /paper & ink/i }));

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "Mode" })).getByRole("radio", { name: /light/i })).toBeChecked();
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

const GITHUB_YEAR = { start: toISODate("2025-11-02"), end: toISODate("2026-11-06") };
const GITLAB_YEAR = { start: toISODate("2025-11-06"), end: toISODate("2026-11-06") };
const THREE_YEARS = { start: toISODate("2023-11-03"), end: toISODate("2026-11-06") };

describe("historical ranges", () => {
  const github = {
    platform: "github" as const,
    username: "jenkruk",
    profileUrl: "https://github.com/jenkruk",
    days: [{ date: toISODate("2026-11-01"), count: 4 }],
  };
  const githubLive: ContributionsResponse = {
    dataset: combineSources([{ ...github, coverage: GITHUB_YEAR }], GITHUB_YEAR, "live"),
    results: [{ platform: "github", username: "jenkruk", status: "ok", total: 4 }],
  };
  const withHistory = (): ContributionsResponse => {
    const range = THREE_YEARS;
    return {
      dataset: combineSources(
        [{ ...github, coverage: range, days: [{ date: toISODate("2024-05-01"), count: 9 }, ...github.days] }],
        range,
        "live",
      ),
      results: githubLive.results,
      history: { years: 3, status: "ok" },
    };
  };
  const yearsGroup = () => within(screen.getByRole("group", { name: /date range/i }));

  it("loads 3 years of GitHub history once when 2 years is chosen, then switches without refetching", async () => {
    fetchMock.mockImplementation(async () => Response.json(withHistory()));
    const { user, preview } = setup({ initialRequest: { github: "jenkruk" }, initialResponse: githubLive });
    await user.click(yearsGroup().getByRole("radio", { name: "2 years" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/contributions?github=jenkruk&years=3", expect.anything());
    expect(await within(preview()).findByText("Nov 2, 2024 – Nov 1, 2025")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("yrs")).toBe("2");

    await user.click(yearsGroup().getByRole("radio", { name: "3 years" }));
    expect(within(preview()).getByText("Nov 3, 2023 – Nov 1, 2024")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables earlier years for GitLab-only accounts and explains why", () => {
    setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: live });
    expect(yearsGroup().getByRole("radio", { name: "2 years" })).toBeDisabled();
    expect(yearsGroup().getByRole("radio", { name: "3 years" })).toBeDisabled();
    expect(screen.getByRole("group", { name: /date range/i })).toHaveAccessibleDescription(
      /gitlab publishes only the last 12 months/i,
    );
  });

  it("says when history couldn't load and offers to try again", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        ...githubLive,
        history: { years: 3, status: "upstream", message: "down", retryable: true },
      }),
    );
    const { user } = setup({ initialRequest: { github: "jenkruk" }, initialResponse: githubLive });
    await user.click(yearsGroup().getByRole("radio", { name: "3 years" }));
    expect(await screen.findByText(/earlier github history couldn't be loaded/i)).toBeVisible();

    fetchMock.mockImplementation(async () => Response.json(withHistory()));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findAllByText("Nov 3, 2023 – Nov 1, 2024")).not.toHaveLength(0);
  });

  it("shows the by-period table with 'Not available' instead of zeros", async () => {
    const range = THREE_YEARS;
    const both: ContributionsResponse = {
      dataset: combineSources(
        [
          { ...github, coverage: range },
          {
            platform: "gitlab",
            username: "contactkruk",
            coverage: GITLAB_YEAR,
            days: [{ date: toISODate("2026-11-01"), count: 175 }],
          },
        ],
        range,
        "live",
      ),
      results: [githubLive.results[0]!, live.results[0]!],
      history: { years: 3, status: "ok" },
    };
    const { config } = decodeCardParams(new URLSearchParams("v=1&github=jenkruk&gitlab=contactkruk&yrs=3"));
    const { user } = setup({
      initialRequest: { github: "jenkruk", gitlab: "contactkruk" },
      initialResponse: both,
      initialConfig: config,
    });
    await user.click(screen.getByText("Detailed contribution data"));
    const table = screen.getByRole("table", { name: /^Contribution history/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      within(rows[0]!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["4", "175", "179"]);
    expect(
      within(rows[1]!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["0", "Not available", "Incomplete"]);
  });
});

describe("source attribution", () => {
  it("doesn't offer a switch to hide account labels, and says they're always shown", () => {
    setup({ initialStep: "design" });
    expect(screen.queryByRole("switch", { name: /account labels/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Handles" })).not.toBeInTheDocument();
    expect(screen.getByText(/usernames always appear on the graphic/i)).toBeInTheDocument();
  });

  it("shows the accounts even for a link that tried to hide them", () => {
    const { config } = decodeCardParams(new URLSearchParams("v=1&gitlab=contactkruk&f=heatmap,total&hl="));
    expect(config.features.platformLabels).toBe(true);
    const { preview } = setup({
      initialRequest: { gitlab: "contactkruk" },
      initialResponse: live,
      initialConfig: config,
    });
    expect(within(preview()).getAllByText(/@contactkruk/).length).toBeGreaterThan(0);
    const search = new URLSearchParams(window.location.search);
    expect(search.get("v")).toBe("1");
    expect(search.get("f")).toContain("labels");
    expect(search.has("hl")).toBe(false);
  });

  it("labels the data table's reporting period for multi-year designs", async () => {
    const range = THREE_YEARS;
    const both: ContributionsResponse = {
      dataset: combineSources(
        [
          {
            platform: "github",
            username: "jenkruk",
            coverage: range,
            days: [{ date: toISODate("2024-05-01"), count: 9 }],
          },
          {
            platform: "gitlab",
            username: "contactkruk",
            coverage: GITLAB_YEAR,
            days: [{ date: toISODate("2026-11-01"), count: 175 }],
          },
        ],
        range,
        "live",
      ),
      results: [
        { platform: "github", username: "jenkruk", status: "ok", total: 0 },
        { platform: "gitlab", username: "contactkruk", status: "ok", total: 175 },
      ],
      history: { years: 3, status: "ok" },
    };
    const { config } = decodeCardParams(new URLSearchParams("v=1&github=jenkruk&gitlab=contactkruk&yrs=3"));
    const { user } = setup({
      initialRequest: { github: "jenkruk", gitlab: "contactkruk" },
      initialResponse: both,
      initialConfig: config,
    });
    await user.click(screen.getByText("Detailed contribution data"));
    expect(screen.getByRole("region", { name: "Summary statistics" })).toHaveTextContent(
      "Last 12 months · GitHub + GitLab",
    );
    await user.click(screen.getByText("Monthly contributions"));
    expect(screen.getByRole("table", { name: "Monthly contributions · Last 12 months" })).toBeVisible();
  });
});
