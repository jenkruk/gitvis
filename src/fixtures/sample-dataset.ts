/**
 * SAMPLE DATA — deterministic, synthetic contributions for development and the
 * studio preview before a user connects accounts. Always `provenance: "sample"`
 * (renderers show a "Sample data" badge), never attributed to real profiles,
 * and anchored to a fixed range so server and client renders match.
 */
import { combineSources, normalizeDailyCounts } from "@/domain/combine";
import { dayOfWeek, eachDay, toISODate, trailingYear } from "@/domain/dates";
import type { ContributionDataset, PlatformContributions, PlatformId } from "@/domain/types";

export const SAMPLE_RANGE = trailingYear(toISODate("2026-10-31"));

/** Mulberry32: tiny seeded PRNG so the sample is identical on every render. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Profile {
  seed: number;
  /** Probability of activity on a weekday / weekend day. */
  weekday: number;
  weekend: number;
  /** Typical count on an active day. */
  intensity: number;
}

function generate(platform: PlatformId, { seed, weekday, weekend, intensity }: Profile): PlatformContributions {
  const random = seededRandom(seed);
  const days = eachDay(SAMPLE_RANGE).map((date, i) => {
    // Slow "project phases" so the year has visible busy and quiet stretches.
    const phase = 0.55 + 0.45 * Math.sin((i / 365) * Math.PI * 4 + seed);
    const isWeekend = dayOfWeek(date) % 6 === 0;
    const active = random() < (isWeekend ? weekend : weekday) * phase;
    const count = active ? Math.max(1, Math.round(intensity * phase * (0.3 + random() * 1.7))) : 0;
    return { date, count };
  });
  return { platform, username: `sample-${platform}`, days: normalizeDailyCounts(days) };
}

export function createSampleDataset(platforms: readonly PlatformId[] = ["github", "gitlab"]): ContributionDataset {
  const profiles: Record<PlatformId, Profile> = {
    github: { seed: 17, weekday: 0.62, weekend: 0.22, intensity: 4 },
    gitlab: { seed: 41, weekday: 0.48, weekend: 0.08, intensity: 5 },
  };
  return combineSources(
    platforms.map((p) => generate(p, profiles[p])),
    SAMPLE_RANGE,
    "sample",
  );
}
