import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const search = searchParams.get('search');

    const params: any[] = [];
    let sql = 'SELECT * FROM requisitions WHERE 1=1';

    if (stage && stage !== 'all') {
        sql += ` AND current_stage = $${params.length + 1}`;
        params.push(stage);
    }
    if (search) {
        const s = `%${search}%`;
        sql += ` AND (title ILIKE $${params.length + 1} OR requested_for ILIKE $${params.length + 2} OR supplier_name ILIKE $${params.length + 3})`;
        params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query<any>(sql, ...params);
    return NextResponse.json(rows);
}

export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const input = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await execute(
            `INSERT INTO requisitions (id, requisition_date, title, type, item_quantity, requested_for, supplier_name, supplier_contact, total_amount, current_stage, notes, created_by, requestor_name, requestor_email, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,$15)`,
            id,
            input.requisition_date ?? now.split('T')[0],
            input.title,
            input.type ?? 'other',
            input.item_quantity ?? 1,
            input.requested_for ?? null,
            input.supplier_name ?? '',
            input.supplier_contact ?? null,
            input.total_amount ?? 0,
            input.notes ?? null,
            session.id,
            session.name ?? null,
            session.email ?? null,
            now,
            now
        );

        const rows = await query<any>('SELECT * FROM requisitions WHERE id = $1', id);
        return NextResponse.json(rows[0], { status: 201 });
    } catch (e) {
        console.error('[mobile/procurement POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
