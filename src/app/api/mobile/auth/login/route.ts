import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { queryOne } from '@/lib/db';
import { signMobileJWT } from '@/lib/mobile-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// ─── Input schema ─────────────────────────────────────────────────────────────
const loginSchema = z.object({
    email:    z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

// ─── Rate limit: 5 attempts per 15 minutes per IP ────────────────────────────
const RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
    // 1. Rate limit by IP
    const ip = getClientIp(request);
    const rl = rateLimit(`login:${ip}`, RATE_LIMIT);
    if (!rl.success) {
        return NextResponse.json(
            { error: 'Too many login attempts. Please try again later.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
                    'X-RateLimit-Limit': String(RATE_LIMIT.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
                },
            }
        );
    }

    try {
        // 2. Validate & parse body
        const body = await request.json().catch(() => null);
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
                { status: 400 }
            );
        }
        const { email, password } = parsed.data;

        // 3. Domain restriction — only @jtl.co.ke accounts
        if (!email.endsWith('@jtl.co.ke')) {
            return NextResponse.json(
                { error: 'Access denied. Only @jtl.co.ke accounts are allowed.' },
                { status: 403 }
            );
        }

        // 4. Look up user
        const user = await queryOne<any>('SELECT * FROM "User" WHERE email = $1', email);

        // 5. Verify password (use constant-time compare; always compare even if user missing
        //    to prevent timing-based user enumeration)
        const dummyHash = '$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnn';
        const valid = user?.password
            ? await bcrypt.compare(password, user.password)
            : await bcrypt.compare(password, dummyHash).then(() => false);

        if (!valid) {
            // Return the same message whether the email exists or not
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // 6. Issue token
        const token = await signMobileJWT({
            id:    user.id,
            email: user.email,
            name:  user.name ?? '',
            role:  user.role,
        });

        return NextResponse.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (e) {
        console.error('[mobile/auth/login]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
