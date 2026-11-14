"use client";

import { useEffect } from "react";
import { isStepId } from "@/components/shell/StepNav";
import { STUDIO_PATH } from "@/publish/studio-url";

/**
 * Before Nov 2026 the studio lived at `/`, so `/#design` or `/#publish` may be bookmarked. The
 * fragment never reaches the server (query-carrying URLs are redirected in next.config.ts), so the
 * landing page forwards those here. Renders nothing.
 */
export function LegacyStepRedirect() {
  useEffect(() => {
    const step = window.location.hash.slice(1);
    if (isStepId(step)) window.location.replace(`${STUDIO_PATH}${window.location.search}#${step}`);
  }, []);
  return null;
}
