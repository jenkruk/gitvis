import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContributionsResponse } from "@/adapters/connect";
import { combineSources } from "@/domain/combine";
import { addDays, toISODate, trailingYear } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
import { Studio } from "./Studio";

const AVATAR = "data:image/png;base64,iVBORw0KGgo=";
const end = toISODate("2026-11-06");
const live: ContributionsResponse = {
  dataset: combineSources(
    [
      {
        platform: "github",
        username: "jenkruk",
        profileUrl: "https://github.com/jenkruk",
        days: Array.from({ length: 50 }, (_, i) => ({ date: addDays(end, -i * 2), count: 2 })),
      },
    ],
    trailingYear(end),
    "live",
  ),
  results: [{ platform: "github", username: "jenkruk", status: "ok", total: 100 }],
};

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ dataUri: AVATAR }));
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: Partial<Parameters<typeof Studio>[0]> = {}) {
  const user = userEvent.setup();
  render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" initialStep="design" {...props} />);
  const preview = () => screen.getByTestId("preview-column").querySelector("svg")!;
  const search = () => new URLSearchParams(window.location.search);
  return { user, preview, search };
}

describe("profile header controls", () => {
  it("switch presets with arrow keys and show the typed name in the preview immediately", async () => {
    const { user, preview, search } = setup();
    const group = screen.getByRole("group", { name: "Profile header" });
    within(group).getByRole("radio", { name: /^none/i }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(within(group).getByRole("radio", { name: /full profile/i })).toBeChecked();

    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Jen Kruk");
    await user.type(screen.getByRole("textbox", { name: /professional title/i }), "Engineer");
    expect(preview().querySelector("title")).toHaveTextContent("Contribution activity — Jen Kruk");
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveAccessibleDescription(/8\/40 characters/);
    expect(search().get("hdr")).toBe("full");
    expect(search().get("name")).toBe("Jen Kruk");
  });

  it("fetch avatars only once they're switched on, then embed them in the preview", async () => {
    const { user, preview } = setup({ initialRequest: { github: "jenkruk" }, initialResponse: live });
    await user.click(
      within(screen.getByRole("group", { name: "Profile header" })).getByRole("radio", { name: /compact identity/i }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const avatars = screen.getByRole("group", { name: "Avatars" });
    await user.click(within(avatars).getByRole("checkbox", { name: "GitHub" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/avatar?platform=github&username=jenkruk", expect.anything());
    await vi.waitFor(() => expect(preview().querySelector("image")?.getAttribute("href")).toBe(AVATAR));
  });
});

describe("metric ordering", () => {
  it("moves metrics with buttons and announces the new position", async () => {
    const { user, search } = setup();
    await user.click(screen.getByRole("button", { name: "Move Best day up" }));
    expect(screen.getByText("Best day moved to position 3 of 5.")).toHaveAttribute("role", "status");
    expect(search().get("ord")).toBe("total,active,best,streak,current");
    expect(screen.getByRole("button", { name: "Move Total contributions up" })).toBeDisabled();
  });
});

describe("colors and backgrounds", () => {
  it("transparent background forces theme-matching in Publish", async () => {
    const { user } = setup({ initialRequest: { github: "jenkruk" }, initialResponse: live });
    await user.click(
      within(screen.getByRole("group", { name: /background/i })).getByRole("radio", { name: /transparent/i }),
    );
    await user.click(screen.getByRole("button", { name: "Continue to publish" }));
    const theme = screen.getByRole("group", { name: "README theme" });
    expect(within(theme).getByRole("radio", { name: /always dark/i })).toBeDisabled();
    expect(within(theme).getByRole("radio", { name: /match reader's theme/i })).toBeChecked();
    expect(theme).toHaveAccessibleDescription(/always match the reader's theme/i);
  });

  it("ends the README snippet with 'Get Yours' and no option to add other links", async () => {
    const { user } = setup({ initialRequest: { github: "jenkruk" }, initialResponse: live });
    await user.click(screen.getByRole("button", { name: "Continue to publish" }));
    expect(screen.queryByRole("checkbox", { name: /profile links/i })).not.toBeInTheDocument();
    const snippet = (screen.getByRole("textbox", { name: /markdown/i }) as HTMLTextAreaElement).value;
    // Ends with the "Get Yours" link (drawn as a label image) to the GitVis site.
    expect(snippet).toMatch(/<a href="https:\/\/gitvis\.test">\s*<picture>[\s\S]*alt="Get Yours"[\s\S]*<\/a>\s*<\/p>$/);
    expect(snippet).not.toContain("https://gitvis.test/?"); // the image never links into the studio
  });

  it("platform colors are labelled, reflected in the URL and resettable", async () => {
    const { user, search } = setup();
    const input = screen.getByLabelText("GitHub", { selector: "input[type=color]" });
    // Color inputs can't be typed into; fire the change like a picker would.
    await user.click(input);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "#ff7a59");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input).toHaveAccessibleDescription("Custom #ff7a59.");
    expect(search().get("pc")).toBe("github:ff7a59");
    await user.click(screen.getByRole("button", { name: "Reset GitHub color" }));
    expect(input).toHaveAccessibleDescription("Palette default.");
  });
});

describe("date range and density", () => {
  it("offers 1, 2 and 3 years; earlier years need a connected GitHub account", () => {
    setup();
    const group = screen.getByRole("group", { name: /date range/i });
    expect(within(group).getByRole("radio", { name: "1 year" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "2 years" })).toBeDisabled();
    expect(within(group).getByRole("radio", { name: "3 years" })).toBeDisabled();
    expect(group).toHaveAccessibleDescription(/connect a github account to show earlier years/i);
  });

  it("keeps a legacy 30-day link's range until another option is chosen", async () => {
    const { config } = decodeCardParams(new URLSearchParams("v=1&github=jenkruk&range=30"));
    const { user, preview, search } = setup({
      initialRequest: { github: "jenkruk" },
      initialResponse: live,
      initialConfig: config,
    });
    const group = () => screen.getByRole("group", { name: /date range/i });
    expect(within(group()).getByRole("radio", { name: /last 30 days \(from your link\)/i })).toBeChecked();
    expect(preview().querySelector("desc")).toHaveTextContent(/from Oct 8, 2026 to Nov 6, 2026/);
    expect(search().get("range")).toBe("30");

    await user.click(within(group()).getByRole("radio", { name: "1 year" }));
    expect(search().get("range")).toBeNull();
    expect(within(group()).queryByRole("radio", { name: /from your link/i })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: "Density" })).getByRole("radio", { name: "Compact" }));
    expect(search().get("den")).toBe("compact");
  });
});

describe("Edit link restores Phase 4 settings", () => {
  it("restores every control from the URL", () => {
    const { config } = decodeCardParams(
      new URLSearchParams(
        "v=1&github=jenkruk&palette=nordic-frost&hdr=full&av=github&name=Jen&title=Eng&bg=gradient&pc=gitlab:123456&ord=best,total&range=90&den=compact",
      ),
    );
    setup({ initialConfig: config });
    expect(screen.getByRole("radio", { name: /nordic frost/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /full profile/i })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Jen");
    expect(screen.getByRole("radio", { name: /gradient/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /last 90 days \(from your link\)/i })).toBeChecked();
    expect(screen.getByRole("button", { name: "Move Best day up" })).toBeDisabled(); // first in order
    expect(screen.getByLabelText("GitLab", { selector: "input[type=color]" })).toHaveValue("#123456");
  });
});
