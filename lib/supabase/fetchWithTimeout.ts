/**
 * fetch with a deadline: a request that never answers (flaky mobile network, a stuck
 * connection) fails after `ms` instead of leaving a screen on "Loading…" forever. A signal the
 * caller passes still aborts it.
 */
export function fetchWithTimeout(ms = 15_000): typeof fetch {
  return async (input, init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException("Request timed out", "TimeoutError")), ms);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) ctrl.abort(outer.reason);
      else outer.addEventListener("abort", () => ctrl.abort(outer.reason), { once: true });
    }
    try {
      return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Pause before a first load's one quiet retry (a network blip usually passes by then). */
export const QUIET_RETRY_MS = 800;

/**
 * Identical GET/HEAD requests that are in flight at the same moment share one network request
 * (task #41: Today's hooks fired ~58 requests per load, many the same). Not a cache: once a request
 * finishes, the next one goes to the server. Never merged: other methods, requests carrying their
 * own abort signal, or a different URL, token or header.
 */
export function dedupeGets(base: typeof fetch): typeof fetch {
  const inflight = new Map<string, Promise<Response>>();
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if ((method !== "GET" && method !== "HEAD") || init?.signal || input instanceof Request) {
      return base(input, init);
    }
    const headers = [...new Headers(init?.headers).entries()].sort().map(([k, v]) => `${k}:${v}`);
    const key = `${method} ${String(input)} ${headers.join("|")}`;
    let shared = inflight.get(key);
    if (!shared) {
      shared = base(input, init);
      inflight.set(key, shared);
      const done = () => {
        if (inflight.get(key) === shared) inflight.delete(key);
      };
      shared.then(done, done);
    }
    // Every caller reads its own copy of the body.
    return (await shared).clone();
  };
}
