"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Studio, type StudioProps } from "./Studio";

// Cache Components keeps /studio mounted (hidden) after navigating away, so a later link into it would reuse
// that state instead of its URL. bfcacheId changes on push/replace but not on Back/Forward.
export function StudioRoute({ resume, ...props }: StudioProps & { resume: boolean }) {
  const { bfcacheId } = useRouter();
  const [session, setSession] = useState(bfcacheId);
  if (!resume && session !== bfcacheId) setSession(bfcacheId);
  return <Studio key={session} {...props} />;
}
