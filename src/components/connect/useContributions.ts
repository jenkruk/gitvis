"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ConnectRequest, connectSearchParams, type ContributionsResponse } from "@/adapters/connect";

export type ConnectionState =
  | { phase: "idle" }
  | { phase: "loading"; request: ConnectRequest }
  | { phase: "loaded"; request: ConnectRequest; response: ContributionsResponse }
  | { phase: "failed"; request: ConnectRequest; message: string };

export interface InitialConnection {
  request: ConnectRequest | null;
  response: ContributionsResponse | null;
}

/** Mirrors the connected usernames into the URL so reloads and shared links reconnect. */
function syncUrl(request: ConnectRequest | null) {
  const query = request ? connectSearchParams(request).toString() : "";
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

/**
 * Client-side loading for the Connect flow. Keeps the last successful
 * response while a new request is in flight so the preview never blanks.
 */
export function useContributions(initial: InitialConnection) {
  const [state, setState] = useState<ConnectionState>(() =>
    initial.request && initial.response
      ? { phase: "loaded", request: initial.request, response: initial.response }
      : { phase: "idle" },
  );
  const [response, setResponse] = useState<ContributionsResponse | null>(initial.response);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const connect = useCallback(async (request: ConnectRequest) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ phase: "loading", request });

    try {
      const res = await fetch(`/api/contributions?${connectSearchParams(request)}`, { signal: controller.signal });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = (body as { error?: string }).error ?? "The request was rejected.";
        setState({ phase: "failed", request, message });
        return;
      }
      const data = body as ContributionsResponse;
      setResponse(data);
      setState({ phase: "loaded", request, response: data });
      syncUrl(request);
    } catch {
      if (controller.signal.aborted) return;
      setState({
        phase: "failed",
        request,
        message: "Couldn't reach GitVis. Check your connection and try again.",
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    inFlight.current?.abort();
    setResponse(null);
    setState({ phase: "idle" });
    syncUrl(null);
  }, []);

  return { state, response, connect, disconnect };
}
