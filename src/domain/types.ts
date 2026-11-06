import type { DateRange, ISODate } from "./dates";

/** Supported platforms. Add an id here (plus metadata and an adapter) to support a new one. */
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

/** Normalized output of a platform adapter. `days` may be sparse. */
export interface PlatformContributions {
  platform: PlatformId;
  username: string;
  /** Omitted for sample data so we never link fabricated numbers to a real profile. */
  profileUrl?: string;
  days: DailyCount[];
  /** Contributions the platform reports as private/restricted, when it exposes that number. */
  privateCount?: number;
  /** The platform's own total for the period, if reported (useful for reconciliation). */
  reportedTotal?: number;
  /** ISO timestamp of the upstream fetch that produced this data (live data only). */
  fetchedAt?: string;
  /** True when served as last-known-good because a refresh failed. */
  stale?: boolean;
  /**
   * Dates this source actually reports. Days outside it are UNKNOWN, never zero
   * (e.g. GitLab only publishes 12 months). Absent = the whole dataset range;
   * null = nothing within the dataset range is covered.
   */
  coverage?: DateRange | null;
}

/** How current a live dataset is. Absent for sample data. */
export interface DatasetFreshness {
  /** ISO timestamp of the oldest source fetch in the dataset. */
  asOf: string;
  /** True when any source is last-known-good data served after a failed refresh. */
  stale: boolean;
}

/** "live" = fetched from platforms; "sample" = fixture data that must be labeled as such. */
export type Provenance = "live" | "sample";

export interface CombinedDay {
  date: ISODate;
  total: number;
  /** A platform is absent on days outside its coverage (unknown), and 0 on covered days without activity. */
  byPlatform: Partial<Record<PlatformId, number>>;
}

/** The presentation-independent input to metrics and renderers. */
export interface ContributionDataset {
  provenance: Provenance;
  range: DateRange;
  sources: PlatformContributions[];
  /** Dense: exactly one entry per day in `range`, ascending. */
  days: CombinedDay[];
  freshness?: DatasetFreshness;
}
