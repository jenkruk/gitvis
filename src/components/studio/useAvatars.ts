"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConnectRequest } from "@/adapters/connect";
import type { IdentityConfig } from "@/config/config";
import { PLATFORM_IDS } from "@/domain/types";
import type { AvatarImages } from "@/renderers/IdentityHeader";

export function useAvatars(request: ConnectRequest | null, identity: IdentityConfig): AvatarImages {
  const [loaded, setLoaded] = useState<Record<string, string | null>>({});

  const wanted = useMemo(
    () =>
      identity.style === "none" || !request
        ? []
        : PLATFORM_IDS.filter((p) => identity.avatars.includes(p) && request[p]).map((p) => ({
            platform: p,
            username: request[p]!,
            key: `${p}:${request[p]!.toLowerCase()}`,
          })),
    [identity.style, identity.avatars, request],
  );

  useEffect(() => {
    const controller = new AbortController();
    for (const { platform, username, key } of wanted) {
      if (key in loaded) continue;
      fetch(`/api/avatar?platform=${platform}&username=${encodeURIComponent(username)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? (res.json() as Promise<{ dataUri: string | null }>) : { dataUri: null }))
        .then(({ dataUri }) => setLoaded((prev) => ({ ...prev, [key]: dataUri })))
        .catch(() => {
          if (!controller.signal.aborted) setLoaded((prev) => ({ ...prev, [key]: null }));
        });
    }
    return () => controller.abort();
  }, [wanted, loaded]);

  return useMemo(
    () =>
      Object.fromEntries(
        wanted.flatMap(({ platform, key }) => (loaded[key] ? [[platform, loaded[key]] as const] : [])),
      ) as AvatarImages,
    [wanted, loaded],
  );
}
