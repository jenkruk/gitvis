import type { Metadata } from "next";
import { LandingDetails } from "@/components/landing/LandingDetails";
import { LandingHero } from "@/components/landing/LandingHero";
import { LegacyStepRedirect } from "@/components/landing/LegacyStepRedirect";
import { AppShell } from "@/components/shell/AppShell";
import { SITE_DESCRIPTION, SITE_HEADLINE } from "@/config/site";

const TITLE = "GitVis — GitHub + GitLab contribution graphics for your README";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_HEADLINE, description: SITE_DESCRIPTION, url: "/" },
  twitter: { title: SITE_HEADLINE, description: SITE_DESCRIPTION },
};

export default function Home() {
  return (
    <AppShell page="landing">
      <LegacyStepRedirect />
      <LandingHero />
      <LandingDetails />
    </AppShell>
  );
}
