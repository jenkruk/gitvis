import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformResult } from "@/adapters/connect";
import { Studio } from "@/components/studio/Studio";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
import { PublishPanel, type PublishPanelProps } from "./PublishPanel";
import type { SnippetOptions } from "@/publish/snippets";

const origin = "https://gitvis.test";
const okResults: PlatformResult[] = [{ platform: "github", username: "jenkruk", status: "ok", total: 630 }];

const fetchMock = vi.fn<typeof fetch>();
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() }));
});
afterEach(() => vi.unstubAllGlobals());

/** Holds snippet options the way Studio does. */
function Harness({
  initialOptions = { theme: "selected", responsive: false },
  ...props
}: Omit<PublishPanelProps, "options" | "onOptionsChange"> & { initialOptions?: SnippetOptions }) {
  const [options, setOptions] = useState<SnippetOptions>(initialOptions);
  return <PublishPanel {...props} options={options} onOptionsChange={setOptions} />;
}

function setup(
  config: VisualizationConfig = createDefaultConfig(),
  results = okResults,
  initialOptions?: SnippetOptions,
) {
  const user = userEvent.setup();
  // After setup(): user-event installs its own clipboard stub, which we replace.
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(
    <Harness
      origin={origin}
      request={{ github: "jenkruk" }}
      results={results}
      config={config}
      initialOptions={initialOptions}
    />,
  );
  const markdown = () => screen.getByRole("textbox", { name: "README Markdown" }) as HTMLTextAreaElement;
  return { user, markdown };
}

describe("PublishPanel", () => {
  it("on preview deployments, says published URLs point at production", () => {
    render(
      <Harness
        origin="https://gitvis.app"
        request={{ github: "jenkruk" }}
        results={okResults}
        config={createDefaultConfig()}
        isPreviewDeployment
      />,
    );
    expect(screen.getByText(/this is a preview deployment/i)).toHaveTextContent("gitvis.app");
    const markdown = screen.getByRole("textbox", { name: "README Markdown" }) as HTMLTextAreaElement;
    expect(markdown.value).toContain("https://gitvis.app/api/card?");
    expect(markdown.value).not.toMatch(/vercel\.app/);
  });

  it("refuses to publish sample data and explains how to proceed", () => {
    render(<Harness origin={origin} request={null} results={[]} config={createDefaultConfig()} />);
    expect(screen.getByText(/connect a github or gitlab account to publish/i)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "README Markdown" })).not.toBeInTheDocument();
  });

  it("shows a linked Markdown image whose URLs restore the exact design", () => {
    const config = {
      ...createDefaultConfig(),
      layout: "minimal" as const,
      palette: "ember" as const,
      mode: "light" as const,
    };
    const { markdown } = setup(config);
    const match = /^\[!\[(.+)\]\((.+)\)\]\((.+)\)$/.exec(markdown().value)!;
    expect(match[1]).toBe("GitVis contribution activity for GitHub @jenkruk");
    for (const url of [new URL(match[2]!), new URL(match[3]!)]) {
      expect(decodeCardParams(url.searchParams)).toEqual({ request: { github: "jenkruk" }, config, issues: [] });
    }
    expect(new URL(match[2]!).pathname).toBe("/api/card");
  });

  it("shows the real published image with the same alt text", () => {
    setup();
    const image = screen.getByRole("img", { name: "GitVis contribution activity for GitHub @jenkruk" });
    expect(image.getAttribute("src")).toMatch(/^https:\/\/gitvis\.test\/api\/card\?v=1&github=jenkruk/);
    expect(screen.getByText(/loading the published image/i)).toBeVisible();
  });

  it("reports an image that finished loading before hydration (SSR) as loaded", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(840);
    setup();
    expect(screen.getByText(/exactly what github will display/i)).toBeVisible();
    vi.restoreAllMocks();
  });

  it("adds a mobile-optimized source for narrow screens when enabled", async () => {
    const { user, markdown } = setup();
    const toggle = screen.getByRole("checkbox", { name: /mobile-optimized image/i });
    expect(toggle).toHaveAccessibleDescription(/reflowed 400px layout/i);
    await user.click(toggle);
    expect(markdown().value).toContain('<source media="(max-width: 600px)" srcset="');
    expect(markdown().value).toMatch(/max-width: 600px\)" srcset="[^"]*size=compact/);
  });

  it("switches to a theme-matching <picture> snippet via a keyboard-operable radio group", async () => {
    const { user, markdown } = setup();
    const group = screen.getByRole("group", { name: "README theme" });
    within(group)
      .getByRole("radio", { name: /always dark/i })
      .focus();
    await user.keyboard("{ArrowDown}");
    expect(within(group).getByRole("radio", { name: /match reader's theme/i })).toBeChecked();
    expect(markdown().value).toContain("<picture>");
    expect(markdown().value).toContain("prefers-color-scheme: light");
  });

  it("copies Markdown and announces it politely", async () => {
    const { user, markdown } = setup();
    await user.click(screen.getByRole("button", { name: "Copy Markdown" }));
    expect(writeText).toHaveBeenCalledWith(markdown().value);
    expect(screen.getByRole("status")).toHaveTextContent("README Markdown copied to clipboard.");
  });

  it("falls back to selecting the text when the clipboard is unavailable", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Copy image URL" }));
    const field = screen.getByRole("textbox", { name: "Image URL" });
    expect(field).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(/press ctrl\+c or ⌘c/i);
  });

  it("downloads the published SVG", async () => {
    fetchMock.mockResolvedValue(new Response("<svg></svg>", { headers: { "X-GitVis-Status": "ok" } }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Download SVG" }));

    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/api\/card\?v=1&github=jenkruk/);
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText("SVG downloaded.")).toBeInTheDocument();
  });

  it("explains when the published image is currently an error card", async () => {
    fetchMock.mockResolvedValue(new Response("<svg></svg>", { headers: { "X-GitVis-Status": "not_found" } }));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(await screen.findByText(/currently an error card/i)).toBeInTheDocument();
  });

  it("warns that a failed platform will make the published image show an error", () => {
    setup(createDefaultConfig(), [
      ...okResults,
      { platform: "gitlab", username: "ghost", status: "not_found", message: "nope", retryable: false },
    ]);
    expect(screen.getByText(/GitLab @ghost couldn't be loaded/)).toBeVisible();
  });
});

describe("offline card source (Storybook)", () => {
  it("renders the preview and downloads from renderCard without touching the network", async () => {
    const renderCard = vi.fn((url: string) => `<svg data-url="${new URL(url).search.length}"></svg>`);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <Harness
        origin={origin}
        request={{ github: "jenkruk" }}
        results={okResults}
        config={createDefaultConfig()}
        renderCard={renderCard}
      />,
    );
    const image = screen.getByRole("img", { name: /github @jenkruk/i });
    expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(renderCard).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/gitvis\.test\/api\/card\?v=1&github=jenkruk/),
    );
    // The URL users copy is still the real one.
    expect(screen.getByRole("textbox", { name: "Image URL" })).toHaveValue(renderCard.mock.calls[0]![0]);

    await user.click(screen.getByRole("button", { name: "Download SVG" }));
    expect(await screen.findByText("SVG downloaded.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});

describe("Edit configuration link", () => {
  it("restores the design in the studio and preserves it across layout switches", async () => {
    const { config } = decodeCardParams(
      new URLSearchParams("v=1&github=jenkruk&layout=minimal&palette=forest-gold&mode=light&f=heatmap,best"),
    );
    const user = userEvent.setup();
    render(
      <Studio sampleDataset={createSampleDataset()} origin={origin} initialConfig={config} initialStep="design" />,
    );

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /forest & gold/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^light$/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /best day/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /active days/i })).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: /data-rich/i }));
    const search = new URLSearchParams(window.location.search);
    expect(search.get("layout")).toBe("data-rich");
    expect(search.get("palette")).toBe("forest-gold");
    expect(search.get("f")).toBe("heatmap,best");
  });
});
