import { Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Geist Mono isn't preloaded: it first appears below the fold, and its metric-matched fallback avoids layout shift.
export const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
