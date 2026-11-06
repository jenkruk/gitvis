import { connection } from "next/server";
import { Suspense } from "react";
import { validateConnectRequest } from "@/adapters/connect";
import { AppShell } from "@/components/shell/AppShell";
import { Studio } from "@/components/studio/Studio";
import { StudioSkeleton } from "@/components/studio/StudioSkeleton";
import { createSampleDataset } from "@/fixtures/sample-dataset";
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

/** Shared links (`/?github=…&gitlab=…`) load on the server so they render with data immediately. */
async function StudioLoader({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const validation = validateConnectRequest({ github: params.github, gitlab: params.gitlab });
  const initialRequest = validation.ok ? validation.request : null;
  if (initialRequest) await connection(); // "today" (new Date) must be computed per request, never prerendered
  const initialResponse = initialRequest ? await loadContributions(initialRequest, serverLoaders) : null;

  return (
    <Studio sampleDataset={createSampleDataset()} initialRequest={initialRequest} initialResponse={initialResponse} />
  );
}
