/**
 * Simple in-memory rate limiter.
 *
 * Uses a Map keyed by an identifier (e.g. IP address or email).
 * Suitable for a small team app on a single server / single Vercel function instance.
 * For multi-region production, swap this for @upstash/ratelimit backed by Redis.
 */

interface Entry {
    count: number;
    resetAt: number; // epoch ms
}

const store = new Map<string, Entry>();

// Prune expired entries every 10 minutes so the Map doesn't grow unbounded.
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}, 10 * 60 * 1000);

interface RateLimitOptions {
    /** Maximum number of requests allowed within the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetAt: number; // epoch ms when the window resets
}

export function rateLimit(
    identifier: string,
    { limit, windowMs }: RateLimitOptions
): RateLimitResult {
    const now = Date.now();
    const existing = store.get(identifier);

    // Start a fresh window if there's no entry or the previous window expired
    if (!existing || existing.resetAt < now) {
        const entry: Entry = { count: 1, resetAt: now + windowMs };
        store.set(identifier, entry);
        return { success: true, remaining: limit - 1, resetAt: entry.resetAt };
    }

    existing.count += 1;

    if (existing.count > limit) {
        return { success: false, remaining: 0, resetAt: existing.resetAt };
    }

    return { success: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Convenience: get the client IP from a Next.js Request. */
export function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') ?? 'unknown';
}
