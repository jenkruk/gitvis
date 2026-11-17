"use client";

import { Analytics } from "@vercel/analytics/next";

export default function AnalyticsTracker() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (event.type !== "pageview") return null;

        const url = new URL(event.url);

        if (url.pathname !== "/" && url.pathname !== "/studio") {
          return null;
        }

        return {
          ...event,
          url: `${url.origin}${url.pathname}`,
        };
      }}
    />
  );
}
