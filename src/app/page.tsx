import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Studio } from "@/components/studio/Studio";
import { StudioSkeleton } from "@/components/studio/StudioSkeleton";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
import { serverLoaders } from "@/server/cached";
import { MAX_HISTORY_YEARS } from "@/domain/history";
import { loadContributions } from "@/server/contributions";
import { resolvePublicOrigin } from "@/server/origin";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <AppShell>
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

async function resolveOrigin() {
  const h = await headers();
  return resolvePublicOrigin(process.env, {
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
  });
}

async function StudioLoader({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { request, config } = decodeCardParams(toSearchParams(await searchParams));
  const { origin, environment } = await resolveOrigin();
  if (request) await connection();
  const years = config.years > 1 ? MAX_HISTORY_YEARS : 1;
  const initialResponse = request ? await loadContributions(request, serverLoaders, { years }) : null;

  return (
    <Studio
      sampleDataset={createSampleDataset()}
      initialRequest={request}
      initialResponse={initialResponse}
      initialConfig={config}
      origin={origin}
      isPreviewDeployment={environment === "preview"}
    />
  );
}
