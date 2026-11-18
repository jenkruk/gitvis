import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { focusRing, overline } from "@/components/ui/recipes";
import { GITVIS_ISSUES_URL, GITVIS_REPO_URL } from "@/config/site";

export const LAST_UPDATED = { iso: "2026-11-17", label: "17 November 2026" } as const;

const source = (path: string) => `${GITVIS_REPO_URL}/blob/main/${path}`;
const VERCEL_ANALYTICS_PRIVACY = "https://vercel.com/docs/analytics/privacy-policy";
const VERCEL_PRIVACY_POLICY = "https://vercel.com/legal/privacy-policy";
const GITHUB_IMAGE_PROXY =
  "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls";

const AT_A_GLANCE = [
  "No accounts or sign-in, and you never give GitVis an access token.",
  "Only public contribution counts are used, never repository contents.",
  "GitVis's own cache expires on its own: most of it within about a week, earlier GitHub years within 30 days.",
  "Page views are counted without cookies, and identifying details are filtered out before a pageview is sent.",
] as const;

export const RETENTION = [
  {
    what: "Recent contribution counts (each platform's past year)",
    why: "Quick images; refreshed every 12 hours when viewed",
    kept: "Up to about 7½ days",
  },
  {
    what: "Earlier GitHub years (multi-year designs only)",
    why: "Finished years rarely change",
    kept: "Up to 30 days (the current year: 1 day)",
  },
  {
    what: "Profile pictures",
    why: "Embedded in the image",
    kept: "Up to 7 days, refreshed after a day when viewed. A failed lookup is remembered for 1 hour.",
  },
  {
    what: "“Account not found” results",
    why: "Avoids repeated lookups",
    kept: "1 hour",
  },
] as const;

const prose =
  "inline rounded-sm font-medium text-accent underline decoration-accent/40 decoration-1 underline-offset-4 hover:decoration-accent";

function A({ href, children }: { href: string; children: string }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={`${prose} ${focusRing}`}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer", "aria-label": `${children} (opens in a new tab)` }
        : {})}
    >
      {children}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-heading font-semibold text-balance text-fg">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-body text-fg-muted [&_strong]:font-semibold [&_strong]:text-fg">
        {children}
      </div>
    </section>
  );
}

const list = "list-disc space-y-2 pl-5 marker:text-fg-subtle";
const code = "font-mono text-code text-fg";

export function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header>
        <p className={overline}>GitVis</p>
        <h1 className="mt-2 text-title font-semibold text-balance text-fg">Privacy</h1>
        <p className="mt-2 text-caption text-fg-muted">
          Last updated: <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
        </p>
        <p className="mt-5 text-lede text-pretty text-fg-muted">
          GitVis is built to need as little information as possible. There are no accounts, no cookies for analytics or
          sign-in, and no access to your repositories. This page explains what GitVis does handle, why it needs it, and
          for how long.
        </p>
      </header>

      <section aria-labelledby="glance-heading" className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 id="glance-heading" className={overline}>
          At a glance
        </h2>
        <ul className="mt-4 grid gap-y-3">
          {AT_A_GLANCE.map((fact) => (
            <li key={fact} className="flex gap-2.5 text-body text-fg-muted">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </section>

      <Section id="what-heading" title="What GitVis does">
        <p>
          GitVis turns public GitHub and GitLab contribution activity into a graphic for your README. You don&apos;t
          create an account or sign in, and GitVis never asks you for an access token or for permission to your
          repositories. GitHub&apos;s API requires a token, so GitVis&apos;s server uses its own; it never reaches your
          browser and gives no access to your account.
        </p>
      </Section>

      <Section id="data-heading" title="Public contribution data">
        <p>
          When you enter a username in the studio, or someone views a published graphic, GitVis&apos;s server requests:
        </p>
        <ul className={list}>
          <li>
            <strong>From GitHub:</strong> the public contribution calendar, meaning the number of contributions on each
            day. When a profile owner has chosen to show private contributions publicly, GitHub reports them as
            aggregate counts, without repository names or contents.
          </li>
          <li>
            <strong>From GitLab:</strong> the public contribution calendar, the same daily counts GitLab shows on the
            profile, which likewise include private activity only as counts when its owner has chosen to show it.
          </li>
          <li>
            <strong>A profile picture</strong>, only when the design shows one, from GitHub or GitLab. GitLab may serve
            it from Gravatar.
          </li>
        </ul>
        <p>
          GitVis never reads repository names, code, commits, issues or other repository contents, and it doesn&apos;t
          request access to private repositories.
        </p>
        <p>
          In the studio, the usernames and design choices you enter are kept in the page address, so a reload or an Edit
          link restores your work, and they&apos;re sent to GitVis&apos;s server to load your data. GitVis doesn&apos;t
          store them in cookies or browser storage.
        </p>
        <p>
          A published image address contains your usernames and design settings, including any display name or title you
          typed, because that&apos;s what tells GitVis how to draw the image. Anyone who can see your README can see
          that address.
        </p>
      </Section>

      <Section id="cache-heading" title="What's cached, and for how long">
        <p>
          Caching lets your graphic load quickly without asking GitHub or GitLab each time it&apos;s viewed.
          GitVis&apos;s cache entries expire automatically: a graphic that keeps being viewed keeps getting fresh
          copies, and one that stops being viewed ages out.
        </p>
        <dl className="divide-y divide-line rounded-card border border-line">
          {RETENTION.map((row) => (
            <div key={row.what} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-6">
              <dt className="font-medium text-fg">{row.what}</dt>
              <dd>
                <span className="text-fg">{row.kept}</span>
                <span className="mt-0.5 block text-caption">{row.why}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p>
          <strong>Copies outside GitVis&apos;s cache.</strong> Finished images are also kept by Vercel&apos;s network,
          by browsers and by GitHub&apos;s image proxy. GitVis tells them to keep an up-to-date image no later than the
          end of its 12-hour data window (00:00 or 12:00 UTC), but it can&apos;t guarantee how long each of them keeps a
          copy. Vercel&apos;s hosting logs follow Vercel&apos;s own retention.
        </p>
        <p>
          <strong>Rate limiting.</strong> To limit abuse, GitVis counts requests per IP address in its server&apos;s
          memory, in one-minute windows. GitVis doesn&apos;t write these counts to storage or to its logs; they&apos;re
          cleared when that server instance stops, or sooner when the list fills up.
        </p>
      </Section>

      <Section id="analytics-heading" title="Website analytics">
        <p>
          GitVis uses <A href={VERCEL_ANALYTICS_PRIVACY}>Vercel Web Analytics</A> to count visits to its home page and
          studio. GitVis doesn&apos;t use cookies for analytics: Vercel tells visits apart with a hash of each request
          and keeps visitor sessions for no more than 24 hours. Each counted view records its page, the referring
          site&apos;s domain, and general details such as country, browser, operating system and device type.
        </p>
        <p>Before an analytics pageview is sent, GitVis:</p>
        <ul className={list}>
          <li>
            <strong>Counts only two pages:</strong> <code className={code}>/</code> and{" "}
            <code className={code}>/studio</code>.
          </li>
          <li>
            <strong>Removes query strings and fragments</strong> from the page address, so the usernames and design
            settings in studio and Edit links aren&apos;t sent.
          </li>
          <li>
            <strong>Keeps a referring site only as its domain</strong>, such as <code className={code}>github.com</code>
            , when that&apos;s all the browser reports. If the referrer includes a page path or query, such as a GitHub
            repository page, that visit isn&apos;t counted at all.
          </li>
        </ul>
        <p>
          Image addresses (<code className={code}>/api/card</code>, <code className={code}>/api/label</code>) and other
          endpoints aren&apos;t part of analytics, and GitVis sends no custom events. Because of this filtering, the
          analytics deliberately undercount visits.
        </p>
      </Section>

      <Section id="hosting-heading" title="Hosting and other services">
        <ul className={list}>
          <li>
            <strong>Vercel</strong> hosts GitVis. Separately from Web Analytics, and for every request including images,
            it processes technical request information, such as IP addresses, browser details and the addresses
            requested (which, for images and studio links, contain usernames), to serve the site, protect it from abuse
            and keep logs. See <A href={VERCEL_PRIVACY_POLICY}>Vercel&apos;s privacy policy</A>.
          </li>
          <li>
            <strong>GitHub and GitLab</strong> supply the public contribution data and profile pictures. GitLab profile
            pictures may come from <strong>Gravatar</strong>. These requests come from GitVis&apos;s server, not your
            browser, and include the username being looked up.
          </li>
          <li>
            <strong>GitHub&apos;s image proxy:</strong> when a GitVis image appears in a GitHub README, GitHub loads it
            through its <A href={GITHUB_IMAGE_PROXY}>image proxy</A>, so GitVis receives a request from GitHub, not from
            the person reading the README.
          </li>
          <li>
            <strong>Nothing else:</strong> fonts are bundled with the site, and its pages load no scripts, fonts or
            images from other websites. There are no ads and no social widgets.
          </li>
        </ul>
      </Section>

      <Section id="check-heading" title="Check it yourself">
        <p>GitVis is open source, so every statement on this page can be checked against the code:</p>
        <ul className={list}>
          <li>
            the <A href={source("src/app/analytics-filter.ts")}>analytics filter</A>;
          </li>
          <li>
            <A href={source("src/server/cached.ts")}>contribution caching</A> and{" "}
            <A href={source("src/server/history.ts")}>history caching</A>;
          </li>
          <li>
            <A href={source("src/server/avatars.ts")}>profile pictures</A> and{" "}
            <A href={source("src/server/rate-limit.ts")}>rate limiting</A>;
          </li>
          <li>
            the <A href={source("docs/ARCHITECTURE.md")}>architecture notes</A>.
          </li>
        </ul>
      </Section>

      <Section id="contact-heading" title="Contact">
        <p>
          For privacy questions, <A href={GITVIS_ISSUES_URL}>open an issue on GitHub</A>. Issues are public, so please
          don&apos;t include personal or private information. To report a security vulnerability, follow the{" "}
          <A href={source("SECURITY.md")}>security policy</A>.
        </p>
      </Section>

      <Section id="changes-heading" title="Changes">
        <p>
          If GitVis changes how it handles data, this page and its date will change. Its full history is public in the{" "}
          <A href={GITVIS_REPO_URL}>repository</A>.
        </p>
      </Section>
    </article>
  );
}
