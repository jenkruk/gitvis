import type { DateRange, ISODate } from "./dates";

export const PLATFORM_IDS = ["github", "gitlab"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  profileUrl: (username: string) => string;
}

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  github: {
    id: "github",
    label: "GitHub",
    profileUrl: (u) => `https://github.com/${encodeURIComponent(u)}`,
  },
  gitlab: {
    id: "gitlab",
    label: "GitLab",
    profileUrl: (u) => `https://gitlab.com/${encodeURIComponent(u)}`,
  },
};

export interface DailyCount {
  date: ISODate;
  count: number;
}

export interface PlatformContributions {
  platform: PlatformId;
  username: string;
  profileUrl?: string;
  days: DailyCount[];
  privateCount?: number;
  reportedTotal?: number;
  fetchedAt?: string;
  stale?: boolean;
  coverage?: DateRange | null;
}

export interface DatasetFreshness {
  asOf: string;
  stale: boolean;
}

export type Provenance = "live" | "sample";

export interface CombinedDay {
  date: ISODate;
  total: number;
  byPlatform: Partial<Record<PlatformId, number>>;
}

export interface ContributionDataset {
  provenance: Provenance;
  range: DateRange;
  sources: PlatformContributions[];
  days: CombinedDay[];
  freshness?: DatasetFreshness;
}
