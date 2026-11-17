"use client";

import { Analytics } from "@vercel/analytics/next";
import { filterAnalyticsEvent } from "./analytics-filter";

export default function AnalyticsTracker() {
  return <Analytics beforeSend={(event) => filterAnalyticsEvent(event, document.referrer)} />;
}
