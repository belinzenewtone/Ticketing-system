import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query } from '@/lib/db';

// Returns all ADMIN and IT_STAFF users — used for ticket assignment picker
export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await query<any>(
        `SELECT id, name, email, role FROM "User" WHERE role IN ('ADMIN', 'IT_STAFF') ORDER BY name ASC`
    );

    return NextResponse.json(rows);
}
