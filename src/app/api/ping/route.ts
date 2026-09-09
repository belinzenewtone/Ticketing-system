/**
 * GET /api/ping
 *
 * Lightweight keep-warm endpoint. Point an external uptime monitor
 * (e.g. UptimeRobot free tier — https://uptimerobot.com) at this URL
 * with a 5-minute check interval to prevent Vercel cold starts.
 *
 * Also warms the DB connection pool by running a trivial query,
 * so the first real user request after the ping finds a live connection.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Trivial query — just enough to keep the DB connection alive
        await query('SELECT 1');
        return NextResponse.json({ ok: true, ts: Date.now() });
    } catch {
        // Return 200 anyway so the uptime monitor doesn't alert on DB hiccups
        return NextResponse.json({ ok: true, db: 'unreachable', ts: Date.now() });
    }
}
