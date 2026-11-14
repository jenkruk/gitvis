"use client";

import { useEffect } from "react";
import { isStepId } from "@/components/shell/StepNav";
import { STUDIO_PATH } from "@/publish/studio-url";

// URL fragments never reach the server, so `/#step` links can only be forwarded on the client.
export function LegacyStepRedirect() {
  useEffect(() => {
    const step = window.location.hash.slice(1);
    if (isStepId(step)) window.location.replace(`${STUDIO_PATH}${window.location.search}#${step}`);
  }, []);
  return null;
}
