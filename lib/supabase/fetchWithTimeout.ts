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
