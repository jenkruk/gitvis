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

interface Connected {
  request: ConnectRequest;
  response: ContributionsResponse;
}

/**
 * Client-side loading for the Connect flow. Keeps the last successful
 * response (and the request that produced it) while a new request is in
 * flight, so the preview and publish links never blank or drift.
 */
export function useContributions(initial: InitialConnection) {
  const [state, setState] = useState<ConnectionState>(() =>
    initial.request && initial.response
      ? { phase: "loaded", request: initial.request, response: initial.response }
      : { phase: "idle" },
  );
  const [connected, setConnected] = useState<Connected | null>(() =>
    initial.request && initial.response ? { request: initial.request, response: initial.response } : null,
  );
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  /** Resolves with the loaded response, or null on failure / abort. */
  const connect = useCallback(async (request: ConnectRequest): Promise<ContributionsResponse | null> => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ phase: "loading", request });

    try {
      const res = await fetch(`/api/contributions?${connectSearchParams(request)}`, { signal: controller.signal });
      if (res.status === 429) {
        setState({ phase: "failed", request, message: "Too many requests. Please wait a minute and try again." });
        return null;
      }
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = (body as { error?: string }).error ?? "The request was rejected.";
        setState({ phase: "failed", request, message });
        return null;
      }
      const data = body as ContributionsResponse;
      setConnected({ request, response: data });
      setState({ phase: "loaded", request, response: data });
      return data;
    } catch {
      if (controller.signal.aborted) return null;
      setState({
        phase: "failed",
        request,
        message: "Couldn't reach GitVis. Check your connection and try again.",
      });
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    inFlight.current?.abort();
    setConnected(null);
    setState({ phase: "idle" });
  }, []);

  return {
    state,
    response: connected?.response ?? null,
    /** The request behind the data currently shown (not an in-flight one). */
    request: connected?.request ?? null,
    connect,
    disconnect,
  };
}
