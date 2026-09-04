import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { queryOne, execute } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await queryOne<any>('SELECT id, email, name, role, "createdAt" FROM "User" WHERE id = $1', session.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json(user);
}

export async function PATCH(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    await execute(
        'UPDATE "User" SET name = $1, "updatedAt" = $2 WHERE id = $3',
        name.trim(), new Date().toISOString(), session.id
    );

    const user = await queryOne<any>('SELECT id, email, name, role FROM "User" WHERE id = $1', session.id);
    return NextResponse.json(user);
}
