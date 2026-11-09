import type { PlatformContributions, PlatformId } from "@/domain/types";

export type AdapterErrorKind =
  "invalid_username" | "not_found" | "not_configured" | "invalid_response" | "rate_limited" | "upstream";

export function isTransientError(kind: AdapterErrorKind): boolean {
  return kind === "rate_limited" || kind === "upstream" || kind === "invalid_response";
}

export interface AdapterError {
  platform: PlatformId;
  kind: AdapterErrorKind;
  message: string;
}

export type AdapterResult = { ok: true; data: PlatformContributions } | { ok: false; error: AdapterError };

export function adapterError(platform: PlatformId, kind: AdapterErrorKind, message: string): AdapterResult {
  return { ok: false, error: { platform, kind, message } };
}

export function displayUsername(username: string, max = 32): string {
  return username.length > max ? `${username.slice(0, max - 1)}…` : username;
}

export function isValidGitHubUsername(username: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username);
}

export function isValidGitLabUsername(username: string): boolean {
  return (
    username.length <= 255 &&
    /^[a-z\d](?:[a-z\d]|[._-](?=[a-z\d]))*$/i.test(username) &&
    !/\.(git|atom)$/i.test(username)
  );
}
