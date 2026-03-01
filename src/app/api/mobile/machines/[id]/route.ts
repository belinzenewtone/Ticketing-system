import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function fromEnum(v: string) { return v?.replace(/_/g, '-') ?? ''; }
function toEnum(v: string) { return v?.replace(/-/g, '_') ?? ''; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const updates = await request.json();

    const fields: string[] = [];
    const vals: any[] = [];

    if (updates.status !== undefined) { fields.push(`status = $${vals.length + 1}`); vals.push(toEnum(updates.status)); }
    if (updates.notes !== undefined) { fields.push(`notes = $${vals.length + 1}`); vals.push(updates.notes); }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    await execute(`UPDATE machine_requests SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);

    const rows = await query<any>('SELECT * FROM machine_requests WHERE id = $1', id);
    const m = rows[0];
    return NextResponse.json({ ...m, reason: fromEnum(m.reason), status: fromEnum(m.status) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await execute('DELETE FROM machine_requests WHERE id = $1', id);
    return new NextResponse(null, { status: 204 });
}
