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

export function connectSearchParams(request: ConnectRequest, years = 1): URLSearchParams {
  const params = new URLSearchParams();
  for (const [platform, username] of Object.entries(request)) if (username) params.set(platform, username);
  if (years > 1) params.set("years", String(years));
  return params;
}

export type PlatformResult =
  | {
      platform: PlatformId;
      username: string;
      status: "ok";
      total: number;
      privateCount?: number;
      stale?: boolean;
      fetchedAt?: string;
    }
  | { platform: PlatformId; username: string; status: AdapterErrorKind; message: string; retryable: boolean };

export type HistoryStatus =
  { years: number; status: "ok" } | { years: number; status: AdapterErrorKind; message: string; retryable: boolean };

export interface ContributionsResponse {
  dataset: ContributionDataset | null;
  results: PlatformResult[];
  history?: HistoryStatus;
}

export function parseYears(value: string | null): 1 | 2 | 3 | null {
  if (value === null || value === "") return 1;
  return value === "1" || value === "2" || value === "3" ? (Number(value) as 1 | 2 | 3) : null;
}
