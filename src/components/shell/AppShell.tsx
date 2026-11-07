import type { ReactNode } from "react";
import { LOGO_CELLS, LOGO_VIEWBOX } from "./logo-mark";

function LogoMark() {
  // 3×3 contribution-grid mark; decorative (the wordmark carries the name). Also the app icon.
  return (
    <svg
      width={LOGO_VIEWBOX}
      height={LOGO_VIEWBOX}
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      aria-hidden="true"
      className="text-emerald-500"
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-lg leading-tight font-semibold tracking-tight">GitVis</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Every contribution counts.</p>
            </div>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-zinc-600 sm:px-6 dark:text-zinc-400">
          GitVis combines public contribution counts. It never reads private repository contents.
        </p>
      </footer>
    </>
  );
}
