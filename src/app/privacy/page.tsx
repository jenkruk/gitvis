import type { Metadata } from "next";
import { Privacy } from "@/components/privacy/Privacy";
import { AppShell } from "@/components/shell/AppShell";
import { PRIVACY_PATH } from "@/config/site";

const TITLE = "Privacy";
const DESCRIPTION =
  "What GitVis handles to draw your contribution graphic, how long it's cached, and how cookieless page-view analytics are filtered.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PRIVACY_PATH },
  openGraph: { title: `${TITLE} · GitVis`, description: DESCRIPTION, url: PRIVACY_PATH },
  twitter: { title: `${TITLE} · GitVis`, description: DESCRIPTION },
};

export default function PrivacyPage() {
  return (
    <AppShell page="privacy">
      <Privacy />
    </AppShell>
  );
}
