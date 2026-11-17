import type { BeforeSendEvent } from "@vercel/analytics/next";

export const TRACKED_PATHS: readonly string[] = ["/", "/studio"];

// Vercel's collector sends document.referrer verbatim and beforeSend can't edit it, so a referrer that could
// identify someone (a repository path, a query) suppresses the pageview instead of being sent.
export function isSafeReferrer(referrer: string, pageHost: string): boolean {
  if (referrer === "") return true;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.host === pageHost) return true;
  return url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
}

export function filterAnalyticsEvent(event: BeforeSendEvent, referrer: string): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  const url = new URL(event.url);
  if (!TRACKED_PATHS.includes(url.pathname)) return null;
  if (!isSafeReferrer(referrer, url.host)) return null;
  return { ...event, url: `${url.origin}${url.pathname}` };
}
