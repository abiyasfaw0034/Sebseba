// In-memory sliding-window rate limiter.
//
// Scope: this is a single-process, in-memory limiter — good enough to blunt
// credential-stuffing and brute-force attempts against this prototype. It resets
// on server restart and does NOT coordinate across multiple instances. Swap for a
// shared store (Redis/Upstash) when the API runs on more than one process.

type Window = { timestamps: number[] };

const windows = new Map<string, Window>();

export type RateLimitOptions = {
  /** Max allowed hits within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
};

/**
 * Records a hit for `key` and reports whether it is within the limit.
 * Call once per attempt; a blocked attempt does NOT consume additional budget
 * beyond the timestamps already inside the window.
 */
export const hitRateLimit = (key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult => {
  const now = Date.now();
  const cutoff = now - windowMs;
  const window = windows.get(key) ?? { timestamps: [] };

  // Drop timestamps that have aged out of the window.
  window.timestamps = window.timestamps.filter((ts) => ts > cutoff);

  if (window.timestamps.length >= limit) {
    const oldest = window.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    windows.set(key, window);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  window.timestamps.push(now);
  windows.set(key, window);

  return { allowed: true, remaining: Math.max(0, limit - window.timestamps.length), retryAfterSeconds: 0 };
};

/** Clears a key's window — call after a successful login so legitimate users aren't penalised. */
export const clearRateLimit = (key: string): void => {
  windows.delete(key);
};
