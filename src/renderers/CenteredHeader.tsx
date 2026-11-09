import { finalText, type IdentityConfig } from "@/config/config";
import { formatDate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS, type PlatformContributions, type PlatformId } from "@/domain/types";
import type { ThemeTokens } from "@/theme/palettes";
import { type AvatarImages, Avatar } from "./IdentityHeader";
import { FONT_STACK, PADDING } from "./primitives";
import { hasStatusBadge, seriesColor, STATUS_BADGE_HEIGHT, StatusBadge } from "./sections";
import { maxCharsFor, wrapText } from "./text";

const META_SIZE = 11;
const TITLE_SIZE = 13;
const LINE = 19;
const AVATAR_GAP = 8;
const HANDLE_HEIGHT = 14;
const SIDE_GUTTER = 16;
const SIDE_MAX = 200;
const HANDLE_CHROME = 4;
const GLYPH_EM = 0.58;

const SIDE_ORDER: Record<PlatformId, "left" | "right"> = { github: "left", gitlab: "right" };

type CenteredIdentity = IdentityConfig & { style: "centered" };

interface Side {
  source: PlatformContributions;
  align: "left" | "right";
  avatar: boolean;
  handle: string | null;
  width: number;
  height: number;
}

function sides(
  dataset: ContributionDataset,
  identity: CenteredIdentity,
  showHandles: boolean,
  avatarSize: number,
  budget: number,
): Side[] {
  const limit = maxCharsFor(budget, META_SIZE);
  return dataset.sources.flatMap((source) => {
    const avatar = identity.avatars.includes(source.platform);
    const shown = showHandles && identity.handles.includes(source.platform);
    if (!avatar && !shown) return [];
    const room = Math.max(4, limit - PLATFORMS[source.platform].label.length - HANDLE_CHROME);
    const handle = !shown
      ? null
      : source.username.length > room
        ? `${source.username.slice(0, room - 1)}…`
        : source.username;
    const chars = handle === null ? 0 : PLATFORMS[source.platform].label.length + HANDLE_CHROME + handle.length;
    return [
      {
        source,
        align: SIDE_ORDER[source.platform],
        avatar,
        handle,
        width: Math.max(avatar ? avatarSize : 0, chars * META_SIZE * GLYPH_EM),
        height:
          (avatar ? avatarSize : 0) +
          (avatar && handle !== null ? AVATAR_GAP : 0) +
          (handle !== null ? HANDLE_HEIGHT : 0),
      },
    ];
  });
}

function layout(
  dataset: ContributionDataset,
  identity: CenteredIdentity,
  compactCanvas: boolean,
  showHandles: boolean,
  width: number,
) {
  const avatarSize = compactCanvas ? 32 : 44;
  const nameSize = compactCanvas ? 17 : 20;
  const sideBudget = compactCanvas ? (width - SIDE_GUTTER) / 2 : SIDE_MAX;
  const columns = sides(dataset, identity, showHandles, avatarSize, sideBudget);
  const sideWidth = Math.max(0, ...columns.map((s) => s.width));
  const sideHeight = Math.max(0, ...columns.map((s) => s.height));
  const centerWidth = compactCanvas || sideWidth === 0 ? width : width - 2 * (sideWidth + SIDE_GUTTER);

  const title = finalText(identity.title);
  const nameBaseline = nameSize;
  const titleBaseline = nameBaseline + LINE;
  const rangeBaseline = (title ? titleBaseline : nameBaseline) + LINE;
  const badgeTop = rangeBaseline + 10;
  const centerHeight = hasStatusBadge(dataset) ? badgeTop + STATUS_BADGE_HEIGHT : rangeBaseline + 5;

  const height = compactCanvas ? centerHeight + (sideHeight ? 12 + sideHeight : 0) : Math.max(centerHeight, sideHeight);
  const centerTop = compactCanvas ? 0 : (height - centerHeight) / 2;
  const sideTop = (side: Side) => (compactCanvas ? centerHeight + 12 : (height - side.height) / 2);

  return {
    columns,
    avatarSize,
    nameSize,
    centerWidth,
    title,
    nameBaseline: centerTop + nameBaseline,
    titleBaseline: centerTop + titleBaseline,
    rangeBaseline: centerTop + rangeBaseline,
    badgeTop: centerTop + badgeTop,
    sideTop,
    height,
  };
}

export function centeredHeaderHeight(
  dataset: ContributionDataset,
  identity: CenteredIdentity,
  compactCanvas: boolean,
  showHandles: boolean,
  width: number,
): number {
  return layout(dataset, identity, compactCanvas, showHandles, width).height;
}

export interface CenteredHeaderProps {
  dataset: ContributionDataset;
  theme: ThemeTokens;
  identity: CenteredIdentity;
  avatars: AvatarImages;
  y: number;
  width: number;
  compactCanvas: boolean;
  showHandles: boolean;
  idPrefix: string;
}

export function CenteredHeader({
  dataset,
  theme,
  identity,
  avatars,
  y,
  width,
  compactCanvas,
  showHandles,
  idPrefix,
}: CenteredHeaderProps) {
  const font = { fontFamily: FONT_STACK };
  const l = layout(dataset, identity, compactCanvas, showHandles, width);
  const center = PADDING + width / 2;
  const [nameLine = ""] = wrapText(finalText(identity.name) || "Contribution activity", l.centerWidth, l.nameSize, 1);
  const [titleLine = ""] = l.title ? wrapText(l.title, l.centerWidth, TITLE_SIZE, 1) : [];
  const rangeLabel = `${formatDate(dataset.range.start)} – ${formatDate(dataset.range.end)}`;

  return (
    <g>
      <text
        x={center}
        y={y + l.nameBaseline}
        textAnchor="middle"
        fontSize={l.nameSize}
        fontWeight={700}
        fill={theme.text}
        {...font}
      >
        {nameLine}
      </text>
      {l.title && (
        <text
          x={center}
          y={y + l.titleBaseline}
          textAnchor="middle"
          fontSize={TITLE_SIZE}
          fill={theme.textMuted}
          {...font}
        >
          {titleLine}
        </text>
      )}
      <text
        x={center}
        y={y + l.rangeBaseline}
        textAnchor="middle"
        fontSize={META_SIZE}
        fill={theme.textMuted}
        {...font}
      >
        {rangeLabel}
      </text>
      <StatusBadge dataset={dataset} theme={theme} x={center} y={y + l.badgeTop} anchor="middle" />
      {l.columns.map((side) => {
        const top = y + l.sideTop(side);
        const left = side.align === "left";
        const edge = left ? PADDING : PADDING + width;
        const { platform } = side.source;
        const label = side.handle !== null && (
          <text
            x={edge}
            y={top + (side.avatar ? l.avatarSize + AVATAR_GAP : 0) + META_SIZE}
            textAnchor={left ? "start" : "end"}
            fontSize={META_SIZE}
            fill={theme.textMuted}
            {...font}
          >
            <tspan fill={seriesColor(theme, platform)}>●</tspan>
            <tspan dx={4} fill={theme.text}>
              {PLATFORMS[platform].label}
            </tspan>
            <tspan dx={4}>@{side.handle}</tspan>
          </text>
        );
        return (
          <g key={platform}>
            {side.avatar && (
              <Avatar
                platform={platform}
                username={side.source.username}
                image={avatars[platform]}
                theme={theme}
                x={left ? edge : edge - l.avatarSize}
                y={top}
                size={l.avatarSize}
                clipId={`${idPrefix}-avatar-${platform}`}
              />
            )}
            {label}
          </g>
        );
      })}
    </g>
  );
}
