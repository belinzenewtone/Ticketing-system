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

    // Portal users only see their own requests
    const rows = await query<any>(
        'SELECT * FROM machine_requests WHERE created_by = $1 ORDER BY number DESC',
        session.id
    );
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
            `INSERT INTO machine_requests (id, date, requester_name, user_name, work_email, reason, importance, item_type, item_count, supply_name, status, notes, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            id,
            input.date ?? now.split('T')[0],
            input.requester_name ?? session.name ?? '',
            input.user_name ?? session.name ?? '',
            input.work_email ?? session.email ?? '',
            toEnum(input.reason ?? 'faulty'),
            input.importance ?? 'neutral',
            input.item_type ?? null,
            input.item_count ?? null,
            input.supply_name ?? null,
            'pending',
            input.notes ?? null,
            session.id, now, now
        );

        const rows = await query<any>('SELECT * FROM machine_requests WHERE id = $1', id);
        return NextResponse.json(serialize(rows[0]), { status: 201 });
    } catch (e) {
        console.error('[mobile/portal/machines POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
