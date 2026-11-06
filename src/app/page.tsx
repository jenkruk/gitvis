import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Studio } from "@/components/studio/Studio";
import { StudioSkeleton } from "@/components/studio/StudioSkeleton";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
import { serverLoaders } from "@/server/cached";
import { loadContributions } from "@/server/contributions";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <AppShell>
      {/* searchParams are request-time data, so the studio streams in behind a static skeleton. */}
      <Suspense fallback={<StudioSkeleton />}>
        <StudioLoader searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

function toSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return search;
}

/** Public origin for published URLs. SITE_URL pins the canonical domain in production. */
async function resolveOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Edit links (`/?v=1&github=…&layout=…`) restore the full design leniently
 * (bad values fall back to defaults) and pre-load data on the server so shared
 * links render with real contributions immediately.
 */
async function StudioLoader({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { request, config } = decodeCardParams(toSearchParams(await searchParams));
  const origin = await resolveOrigin();
  if (request) await connection(); // "today" (new Date) must be computed per request, never prerendered
  const initialResponse = request ? await loadContributions(request, serverLoaders) : null;

  return (
    <Studio
      sampleDataset={createSampleDataset()}
      initialRequest={request}
      initialResponse={initialResponse}
      initialConfig={config}
      origin={origin}
    />
  );
}
