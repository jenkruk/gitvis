import { formatDate } from "@/domain/dates";
import { type FeatureId, STAT_FEATURE_IDS, type StatFeatureId } from "@/config/features";
import type { ContributionMetrics } from "@/metrics/metrics";
import { formatNumber, formatPercent } from "./primitives";

export type { StatFeatureId } from "@/config/features";
export const STAT_FEATURES: readonly StatFeatureId[] = STAT_FEATURE_IDS;

export function isStatFeature(id: FeatureId): id is StatFeatureId {
  return (STAT_FEATURES as readonly FeatureId[]).includes(id);
}

export function orderedStats(
  order: readonly StatFeatureId[],
  isVisible: (id: StatFeatureId) => boolean,
): StatFeatureId[] {
  const sequence = [
    ...order.filter((id) => STAT_FEATURES.includes(id)),
    ...STAT_FEATURES.filter((id) => !order.includes(id)),
  ];
  return [...new Set(sequence)].filter(isVisible);
}

export interface StatItem {
  id: StatFeatureId;
  value: string;
  label: string;
  detail: string;
  inline: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildStatItem(id: StatFeatureId, m: ContributionMetrics): StatItem {
  switch (id) {
    case "totalContributions":
      return {
        id,
        value: formatNumber(m.total),
        label: "Contributions",
        detail: m.activeDays > 0 ? `${m.averagePerActiveDay.toFixed(1)} per active day` : "No activity yet",
        inline: `${formatNumber(m.total)} ${plural(m.total, "contribution", "contributions")}`,
      };
    case "activeDays":
      return {
        id,
        value: formatNumber(m.activeDays),
        label: "Active days",
        detail: m.totalDays > 0 ? `${formatPercent(m.activeDays / m.totalDays)} of days` : "—",
        inline: `${formatNumber(m.activeDays)} active ${plural(m.activeDays, "day", "days")}`,
      };
    case "longestStreak": {
      const s = m.longestStreak;
      const length = s?.length ?? 0;
      return {
        id,
        value: `${formatNumber(length)} ${plural(length, "day", "days")}`,
        label: "Longest streak",
        detail: s ? `${formatDate(s.start)} – ${formatDate(s.end)}` : "No streak yet",
        inline: `${formatNumber(length)}-day longest streak`,
      };
    }
    case "bestDay": {
      const b = m.bestDay;
      return {
        id,
        value: b ? formatNumber(b.count) : "0",
        label: "Best day",
        detail: b ? formatDate(b.date, "long") : "No activity yet",
        inline: b ? `best day ${formatNumber(b.count)} (${formatDate(b.date)})` : "no best day yet",
      };
    }
    case "currentStreak": {
      const n = m.currentStreak;
      return {
        id,
        value: `${formatNumber(n)} ${plural(n, "day", "days")}`,
        label: "Current streak",
        detail: n > 0 ? "Still going" : "No active streak",
        inline: `${formatNumber(n)}-day current streak`,
      };
    }
  }
}
