import { Palette, Plug, Share2 } from "lucide-react";

const STEPS = [
  { href: "#connect", label: "Connect", icon: Plug },
  { href: "#customize", label: "Customize", icon: Palette },
  { href: "#publish", label: "Publish", icon: Share2 },
] as const;

const linkClass =
  "flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** The three stages as in-page links to their sections. */
export function StepNav() {
  return (
    <nav aria-label="Steps">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {STEPS.map(({ href, label, icon: Icon }, i) => (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && (
              <span aria-hidden="true" className="mx-1 hidden h-px w-4 bg-zinc-300 sm:block dark:bg-zinc-700" />
            )}
            <a href={href} className={linkClass}>
              <Icon aria-hidden="true" className="size-4" />
              <span className="text-xs tabular-nums opacity-70">{i + 1}.</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
