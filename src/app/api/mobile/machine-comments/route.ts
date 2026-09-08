import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machine_id');
    if (!machineId) return NextResponse.json({ error: 'machine_id required' }, { status: 400 });

    let sql = `SELECT * FROM machine_comments WHERE machine_id = $1`;
    if (session.role === 'USER') sql += ' AND is_internal = false';
    sql += ' ORDER BY created_at ASC';

    const rows = await query<any>(sql, machineId);
    return NextResponse.json(rows);
}

export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const input = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const isInternal = session.role !== 'USER' && (input.is_internal ?? false);

        await execute(
            `INSERT INTO machine_comments (id, machine_id, user_id, author_name, content, is_internal, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            id, input.machine_id, session.id, session.name,
            input.content, isInternal, now
        );

        return NextResponse.json({
            id, machine_id: input.machine_id, user_id: session.id,
            author_name: session.name, content: input.content,
            is_internal: isInternal, created_at: now,
        }, { status: 201 });
    } catch (e) {
        console.error('[mobile/machine-comments POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
