import type { ReactNode } from "react";
import { LOGO_CELLS, LOGO_COLOR, LOGO_VIEWBOX } from "./logo-mark";
import { link } from "@/components/ui/recipes";
import { GITVIS_REPO_URL } from "@/config/site";

function LogoMark() {
  return (
    <svg
      width={LOGO_VIEWBOX}
      height={LOGO_VIEWBOX}
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      aria-hidden="true"
      className="shrink-0"
      style={{ color: LOGO_COLOR }}
    >
      {LOGO_CELLS.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={cell.size}
          height={cell.size}
          rx={cell.radius}
          fill="currentColor"
          opacity={cell.opacity}
        />
      ))}
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-fg"
      >
        Skip to content
      </a>
      {/* Header and footer mirror each other: the same container, a hairline, caption-sized text. */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <LogoMark />
          <p className="text-section font-semibold tracking-tight">GitVis</p>
          <p className="text-caption text-fg-muted max-[359px]:sr-only">Every contribution counts.</p>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-caption text-fg-muted sm:px-6">
          <p>GitVis combines public contribution counts. It never reads private repository contents.</p>
          <p>
            Open source (MIT) ·{" "}
            <a href={GITVIS_REPO_URL} className={link}>
              View the source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
