import { ImageResponse } from "next/og";
import { DEFAULT_SHOWCASE, showcaseConfig } from "@/components/landing/showcase";
import { LOGO_CELLS, LOGO_COLOR } from "@/components/shell/logo-mark";
import { SITE_DESCRIPTION, SITE_HEADLINE, SITE_NAME } from "@/config/site";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { prepareView } from "@/renderers/view";
import { Visualization } from "@/renderers/Visualization";

export const alt = `${SITE_NAME}: ${SITE_HEADLINE} A GitHub + GitLab contribution graphic drawn from sample data.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANVAS = "#10151b";
const TEXT = "#dce6e8";
const MUTED = "#9dabb3";

const GRAPHIC_WIDTH = 1072;

function graphic(): { src: string; height: number } {
  const config = showcaseConfig(DEFAULT_SHOWCASE);
  const { view, metricsView } = prepareView(createSampleDataset(), { years: config.years, range: config.range });
  const svg = renderSvgMarkup(
    <Visualization dataset={view} config={config} metrics={computeMetrics(metricsView)} idPrefix="og" />,
  );
  const [, w = "1", h = "1"] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) ?? [];
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    height: Math.round((GRAPHIC_WIDTH * Number(h)) / Number(w)),
  };
}

export default function OpengraphImage() {
  const { src, height } = graphic();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: CANVAS,
        padding: "56px 64px 0",
        color: TEXT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <svg width={36} height={36} viewBox="0 0 24 24">
          {LOGO_CELLS.map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width={c.size}
              height={c.size}
              rx={c.radius}
              fill={LOGO_COLOR}
              opacity={c.opacity}
            />
          ))}
        </svg>
        <span style={{ fontSize: 30, letterSpacing: -0.5 }}>{SITE_NAME}</span>
      </div>
      <div style={{ display: "flex", flexShrink: 0, marginTop: 28, fontSize: 60, letterSpacing: -2, lineHeight: 1.05 }}>
        {SITE_HEADLINE}
      </div>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          marginTop: 16,
          fontSize: 26,
          color: MUTED,
          maxWidth: 900,
          lineHeight: 1.35,
        }}
      >
        {SITE_DESCRIPTION}
      </div>
      <img src={src} width={GRAPHIC_WIDTH} height={height} alt="" style={{ marginTop: 36, flexShrink: 0 }} />
    </div>,
    size,
  );
}
