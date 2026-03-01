import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function fromEnum(v: string) { return v?.replace(/_/g, '-') ?? ''; }
function toEnum(v: string) { return v?.replace(/-/g, '_') ?? ''; }

function serialize(m: any) {
    return { ...m, reason: fromEnum(m.reason), status: fromEnum(m.status) };
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const reason = searchParams.get('reason');
    const search = searchParams.get('search');

    let sql = 'SELECT * FROM machine_requests WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') { sql += ` AND status = $${params.length + 1}`; params.push(toEnum(status)); }
    if (reason && reason !== 'all') { sql += ` AND reason = $${params.length + 1}`; params.push(toEnum(reason)); }
    if (search) {
        const s = `%${search}%`;
        sql += ` AND (requester_name ILIKE $${params.length + 1} OR user_name ILIKE $${params.length + 2} OR work_email ILIKE $${params.length + 3})`;
        params.push(s, s, s);
    }

    sql += ' ORDER BY number DESC';
    const rows = await query<any>(sql, ...params);
    return NextResponse.json(rows.map(serialize));
}

export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const input = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await execute(
            `INSERT INTO machine_requests (id, date, requester_name, user_name, work_email, reason, importance, status, notes, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            id,
            input.date ?? now.split('T')[0],
            input.requester_name, input.user_name, input.work_email,
            toEnum(input.reason), input.importance,
            'pending',
            input.notes ?? null,
            session.id, now, now
        );

        const rows = await query<any>('SELECT * FROM machine_requests WHERE id = $1', id);
        return NextResponse.json(serialize(rows[0]), { status: 201 });
    } catch (e) {
        console.error('[mobile/machines POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
