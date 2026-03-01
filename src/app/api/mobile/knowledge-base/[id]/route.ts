import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { execute } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const updates = await request.json();

    const fields: string[] = [];
    const vals: any[] = [];

    if (updates.title !== undefined) { fields.push(`title = $${vals.length + 1}`); vals.push(updates.title); }
    if (updates.content !== undefined) { fields.push(`content = $${vals.length + 1}`); vals.push(updates.content); }
    if (updates.category !== undefined) {
        fields.push(`category = $${vals.length + 1}`);
        vals.push(updates.category ? updates.category.replace(/-/g, '_') : null);
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    await execute(`UPDATE kb_articles SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);
    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await execute('DELETE FROM kb_articles WHERE id = $1', id);
    return new NextResponse(null, { status: 204 });
}
