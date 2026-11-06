import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { Studio } from "./Studio";

const dataset = createSampleDataset();

function setup() {
  const user = userEvent.setup();
  render(<Studio sampleDataset={dataset} origin="https://gitvis.test" />);
  const preview = () => screen.getByRole("img", { name: "Contribution activity" });
  return { user, preview };
}

describe("Studio", () => {
  it("renders an accessible preview labeled as sample data", () => {
    const { preview } = setup();
    expect(preview()).toHaveAccessibleDescription(/sample data, not real activity/i);
    expect(screen.getByText(/previewing/i)).toHaveTextContent(/sample data/i);
  });

  it("exposes layouts, palettes and modes as radio groups", () => {
    setup();
    expect(within(screen.getByRole("group", { name: "Layout" })).getAllByRole("radio")).toHaveLength(3);
    expect(within(screen.getByRole("group", { name: "Palette" })).getAllByRole("radio")).toHaveLength(9);
    expect(screen.getByRole("radio", { name: /dashboard/i })).toBeChecked();
  });

  it("feature toggles are switches with defaults from the registry", () => {
    setup();
    expect(screen.getByRole("switch", { name: /best day/i })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /total contributions/i })).toBeChecked();
  });

  it("keeps feature choices when switching layouts", async () => {
    const { user, preview } = setup();
    await user.click(screen.getByRole("switch", { name: /best day/i }));
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /data-rich/i }));

    expect(screen.getByRole("switch", { name: /best day/i })).toBeChecked();
    expect(within(preview()).getByText("Best day")).toBeInTheDocument();
  });

  it("explains when an enabled feature isn't shown by the current layout", async () => {
    const { user, preview } = setup();
    await user.click(screen.getByRole("radio", { name: /minimal/i }));

    const breakdown = screen.getByRole("switch", { name: /breakdown/i });
    expect(breakdown).toBeChecked();
    expect(breakdown).toHaveAccessibleDescription(/not shown in the minimal layout/i);
    expect(within(preview()).queryByText("Platform breakdown")).not.toBeInTheDocument();
  });

  it("supports keyboard: arrow keys move between layouts, Space toggles a switch", async () => {
    const { user } = setup();
    screen.getByRole("radio", { name: /dashboard/i }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /data-rich/i })).toBeChecked();

    screen.getByRole("switch", { name: /active days/i }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("switch", { name: /active days/i })).not.toBeChecked();
  });

  it("changes palette without resetting layout or mode", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: /minimal/i }));
    await user.click(screen.getByRole("radio", { name: /light/i }));
    await user.click(screen.getByRole("radio", { name: /ember/i }));

    expect(screen.getByRole("radio", { name: /minimal/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /light/i })).toBeChecked();
    expect(screen.getByText("Minimal layout, Ember palette, light mode.")).toHaveAttribute("role", "status");
  });
});
