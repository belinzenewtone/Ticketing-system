import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function serialize(e: any) {
    return { ...e, completed: Boolean(e.completed) };
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const completed = searchParams.get('completed');
    const dateRange = searchParams.get('dateRange');

    const params: any[] = [];
    let sql = 'SELECT * FROM entries WHERE 1=1';

    if (search) {
        const s = `%${search}%`;
        sql += ` AND (employee_name ILIKE $${params.length + 1} OR work_email ILIKE $${params.length + 2})`;
        params.push(s, s);
    }
    if (completed !== null && completed !== 'all') {
        sql += ` AND completed = $${params.length + 1}`;
        params.push(completed === 'true');
    }
    if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let start: Date;
        if (dateRange === 'today') start = new Date(now.toDateString());
        else if (dateRange === 'week') { start = new Date(now); start.setDate(start.getDate() - 7); }
        else if (dateRange === 'month') { start = new Date(now); start.setMonth(start.getMonth() - 1); }
        else { start = new Date(now); start.setFullYear(start.getFullYear() - 1); }
        sql += ` AND entry_date >= $${params.length + 1}`;
        params.push(start.toISOString().split('T')[0]);
    }

    sql += ' ORDER BY number DESC';
    const rows = await query<any>(sql, ...params);
    return NextResponse.json(rows.map(serialize));
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
            `INSERT INTO entries (id, entry_date, employee_name, work_email, employee_phone, alt_email_status, alt_email, resolution, completed, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            id,
            input.entry_date ?? now.split('T')[0],
            input.employee_name,
            input.work_email,
            input.employee_phone ?? null,
            input.alt_email_status ?? null,
            input.alt_email ?? null,
            input.resolution,
            false,
            session.id,
            now,
            now
        );

        const row = await query<any>('SELECT * FROM entries WHERE id = $1', id);
        return NextResponse.json(serialize(row[0]), { status: 201 });
    } catch (e) {
        console.error('[mobile/entries POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
