import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';
import { signMobileJWT } from '@/lib/mobile-auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        if (!email.toLowerCase().endsWith('@jtl.co.ke')) {
            return NextResponse.json({ error: 'Access denied. Only @jtl.co.ke accounts are allowed.' }, { status: 403 });
        }

        const user = await queryOne<any>('SELECT * FROM "User" WHERE email = $1', email);

        if (!user || !user.password) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const token = await signMobileJWT({
            id: user.id,
            email: user.email,
            name: user.name ?? '',
            role: user.role,
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
