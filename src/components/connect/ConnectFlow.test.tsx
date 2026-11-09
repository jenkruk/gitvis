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
  const submit = () => screen.getByRole("button", { name: /see my contributions|loading/i });
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

  it("loads live data, stays on Connect after a partial failure, and offers retry", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loaded));
    const { user, github, gitlab, preview } = setup();
    await user.type(github(), "jenkruk");
    await user.type(gitlab(), "contactkruk{Enter}");

    expect(fetchMock).toHaveBeenCalledWith("/api/contributions?github=jenkruk&gitlab=contactkruk", expect.anything());
    expect(
      await screen.findByText(/GitLab @contactkruk: 175 contributions in the last 12 months/, { selector: "span" }),
    ).toBeVisible();
    expect(screen.getByText(/GitHub @jenkruk: GitHub is rate-limiting/, { selector: "span" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Connect your accounts");
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
    expect(await screen.findByRole("heading", { name: /design your graphic/i })).toHaveFocus();
    expect(preview()).not.toHaveAccessibleDescription(/sample data/i);
  });

  it("words each platform's total the way its profile does", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...loaded,
        results: [
          { platform: "github", username: "jenkruk", status: "ok", total: 650 },
          {
            platform: "gitlab",
            username: "contactkruk",
            status: "rate_limited",
            message: "Slow down.",
            retryable: true,
          },
        ],
      }),
    );
    const { user, github } = setup();
    await user.type(github(), "jenkruk{Enter}");
    expect(
      await screen.findByText("GitHub @jenkruk: 650 contributions in the last year.", { selector: "span" }),
    ).toBeVisible();
  });

  it("can continue with the platforms that did load", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loaded));
    const { user, gitlab, preview } = setup();
    await user.type(gitlab(), "contactkruk{Enter}");
    await user.click(await screen.findByRole("button", { name: "Continue with available data" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Design your graphic");
    expect(preview()).not.toHaveAccessibleDescription(/sample data/i);
  });

  it("announces progress politely and marks the form busy while loading", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, gitlab, submit } = setup();
    await user.type(gitlab(), "contactkruk");
    await user.click(submit());

    expect(screen.getByText("Loading contributions…")).toHaveAttribute("role", "status");
    expect(submit().closest("form")).toHaveAttribute("aria-busy", "true");

    await user.click(submit());
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

  it("renders server-loaded data without refetching, and can clear the accounts", async () => {
    const { user, preview } = setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: loaded });

    expect(preview()).not.toHaveAccessibleDescription(/sample data/i);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Change accounts" }));
    expect(screen.getByRole("textbox", { name: /gitlab username/i })).toHaveValue("contactkruk");
    await user.click(screen.getByRole("button", { name: "Clear accounts" }));
    expect(window.location.search).toBe("");
    expect(
      within(screen.getByRole("navigation", { name: "Progress" })).getByRole("button", { name: /publish/i }),
    ).toBeDisabled();
  });

  it("explains an empty year instead of showing an unexplained blank graphic", () => {
    const empty: ContributionsResponse = {
      dataset: combineSources([{ ...gitlabSource, days: [] }], range, "live"),
      results: [{ platform: "gitlab", username: "contactkruk", status: "ok", total: 0 }],
    };
    setup({ initialRequest: { gitlab: "contactkruk" }, initialResponse: empty });
    expect(screen.getByText(/no contributions in the last 12 months for gitlab @contactkruk/i)).toBeVisible();
  });

  it("keeps design choices when new data loads", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loaded));
    const { user, gitlab, submit } = setup({ initialStep: "design" });
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("button", { name: "Connect your accounts" }));
    await user.type(gitlab(), "contactkruk");
    await user.click(submit());
    await user.click(await screen.findByRole("button", { name: "Continue with available data" }));

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(
      within(screen.getByRole("img", { name: "Contribution activity" })).getAllByText(/@contactkruk/).length,
    ).toBeGreaterThan(0);
    expect(new URLSearchParams(window.location.search).get("layout")).toBe("minimal");
  });
});
