import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AlertCircle, ArrowRight, CheckCircle2, Copy, Info, RotateCcw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ControlGroup, Disclosure, RadioCard, SelectionMark, Switch } from "@/components/studio/controls";
import { button, callout, field, hint, iconButton, linkButton, mono, overline, panel, selectableCard } from "./recipes";

/**
 * Studio foundations: the semantic tokens (src/app/globals.css) and the recipes
 * (./recipes.ts) every studio component is built from. Toggle the OS color scheme to
 * review dark mode. Nothing here themes the generated graphic.
 */

const SURFACES = [
  ["canvas", "bg-canvas", "Page background"],
  ["surface", "bg-surface", "Controls, cards, closed disclosures"],
  ["surface-raised", "bg-surface-raised", "Elevated panels, inputs, open disclosures"],
  ["surface-hover", "bg-surface-hover", "Hover fill, read-only fields"],
  ["selected", "bg-selected", "Selected cards (with the accent border)"],
  ["ink", "bg-ink", "Primary actions (neutral)"],
  ["accent", "bg-accent", "Mineral teal: selection, progress, links"],
  ["focus", "bg-focus", "Keyboard focus ring"],
] as const;

const TEXT = [
  ["fg", "text-fg", "Headings, labels, values"],
  ["fg-muted", "text-fg-muted", "Descriptions, hints, captions"],
  ["fg-subtle", "text-fg-subtle", "Placeholders, icons, overlines"],
  ["success", "text-success", "Success messages"],
  ["warning", "text-warning", "Warnings"],
  ["danger", "text-danger", "Errors"],
] as const;

const TYPE_SCALE = [
  ["title", "text-title font-semibold", "26/32 · 600", "Create your contribution graphic"],
  ["heading", "text-heading font-semibold", "20/28 · 600", "Design your graphic"],
  ["section", "text-section font-semibold", "15/22 · 600", "Palette"],
  ["label", "text-label font-medium", "14/20 · 500", "Developer profile card"],
  ["body", "text-body", "14/22 · 400", "Public contribution counts only — no sign-in."],
  ["caption", "text-caption text-fg-muted", "13/18 · 400", "The name in your profile URL, github.com/…"],
  ["overline", "text-overline font-semibold uppercase text-fg-subtle", "12/16 · 600 · +0.06em", "More options"],
  ["code", "font-mono text-code", "13/20 · Geist Mono", "@octocat · https://gitvis.example/api/card?v=1"],
] as const;

function Heading({ children }: { children: string }) {
  return <h2 className="text-heading font-semibold text-fg">{children}</h2>;
}

function Tokens() {
  return (
    <div className="space-y-8">
      <Heading>Color tokens</Heading>
      <section className="space-y-3">
        <h3 className={overline}>Surfaces</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SURFACES.map(([name, className, use]) => (
            <li key={name} className={`${panel} overflow-hidden`}>
              <div className={`h-14 border-b border-line ${className}`} />
              <div className="p-3">
                <p className={`${mono} text-fg`}>{name}</p>
                <p className={hint}>{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h3 className={overline}>Text and status</h3>
        <ul className={`${panel} divide-y divide-line`}>
          {TEXT.map(([name, className, use]) => (
            <li key={name} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span className={`text-label font-medium ${className}`}>{use}</span>
              <span className={`${mono} text-fg-muted`}>{name}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h3 className={overline}>Lines and radii</h3>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["rounded-control", "6px · buttons, inputs"],
              ["rounded-card", "10px · cards, disclosures"],
              ["rounded-stage", "14px · preview, page panels"],
            ] as const
          ).map(([radius, use]) => (
            <div key={radius} className="space-y-2">
              <div className={`size-20 border-2 border-line-strong bg-surface ${radius}`} />
              <p className={`${mono} text-fg`}>{radius}</p>
              <p className={hint}>{use}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Typography() {
  return (
    <div className="space-y-6">
      <Heading>Type scale</Heading>
      <p className={`max-w-prose ${hint}`}>
        Geist Sans for the interface, Geist Mono only for handles, URLs and code. Hierarchy comes from size first, then
        weight. Numbers that line up use tabular figures.
      </p>
      <dl className={`${panel} divide-y divide-line`}>
        {TYPE_SCALE.map(([name, className, spec, sample]) => (
          <div key={name} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
            <dt>
              <span className={`${mono} block text-fg`}>text-{name}</span>
              <span className={hint}>{spec}</span>
            </dt>
            <dd className={`min-w-0 break-words ${className}`}>{sample}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body">
        Tabular figures: <span className="tabular-nums">1,111 · 8,808 · 12/40</span>
      </p>
    </div>
  );
}

function Buttons() {
  return (
    <div className="space-y-6">
      <Heading>Buttons</Heading>
      <p className={hint}>One primary (lg) per step. Secondary for alternatives, ghost for low-emphasis actions.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={button("primary", "lg")}>
          Continue to publish
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className={button("primary")}>
          Primary
        </button>
        <button type="button" className={button("secondary")}>
          <Copy aria-hidden="true" className="size-4" />
          Secondary
        </button>
        <button type="button" className={button("ghost")}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Ghost
        </button>
        <button type="button" className={button("secondary", "sm")}>
          Small
        </button>
        <button type="button" aria-label="Move up" className={iconButton}>
          <ArrowRight aria-hidden="true" className="size-4 -rotate-90" />
        </button>
        <button type="button" className={button("secondary")} disabled>
          Disabled
        </button>
      </div>
      <p className="text-body text-fg-muted">
        Inline action:{" "}
        <button type="button" className={linkButton}>
          Change accounts
        </button>
      </p>
    </div>
  );
}

function Controls() {
  const [choice, setChoice] = useState("graphic");
  const [on, setOn] = useState(true);
  return (
    <div className="max-w-[400px] space-y-8">
      <Heading>Controls</Heading>
      <ControlGroup
        legend="Selectable cards"
        description="Selected cards use a teal border, a teal tint and a check; disabled ones are dashed."
      >
        <div className="grid gap-2">
          {["graphic", "profile", "disabled"].map((value) => (
            <RadioCard
              key={value}
              name="demo"
              value={value}
              checked={choice === value}
              disabled={value === "disabled"}
              onSelect={setChoice}
              mark
            >
              <span className="text-label font-medium capitalize">{value}</span>
            </RadioCard>
          ))}
        </div>
      </ControlGroup>
      <Switch
        id="demo-switch"
        label="Heatmap"
        description="Daily contribution calendar."
        checked={on}
        onChange={setOn}
      />
      <div>
        <label htmlFor="demo-field" className="text-label font-semibold">
          Display name
        </label>
        <input id="demo-field" className={`mt-1.5 ${field}`} placeholder="Avery Example" />
      </div>
      <Disclosure title="Disclosure" summary="One-line summary of the current state">
        <p className="text-body text-fg-muted">Collapsed content.</p>
      </Disclosure>
    </div>
  );
}

function Callouts() {
  return (
    <div className="max-w-2xl space-y-3">
      <Heading>Callouts</Heading>
      <p className={`flex items-start gap-2 ${callout("warning")}`}>
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        You&apos;re previewing sample data.
      </p>
      <p className={`flex items-start gap-2 ${callout("danger")}`}>
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        GitHub is temporarily unavailable.
      </p>
      <p className={`flex items-start gap-2 ${callout("success")}`}>
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        README Markdown copied.
      </p>
      <p className={callout("neutral")}>Connect a GitHub or GitLab account to publish.</p>
    </div>
  );
}

function Shell() {
  return (
    <AppShell>
      <h2 className="text-heading font-semibold">Page content</h2>
    </AppShell>
  );
}

/** Ring classes drawn statically, so the story shows keyboard focus without a keyboard. */
const FOCUSED = "outline-2 outline-offset-2 outline-focus";

function States() {
  const card = (checked: boolean, extra = "", disabled = false) => (
    <div className={`${selectableCard(checked, disabled)} p-3 ${extra}`}>
      <span className="text-label font-medium">Dashboard</span>
      <SelectionMark checked={checked} />
    </div>
  );
  return (
    <div className="max-w-3xl space-y-6">
      <Heading>Selection and focus</Heading>
      <p className={hint}>
        Selection is drawn inside the control (a 1px teal border, a teal tint, a check). Focus is a detached 2px ring
        shown for keyboard focus only, so both stay readable when they meet.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Default", card(false)],
          ["Hover", card(false, "bg-surface-hover text-fg")],
          ["Selected", card(true)],
          ["Keyboard focus", card(false, FOCUSED)],
          ["Selected + focused", card(true, FOCUSED)],
          ["Disabled", card(false, "", true)],
        ].map(([label, node]) => (
          <figure key={label as string} className="space-y-2">
            {node}
            <figcaption className={hint}>{label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Accordion() {
  return (
    <div className="max-w-[400px] space-y-2">
      <Heading>Single-open accordion</Heading>
      <p className={`${hint} pb-2`}>
        Disclosures sharing a name: opening one closes the other; each can be closed. Content stays mounted.
      </p>
      {["Identity", "Colors & Background", "Metrics & Charts", "Display"].map((title, i) => (
        <Disclosure
          key={title}
          name="foundations-accordion"
          title={title}
          summary={["Off", "Solid", "6 of 9 shown", "1 year"][i]}
        >
          <p className="text-body text-fg-muted">{title} settings.</p>
        </Disclosure>
      ))}
    </div>
  );
}

function Themes() {
  return (
    <div className="space-y-4">
      <Heading>Light and dark</Heading>
      <div className="grid gap-4 md:grid-cols-2">
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme} data-theme={theme} className="space-y-4 rounded-stage bg-canvas p-5 text-fg">
            <p className={overline}>{theme}</p>
            <div className="grid grid-cols-3 gap-2">
              {["Minimal", "Dashboard", "Data-rich"].map((label, i) => (
                <div key={label} className={`${selectableCard(i === 1)} justify-center p-3`}>
                  <span className={`text-label ${i === 1 ? "font-semibold" : "font-medium"}`}>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button("primary")}>
                Continue
              </button>
              <button type="button" className={button("secondary")}>
                Download SVG
              </button>
            </div>
            <p className={callout("warning")}>Earlier GitHub history couldn&apos;t be loaded.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGES = { Tokens, Typography, Buttons, Controls, States, Accordion, Themes, Callouts, Shell } as const;

function Foundation({ page }: { page: keyof typeof PAGES }) {
  const Page = PAGES[page];
  return <Page />;
}

const meta = {
  title: "Studio/Foundations",
  component: Foundation,
  args: { page: "Tokens" },
  argTypes: { page: { control: "select", options: Object.keys(PAGES) } },
} satisfies Meta<typeof Foundation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColorTokens: Story = { name: "Color tokens", args: { page: "Tokens" } };
export const TypeScale: Story = { name: "Type scale", args: { page: "Typography" } };
export const ButtonRecipes: Story = { name: "Buttons", args: { page: "Buttons" } };
export const ControlRecipes: Story = { name: "Controls", args: { page: "Controls" } };
export const SelectionAndFocus: Story = { name: "Selection and focus", args: { page: "States" } };
export const AccordionStory: Story = { name: "Single-open accordion", args: { page: "Accordion" } };
export const LightAndDark: Story = { name: "Light and dark", args: { page: "Themes" } };
export const CalloutRecipes: Story = { name: "Callouts", args: { page: "Callouts" } };
export const AppShellStory: Story = {
  name: "App shell",
  args: { page: "Shell" },
  parameters: { layout: "fullscreen" },
};
export const AppShellPhone: Story = {
  name: "App shell · phone",
  args: { page: "Shell" },
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "phoneSmall" } },
};
