import { finalText, type IdentityConfig } from "@/config/config";
import { formatDate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS, type PlatformId } from "@/domain/types";
import { bestTextOn } from "@/theme/color";
import type { ThemeTokens } from "@/theme/palettes";
import { FONT_STACK, PADDING } from "./primitives";
import { seriesColor, StatusBadge } from "./sections";
import { attributionLayout } from "./attribution";
import { wrapText } from "./text";

export type AvatarImages = Partial<Record<PlatformId, string>>;

const BADGE_ALLOWANCE = 150;

interface Geometry {
  avatar: number;
  nameSize: number;
  titleSize: number;
  height: number;
}

function geometry(
  style: "compact" | "full",
  compactCanvas: boolean,
  hasTitle: boolean,
  handlesOwnLine: boolean,
): Geometry {
  if (style === "compact") {
    return { avatar: 36, nameSize: 16, titleSize: 0, height: handlesOwnLine ? 58 : 40 };
  }
  const avatar = compactCanvas ? 48 : 64;
  const nameSize = compactCanvas ? 17 : 20;
  const lines = 1 + (hasTitle ? 1 : 0) + 1 + (handlesOwnLine ? 1 : 0);
  return { avatar, nameSize, titleSize: 13, height: Math.max(avatar, 8 + lines * 19) };
}

export interface IdentityHeaderProps {
  dataset: ContributionDataset;
  theme: ThemeTokens;
  identity: IdentityConfig & { style: "compact" | "full" };
  avatars: AvatarImages;
  y: number;
  width: number;
  compactCanvas: boolean;
  showHandles: boolean;
  idPrefix: string;
}

function handleSources(dataset: ContributionDataset, identity: IdentityConfig, showHandles: boolean) {
  return showHandles ? dataset.sources.filter((s) => identity.handles.includes(s.platform)) : [];
}

const AVATAR_TEXT_GAP = 12;

function rowLayout(
  dataset: ContributionDataset,
  identity: IdentityConfig & { style: "compact" | "full" },
  avatarSize: number,
  width: number,
) {
  const avatarSources = dataset.sources.filter((s) => identity.avatars.includes(s.platform));
  const overlap = avatarSize * 0.7;
  const avatarsWidth = avatarSources.length ? avatarSize + overlap * (avatarSources.length - 1) : 0;
  const reserved = avatarsWidth ? avatarsWidth + AVATAR_TEXT_GAP : 0;
  const right = identity.avatarSide === "right" && avatarsWidth > 0;
  return {
    avatarSources,
    overlap,
    avatarsX: right ? PADDING + width - avatarsWidth : PADDING,
    textX: right ? PADDING : PADDING + reserved,
    textWidth: width - reserved,
    badgeRight: PADDING + width - (right ? reserved : 0),
  };
}

function metaLayout(
  dataset: ContributionDataset,
  identity: IdentityConfig & { style: "compact" | "full" },
  compactCanvas: boolean,
  showHandles: boolean,
  width: number,
) {
  const handles = handleSources(dataset, identity, showHandles);
  const g0 = geometry(identity.style, compactCanvas, false, false);
  const row = rowLayout(dataset, identity, g0.avatar, width);
  const rangeLabel = `${formatDate(dataset.range.start)} – ${formatDate(dataset.range.end)}`;
  const attribution = attributionLayout(handles, rangeLabel, row.textWidth, compactCanvas);
  return { handles, rangeLabel, attribution, handlesOwnLine: handles.length > 0 && attribution.ownLine };
}

export function identityHeaderHeight(
  dataset: ContributionDataset,
  identity: IdentityConfig & { style: "compact" | "full" },
  compactCanvas: boolean,
  showHandles: boolean,
  width: number,
): number {
  const { handlesOwnLine } = metaLayout(dataset, identity, compactCanvas, showHandles, width);
  return geometry(
    identity.style,
    compactCanvas,
    !!finalText(identity.title) && identity.style === "full",
    handlesOwnLine,
  ).height;
}

export function Avatar({
  platform,
  username,
  image,
  theme,
  x,
  y,
  size,
  clipId,
}: {
  platform: PlatformId;
  username: string;
  image?: string;
  theme: ThemeTokens;
  x: number;
  y: number;
  size: number;
  clipId: string;
}) {
  const r = size / 2;
  const ring = seriesColor(theme, platform);
  return (
    <g>
      {image ? (
        <>
          <clipPath id={clipId}>
            <circle cx={x + r} cy={y + r} r={r} />
          </clipPath>
          <image
            href={image}
            x={x}
            y={y}
            width={size}
            height={size}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : (
        <>
          <circle cx={x + r} cy={y + r} r={r} fill={ring} />
          <text
            x={x + r}
            y={y + r + size * 0.17}
            textAnchor="middle"
            fontSize={Math.round(size * 0.45)}
            fontWeight={700}
            fill={bestTextOn(ring)}
            fontFamily={FONT_STACK}
          >
            {(username[0] ?? "?").toUpperCase()}
          </text>
        </>
      )}
      <circle cx={x + r} cy={y + r} r={r - 1} fill="none" stroke={ring} strokeWidth={2} />
    </g>
  );
}

export function IdentityHeader({
  dataset,
  theme,
  identity,
  avatars,
  y,
  width,
  compactCanvas,
  showHandles,
  idPrefix,
}: IdentityHeaderProps) {
  const font = { fontFamily: FONT_STACK };
  const { handles, attribution, handlesOwnLine, rangeLabel } = metaLayout(
    dataset,
    identity,
    compactCanvas,
    showHandles,
    width,
  );
  const title = finalText(identity.title);
  const hasTitle = identity.style === "full" && !!title;
  const g = geometry(identity.style, compactCanvas, hasTitle, handlesOwnLine);

  const {
    avatarSources,
    overlap,
    avatarsX,
    textX,
    textWidth: columnWidth,
    badgeRight,
  } = rowLayout(dataset, identity, g.avatar, width);
  const badge = dataset.provenance === "sample" || dataset.freshness?.stale ? BADGE_ALLOWANCE : 0;
  const textWidth = columnWidth - badge;

  const name = finalText(identity.name) || "Contribution activity";
  const [nameLine = ""] = wrapText(name, textWidth, g.nameSize, 1);
  const [titleLine = ""] = hasTitle ? wrapText(title, columnWidth, g.titleSize, 1) : [];

  const nameY = y + (identity.style === "full" ? g.nameSize + 2 : 15);
  const titleY = nameY + 19;
  const metaY = hasTitle ? titleY + 19 : nameY + 19;
  const avatarY = identity.style === "full" ? y : y + 2;

  const handleNodes = handles.map((source, i) => {
    const label = (
      <>
        <tspan dx={i === 0 && handlesOwnLine ? 0 : 10} fill={seriesColor(theme, source.platform)}>
          ●
        </tspan>
        <tspan dx={4} fill={theme.text}>
          {PLATFORMS[source.platform].label}
        </tspan>
        <tspan dx={4}>@{attribution.display(source)}</tspan>
      </>
    );
    return <tspan key={source.platform}>{label}</tspan>;
  });

  return (
    <g>
      {avatarSources.map((source, i) => (
        <Avatar
          key={source.platform}
          platform={source.platform}
          username={source.username}
          image={avatars[source.platform]}
          theme={theme}
          x={avatarsX + i * overlap}
          y={avatarY}
          size={g.avatar}
          clipId={`${idPrefix}-avatar-${source.platform}`}
        />
      ))}
      <text
        x={textX}
        y={nameY}
        fontSize={g.nameSize}
        fontWeight={identity.style === "full" ? 700 : 600}
        fill={theme.text}
        {...font}
      >
        {nameLine}
      </text>
      {hasTitle && (
        <text x={textX} y={titleY} fontSize={g.titleSize} fill={theme.textMuted} {...font}>
          {titleLine}
        </text>
      )}
      <text x={textX} y={metaY} fontSize={11} fill={theme.textMuted} {...font}>
        <tspan>{rangeLabel}</tspan>
        {!handlesOwnLine && handleNodes}
      </text>
      {handlesOwnLine && (
        <text x={textX} y={metaY + 18} fontSize={11} fill={theme.textMuted} {...font}>
          {handleNodes}
        </text>
      )}
      <StatusBadge dataset={dataset} theme={theme} x={badgeRight} y={y} />
    </g>
  );
}
