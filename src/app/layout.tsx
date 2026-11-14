import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION } from "@/config/site";
import { siteOrigin } from "@/server/origin";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: "GitVis — Every contribution counts", template: "%s · GitVis" },
  description: SITE_DESCRIPTION,
  applicationName: "GitVis",
  openGraph: { type: "website", siteName: "GitVis", locale: "en_US" },
  twitter: { card: "summary_large_image" },
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
