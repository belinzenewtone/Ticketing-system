import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function serialize(e: any) {
    return { ...e, completed: Boolean(e.completed) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const rows = await query<any>('SELECT * FROM entries WHERE id = $1', id);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(serialize(rows[0]));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const updates = await request.json();
    const fields: string[] = [];
    const vals: any[] = [];

    const allowed = ['entry_date','employee_name','work_email','employee_phone','alt_email_status','alt_email','resolution','completed'];
    for (const key of allowed) {
        if (key in updates) {
            fields.push(`${key} = $${vals.length + 1}`);
            vals.push(updates[key]);
        }
    }
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    await execute(`UPDATE entries SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);
    const rows = await query<any>('SELECT * FROM entries WHERE id = $1', id);
    return NextResponse.json(serialize(rows[0]));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await execute('DELETE FROM entries WHERE id = $1', id);
    return NextResponse.json({ ok: true });
}
