/**
 * The Connect contract shared by the client form, the API route and the page:
 * request parsing/validation and the response shape. Pure — safe on both sides.
 */
import type { ContributionDataset, PlatformId } from "@/domain/types";
import { type AdapterErrorKind, isValidGitHubUsername, isValidGitLabUsername } from "./types";

export type ConnectRequest = Partial<Record<PlatformId, string>>;

export const USERNAME_VALIDATORS: Record<PlatformId, (username: string) => boolean> = {
  github: isValidGitHubUsername,
  gitlab: isValidGitLabUsername,
};

export const USERNAME_RULES: Record<PlatformId, string> = {
  github: "Letters, numbers and single hyphens; up to 39 characters.",
  gitlab: "Letters, numbers, and . _ - between them.",
};

export type ConnectValidation =
  | { ok: true; request: ConnectRequest }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "invalid"; fields: PlatformId[] };

type ParamValue = string | string[] | null | undefined;

/** Trims inputs, drops blanks and validates each provided username. */
export function validateConnectRequest(input: Partial<Record<PlatformId, ParamValue>>): ConnectValidation {
  const request: ConnectRequest = {};
  const invalid: PlatformId[] = [];
  for (const platform of Object.keys(USERNAME_VALIDATORS) as PlatformId[]) {
    const raw = input[platform];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().replace(/^@/, "");
    if (!value) continue;
    if (USERNAME_VALIDATORS[platform](value)) request[platform] = value;
    else invalid.push(platform);
  }
  if (invalid.length > 0) return { ok: false, reason: "invalid", fields: invalid };
  if (Object.keys(request).length === 0) return { ok: false, reason: "empty" };
  return { ok: true, request };
}

export function connectSearchParams(request: ConnectRequest): URLSearchParams {
  const params = new URLSearchParams();
  for (const [platform, username] of Object.entries(request)) if (username) params.set(platform, username);
  return params;
}

export type PlatformResult =
  | {
      platform: PlatformId;
      username: string;
      status: "ok";
      total: number;
      privateCount?: number;
      /** Last-known-good data served after a failed refresh. */
      stale?: boolean;
      fetchedAt?: string;
    }
  | { platform: PlatformId; username: string; status: AdapterErrorKind; message: string; retryable: boolean };

export interface ContributionsResponse {
  /** Built from the platforms that loaded; null when none did. */
  dataset: ContributionDataset | null;
  /** One entry per requested platform, in PLATFORM_IDS order. */
  results: PlatformResult[];
}
