import type { PlatformContributions } from "@/domain/types";
import { PLATFORMS } from "@/domain/types";
import { maxCharsFor } from "./text";

/*
 * Source attribution ("● GitHub @jenkruk  ● GitLab @contactkruk") is mandatory
 * for v2 designs, so it must always fit. Labels stay inline after the date
 * range when they fit (every pre-existing URL — so legacy output is unchanged),
 * move to their own line when they don't, and only then shorten over-long
 * usernames with an ellipsis. The full usernames are always in <desc>.
 */

const FONT_SIZE = 11;
/** "● " + space + "@" + gap between labels, in average glyphs. */
const PER_LABEL_CHROME = 6;

export interface AttributionLayout {
  /** Labels go on their own line below the date range. */
  ownLine: boolean;
  /** Username as displayed (shortened only when even its own line can't fit it). */
  display: (source: PlatformContributions) => string;
}

const labelChars = (s: PlatformContributions) => PLATFORMS[s.platform].label.length + PER_LABEL_CHROME;

export function attributionLayout(
  sources: readonly PlatformContributions[],
  rangeLabel: string,
  widthPx: number,
  forceOwnLine: boolean,
): AttributionLayout {
  const limit = maxCharsFor(widthPx, FONT_SIZE);
  const labels = sources.reduce((n, s) => n + labelChars(s) + s.username.length, 0);
  const ownLine = forceOwnLine || rangeLabel.length + labels > limit;
  if (!ownLine || labels <= limit || sources.length === 0) return { ownLine, display: (s) => s.username };

  const chrome = sources.reduce((n, s) => n + labelChars(s), 0);
  const budget = Math.max(8, Math.floor((limit - chrome) / sources.length));
  return {
    ownLine,
    display: (s) => (s.username.length > budget ? `${s.username.slice(0, budget - 1)}…` : s.username),
  };
}
