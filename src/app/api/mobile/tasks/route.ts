import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function serialize(t: any) {
    return { ...t, completed: t.completed === true || t.completed === 1 };
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    const completed = searchParams.get('completed');
    const importance = searchParams.get('importance');
    const search = searchParams.get('search');

    // Each user sees only their own tasks
    sql += ` AND created_by = $${params.length + 1}`;
    params.push(session.id);

    if (completed !== null && completed !== 'all') {
        sql += ` AND completed = $${params.length + 1}`;
        params.push(completed === 'true');
    }
    if (importance && importance !== 'all') {
        sql += ` AND importance = $${params.length + 1}`;
        params.push(importance);
    }
    if (search) {
        sql += ` AND text ILIKE $${params.length + 1}`;
        params.push(`%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
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
            `INSERT INTO tasks (id, date, text, importance, completed, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            id, input.date ?? null, input.text, input.importance,
            false, session.id, now, now
        );

        return NextResponse.json({
            id, date: input.date ?? null, text: input.text,
            importance: input.importance, completed: false,
            created_by: session.id, created_at: now, updated_at: now,
        }, { status: 201 });
    } catch (e) {
        console.error('[mobile/tasks POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
