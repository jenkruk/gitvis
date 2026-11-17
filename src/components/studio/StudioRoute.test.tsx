import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { StudioRoute } from "./StudioRoute";

const router = vi.hoisted(() => ({ bfcacheId: "a" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const dataset = createSampleDataset();

beforeEach(() => {
  router.bfcacheId = "a";
  window.history.replaceState(null, "", "/studio");
});

function route(props: { resume?: boolean; initialSample?: boolean }) {
  return <StudioRoute resume={false} sampleDataset={dataset} origin="https://gitvis.test" {...props} />;
}

const heading = () => screen.getByRole("heading", { level: 2 });

async function exploreSample() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /try it with sample data/i }));
  expect(heading()).toHaveTextContent("Design your graphic");
}

describe("studio route", () => {
  it("opens Connect from a fresh link even after the preserved studio moved to sample data", async () => {
    const view = render(route({}));
    await exploreSample();

    router.bfcacheId = "b";
    window.history.pushState(null, "", "/studio?palette=lagoon");
    view.rerender(route({}));
    expect(heading()).toHaveTextContent("Connect your accounts");
    expect(window.location.search).not.toContain("sample=1");
  });

  it("opens Design on sample data from a fresh sample link even after the preserved studio was on Connect", () => {
    const view = render(route({}));
    expect(heading()).toHaveTextContent("Connect your accounts");

    router.bfcacheId = "b";
    window.history.pushState(null, "", "/studio?sample=1#design");
    view.rerender(route({ initialSample: true }));
    expect(heading()).toHaveTextContent("Design your graphic");
    expect(screen.getByText(/previewing/i)).toHaveTextContent(/sample data/i);
  });

  it("keeps the studio's work on Back/Forward (same bfcacheId) and on a bare /studio link", async () => {
    const view = render(route({}));
    await exploreSample();

    view.rerender(route({ initialSample: false }));
    expect(heading()).toHaveTextContent("Design your graphic");

    router.bfcacheId = "b";
    view.rerender(route({ resume: true }));
    expect(heading()).toHaveTextContent("Design your graphic");
    expect(
      within(screen.getByRole("navigation", { name: "Progress" })).getByRole("button", { name: /design/i }),
    ).toHaveAttribute("aria-current", "step");
  });
});
