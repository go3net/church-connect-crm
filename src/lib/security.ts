import { NextResponse } from "next/server";

/**
 * Lightweight fixed-window rate limiter.
 *
 * In-memory per-process — effective on Railway's single-container deploys.
 * For multi-replica scale, swap the Map for Upstash Redis (UPSTASH_REDIS_REST_URL
 * + UPSTASH_REDIS_REST_TOKEN) keeping this same signature (see SPEEDFI's security.ts).
 *
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429 }
  );
}

/** Best-effort client IP from proxy headers. */
export function getIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// occasional cleanup so the map can't grow unbounded
let lastSweep = Date.now();
export function sweepBuckets() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((v, k) => {
    if (now > v.resetAt) buckets.delete(k);
  });
}
