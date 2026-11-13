import { Geist, Geist_Mono } from "next/font/google";

/**
 * The studio's typefaces, shared by the app layout and Storybook (.storybook/preview.tsx), so
 * stories render with exactly the fonts the app ships.
 *
 * Geist Sans renders the first paint, so it is preloaded. Geist Mono only styles handles, URLs and
 * code further down the flow, so it loads on demand (its metric-matched fallback avoids layout shift).
 */
export const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
export const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

/** Class names that define the font variables (`--font-geist-*`) the Tailwind theme reads. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
