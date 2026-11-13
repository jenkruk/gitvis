import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitVis — Every contribution counts",
  description:
    "Combine GitHub and GitLab contribution calendars into one customizable graphic for your GitHub profile README.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#10151b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-body text-fg">{children}</body>
    </html>
  );
}
