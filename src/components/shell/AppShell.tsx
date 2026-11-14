import Link from "next/link";
import type { ReactNode } from "react";
import { LOGO_CELLS, LOGO_COLOR, LOGO_VIEWBOX } from "./logo-mark";
import { button, focusRing, link } from "@/components/ui/recipes";
import { GITVIS_REPO_URL, SITE_NAME, SITE_TAGLINE } from "@/config/site";
import { STUDIO_PATH } from "@/publish/studio-url";

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

/** GitHub mark from Octicons (MIT license). */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

export function AppShell({ children, page = "studio" }: { children: ReactNode; page?: "landing" | "studio" }) {
  const landing = page === "landing";
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-fg"
      >
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            aria-current={landing ? "page" : undefined}
            className={`-mx-1 flex min-h-10 min-w-0 items-center gap-3 rounded-control px-1 ${focusRing}`}
          >
            <LogoMark />
            <span className="text-section font-semibold tracking-tight">{SITE_NAME}</span>{" "}
            <span className="text-caption text-fg-muted max-sm:sr-only">{SITE_TAGLINE}</span>
          </Link>
          <nav aria-label="Site" className="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              href={GITVIS_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source on GitHub (opens in a new tab)"
              className={`${button("ghost", "sm")} px-2.5`}
            >
              <GitHubMark className="size-4" />
              <span className="max-[359px]:sr-only">Source</span>
            </a>
            {landing && (
              <Link href={STUDIO_PATH} className={button("secondary", "sm")}>
                Open studio
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main
        id="main"
        className={landing ? "w-full flex-1" : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-10"}
      >
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-caption text-fg-muted sm:px-6">
          <p>GitVis reads public contribution counts from GitHub and GitLab. It never reads repository contents.</p>
          <p>
            Open source (MIT) ·{" "}
            <a href={GITVIS_REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
              View the source on GitHub <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
