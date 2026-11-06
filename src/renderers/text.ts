/**
 * SVG has no text wrapping, and published images can't measure fonts. We wrap
 * with a conservative average glyph width for the system sans-serif stack
 * (≈0.58em), which over-estimates typical text so lines never overflow.
 */
const AVERAGE_GLYPH_EM = 0.58;

export function maxCharsFor(widthPx: number, fontSize: number): number {
  return Math.max(8, Math.floor(widthPx / (fontSize * AVERAGE_GLYPH_EM)));
}

/** Greedy word wrap; words longer than a line are hard-broken. Optionally caps line count with an ellipsis. */
export function wrapText(text: string, widthPx: number, fontSize: number, maxLines = Infinity): string[] {
  const limit = maxCharsFor(widthPx, fontSize);
  const lines: string[] = [];
  let line = "";

  for (const rawWord of text.split(/\s+/).filter(Boolean)) {
    let word = rawWord;
    while (word.length > limit) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, limit));
      word = word.slice(limit);
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= limit) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1]!;
    kept[maxLines - 1] = `${last.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
    return kept;
  }
  return lines;
}
