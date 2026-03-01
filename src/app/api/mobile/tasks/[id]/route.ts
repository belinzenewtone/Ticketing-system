import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const updates = await request.json();

    const fields: string[] = [];
    const vals: any[] = [];

    if (updates.text !== undefined) { fields.push(`text = $${vals.length + 1}`); vals.push(updates.text); }
    if (updates.date !== undefined) { fields.push(`date = $${vals.length + 1}`); vals.push(updates.date); }
    if (updates.importance !== undefined) { fields.push(`importance = $${vals.length + 1}`); vals.push(updates.importance); }
    if (updates.completed !== undefined) { fields.push(`completed = $${vals.length + 1}`); vals.push(updates.completed); }

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    if (fields.length > 1) {
        await execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);
    }

    const rows = await query<any>('SELECT * FROM tasks WHERE id = $1', id);
    const t = rows[0];
    return NextResponse.json({ ...t, completed: t.completed === true || t.completed === 1 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await execute('DELETE FROM tasks WHERE id = $1 AND created_by = $2', id, session.id);
    return new NextResponse(null, { status: 204 });
}
