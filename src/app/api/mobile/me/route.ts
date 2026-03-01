import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { queryOne } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await queryOne<any>('SELECT id, email, name, role, "createdAt" FROM "User" WHERE id = $1', session.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json(user);
}
