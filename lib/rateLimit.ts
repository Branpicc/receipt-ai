// lib/rateLimit.ts
//
// Tiny in-memory rate limiter for public API routes that don't have
// authentication (contact form, demo request). Keyed by IP address.
//
// This is per-instance memory — fine for low-traffic public endpoints on
// Vercel where the same IP usually lands on the same warm function. For
// stricter rate limits use Upstash Redis or Vercel KV.

import { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

// Module-level map. Persists across requests within a single Lambda
// container; gets reset on cold start. That's the right behaviour for a
// soft DoS shield — repeat offenders get blocked, an occasional cold
// start resetting the counter is harmless.
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 5;       // per window

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function publicRouteRateLimit(request: NextRequest): {
  ok: boolean;
  retryAfterSeconds?: number;
} {
  const ip = getClientIp(request);
  const now = Date.now();

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}
