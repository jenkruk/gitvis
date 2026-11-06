import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContributionsResponse } from "@/adapters/connect";
import { Studio } from "@/components/studio/Studio";
import { combineSources } from "@/domain/combine";
import { toISODate, trailingYear } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";

const range = trailingYear(toISODate("2026-11-06"));
const gitlabSource = {
  platform: "gitlab" as const,
  username: "contactkruk",
  profileUrl: "https://gitlab.com/contactkruk",
  days: [{ date: toISODate("2026-11-01"), count: 175 }],
};

const loaded: ContributionsResponse = {
  dataset: combineSources([gitlabSource], range, "live"),
  results: [
    {
      platform: "github",
      username: "jenkruk",
      status: "rate_limited",
      message: "GitHub is rate-limiting requests.",
      retryable: true,
    },
    { platform: "gitlab", username: "contactkruk", status: "ok", total: 175 },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: Partial<Parameters<typeof Studio>[0]> = {}) {
  const user = userEvent.setup();
  render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" {...props} />);
  const github = () => screen.getByRole("textbox", { name: /github username/i });
  const gitlab = () => screen.getByRole("textbox", { name: /gitlab username/i });
  const submit = () => screen.getByRole("button", { name: /load contributions|loading/i });
  const preview = () => screen.getByRole("img", { name: "Contribution activity" });
  return { user, github, gitlab, submit, preview };
}

describe("Connect flow", () => {
  it("labels both fields as optional and links their hints", () => {
    const { github, gitlab } = setup();
    expect(github()).toHaveAccessibleName("GitHub username (optional)");
    expect(github()).toHaveAccessibleDescription(/profile url, github\.com/i);
    expect(gitlab()).toHaveAccessibleDescription(/profile url, gitlab\.com/i);
  });

  it("asks for at least one username and focuses the first field", async () => {
    const { user, github, submit } = setup();
    await user.click(submit());

    expect(github()).toHaveFocus();
    expect(github()).toHaveAccessibleDescription(/enter a github username, a gitlab username, or both/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flags an invalid username inline and focuses it", async () => {
    const { user, gitlab, submit } = setup();
    await user.type(gitlab(), "a..b");
    await user.click(submit());

    expect(gitlab()).toHaveFocus();
    expect(gitlab()).toBeInvalid();
    expect(gitlab()).toHaveAccessibleDescription(/isn't a valid gitlab username/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads live data, shows per-platform results and offers retry for transient failures", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loaded));
    const { user, github, gitlab, preview } = setup();
    await user.type(github(), "jenkruk");
    await user.type(gitlab(), "contactkruk{Enter}"); // Enter submits the form

    expect(fetchMock).toHaveBeenCalledWith("/api/contributions?github=jenkruk&gitlab=contactkruk", expect.anything());
    expect(await screen.findByText(/GitLab @contactkruk: 175 contributions/, { selector: "span" })).toBeVisible();
    expect(screen.getByText(/GitHub @jenkruk: GitHub is rate-limiting/, { selector: "span" })).toBeVisible();
    expect(preview()).not.toHaveAccessibleDescription(/sample data/i);
    // The address bar becomes the full Edit link (usernames + design).
    const search = new URLSearchParams(window.location.search);
    expect([search.get("v"), search.get("github"), search.get("gitlab"), search.get("layout")]).toEqual([
      "1",
      "jenkruk",
      "contactkruk",
      "dashboard",
    ]);

    fetchMock.mockResolvedValue(jsonResponse({ ...loaded, results: [loaded.results[1]] }));
    await user.click(screen.getByRole("button", { name: "Retry GitHub" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("announces progress politely and marks the preview busy while loading", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, gitlab, submit } = setup();
    await user.type(gitlab(), "contactkruk");
    await user.click(submit());

    expect(screen.getByText("Loading contributions…")).toHaveAttribute("role", "status");
    expect(screen.getByRole("img", { name: "Contribution activity" }).closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    await user.click(submit()); // duplicate submit is ignored, not blocked by disabling
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => resolve(jsonResponse(loaded)));
    expect(await screen.findByText(/175 contributions/, { selector: "[role=status]" })).toBeInTheDocument();
  });

  it("shows a retryable error when the request itself fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { user, gitlab, submit } = setup();
    await user.type(gitlab(), "contactkruk");
    await user.click(submit());

    expect(await screen.findByText(/couldn't reach gitvis/i, { selector: "p:not([role])" })).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(jsonResponse(loaded));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/175 contributions/, { selector: "span" })).toBeInTheDocument();
  });

  it("renders server-loaded data without refetching, and can return to sample data", async () => {
    const { user, preview } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: loaded });

    expect(screen.getByRole("textbox", { name: /gitlab username/i })).toHaveValue("contactkruk");
    expect(preview()).not.toHaveAccessibleDescription(/sample data/i);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /clear and use sample data/i }));
    expect(preview()).toHaveAccessibleDescription(/sample data/i);
    expect(window.location.search).toBe("");
  });

  it("explains an empty year instead of showing an unexplained blank graphic", () => {
    const empty: ContributionsResponse = {
      dataset: combineSources([{ ...gitlabSource, days: [] }], range, "live"),
      results: [{ platform: "gitlab", username: "contactkruk", status: "ok", total: 0 }],
    };
    setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: empty });
    expect(screen.getByText(/no contributions in the last 12 months for the connected accounts/i)).toBeVisible();
  });

  it("keeps design choices when new data loads", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loaded));
    const { user, gitlab, submit } = setup();
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.type(gitlab(), "contactkruk");
    await user.click(submit());
    await screen.findByText(/175 contributions/, { selector: "span" });

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(
      within(screen.getByRole("img", { name: "Contribution activity" })).getAllByText(/@contactkruk/).length,
    ).toBeGreaterThan(0);
    expect(new URLSearchParams(window.location.search).get("layout")).toBe("minimal");
  });
});
