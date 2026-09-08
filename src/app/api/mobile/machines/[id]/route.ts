import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function fromEnum(v: string) { return v?.replace(/_/g, '-') ?? ''; }
function toEnum(v: string) { return v?.replace(/-/g, '_') ?? ''; }

function serialize(m: any) {
    return {
        ...m,
        reason: fromEnum(m.reason),
        status: fromEnum(m.status),
        item_type: m.item_type ?? null,
    };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const rows = await query<any>('SELECT * FROM machine_requests WHERE id = $1', id);
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

    const str = (k: string, v: any) => { fields.push(`${k} = $${vals.length + 1}`); vals.push(v); };

    if (updates.status !== undefined) str('status', toEnum(updates.status));
    if (updates.notes !== undefined) str('notes', updates.notes);
    if (updates.requester_name !== undefined) str('requester_name', updates.requester_name);
    if (updates.user_name !== undefined) str('user_name', updates.user_name);
    if (updates.work_email !== undefined) str('work_email', updates.work_email);
    if (updates.reason !== undefined) str('reason', toEnum(updates.reason));
    if (updates.importance !== undefined) str('importance', updates.importance);
    if (updates.item_type !== undefined) str('item_type', updates.item_type);
    if (updates.item_count !== undefined) str('item_count', updates.item_count);
    if (updates.supply_name !== undefined) str('supply_name', updates.supply_name);
    if (updates.resolution_notes !== undefined) str('resolution_notes', updates.resolution_notes);
    if (updates.internal_notes !== undefined) str('internal_notes', updates.internal_notes);

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    await execute(`UPDATE machine_requests SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);

    const rows = await query<any>('SELECT * FROM machine_requests WHERE id = $1', id);
    return NextResponse.json(serialize(rows[0]));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await execute('DELETE FROM machine_requests WHERE id = $1', id);
    return new NextResponse(null, { status: 204 });
}
