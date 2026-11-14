import { Check } from "lucide-react";
import { link, overline } from "@/components/ui/recipes";
import { GITVIS_REPO_URL } from "@/config/site";

const STEPS = [
  {
    step: "Connect",
    title: "One view of your work",
    body: "Enter your GitHub and/or GitLab usernames to create one contribution graphic.",
  },
  {
    step: "Design",
    title: "Make it yours",
    body: "Choose a layout, a palette and the statistics you want to show.",
  },
  {
    step: "Publish",
    title: "Set it and forget it",
    body: "Copy one Markdown snippet into your GitHub README. The data refreshes on its own — no GitHub Actions, no manual updates.",
  },
] as const;

const FACTS = [
  "No sign-in, and no access to your repositories.",
  "No GitHub Actions, tokens or database to set up.",
  "Counts come from GitHub’s and GitLab’s public contribution calendars. Repository contents are never read.",
  "Private contributions appear only as counts, and only if your profile already shows them.",
  "Each platform counts different kinds of activity, so every number is labelled by its source.",
] as const;

export function LandingDetails() {
  return (
    <>
      <section aria-labelledby="how-heading" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <h2 id="how-heading" className={overline}>
            How it works
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((item, i) => (
              <li key={item.step} className="border-t border-line-strong/40 pt-5">
                <p className="font-mono text-code text-accent tabular-nums">
                  {String(i + 1).padStart(2, "0")} <span className="text-fg-muted">— {item.step}</span>
                </p>
                <h3 className="mt-2 text-heading font-semibold text-fg">{item.title}</h3>
                <p className="mt-2 max-w-sm text-body text-fg-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust-heading">
        <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-6 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-16 xl:gap-x-16">
          <div>
            <h2 id="trust-heading" className="text-heading font-semibold text-balance text-fg">
              Free, open source, and careful with your data
            </h2>
            <p className="mt-2 max-w-md text-body text-fg-muted">
              GitVis is MIT-licensed. Read the code, open an issue, or run your own copy.
            </p>
            <a href={GITVIS_REPO_URL} target="_blank" rel="noopener noreferrer" className={`${link} mt-3`}>
              View the source on GitHub <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <ul className="grid max-w-2xl gap-y-3">
            {FACTS.map((fact) => (
              <li key={fact} className="flex gap-2.5 text-body text-fg-muted">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
