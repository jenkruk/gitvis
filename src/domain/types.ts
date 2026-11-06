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
}

/** "live" = fetched from platforms; "sample" = fixture data that must be labeled as such. */
export type Provenance = "live" | "sample";

export interface CombinedDay {
  date: ISODate;
  total: number;
  byPlatform: Partial<Record<PlatformId, number>>;
}

/** The presentation-independent input to metrics and renderers. */
export interface ContributionDataset {
  provenance: Provenance;
  range: DateRange;
  sources: PlatformContributions[];
  /** Dense: exactly one entry per day in `range`, ascending. */
  days: CombinedDay[];
}
