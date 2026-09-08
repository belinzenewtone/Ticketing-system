import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

const STAGE_ORDER = [
    'draft','requestor','head_department','cio','head_hr','general_manager',
    'director_strategy','head_finance','chairman','procurement','awaiting_delivery','delivered',
];

function nextStage(current: string): string {
    const idx = STAGE_ORDER.indexOf(current);
    return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : 'delivered';
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const [rows, stages, items] = await Promise.all([
        query<any>('SELECT * FROM requisitions WHERE id = $1', id),
        query<any>('SELECT * FROM requisition_stages WHERE requisition_id = $1 ORDER BY created_at ASC', id),
        query<any>('SELECT * FROM requisition_items WHERE requisition_id = $1 ORDER BY created_at ASC', id),
    ]);

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...rows[0], stages, items });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const updates = await request.json();

    // Handle approve / reject actions
    if (updates.action === 'approve') {
        const rows = await query<any>('SELECT current_stage FROM requisitions WHERE id = $1', id);
        if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const stage = rows[0].current_stage;
        const stageId = crypto.randomUUID();
        await execute(
            `INSERT INTO requisition_stages (id, requisition_id, stage, status, signed_date, notes, recorded_by) VALUES ($1,$2,$3,'approved',$4,$5,$6)`,
            stageId, id, stage, updates.signed_date ?? new Date().toISOString().split('T')[0], updates.notes ?? null, session.id
        );
        await execute(
            `UPDATE requisitions SET current_stage = $1, updated_at = NOW() WHERE id = $2`,
            nextStage(stage), id
        );
        const updated = await query<any>('SELECT * FROM requisitions WHERE id = $1', id);
        return NextResponse.json(updated[0]);
    }

    if (updates.action === 'reject') {
        const rows = await query<any>('SELECT current_stage FROM requisitions WHERE id = $1', id);
        if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const stage = rows[0].current_stage;
        const stageId = crypto.randomUUID();
        await execute(
            `INSERT INTO requisition_stages (id, requisition_id, stage, status, notes, recorded_by) VALUES ($1,$2,$3,'rejected',$4,$5)`,
            stageId, id, stage, updates.reason ?? 'Rejected', session.id
        );
        await execute(
            `UPDATE requisitions SET current_stage = 'draft', updated_at = NOW() WHERE id = $1`, id
        );
        const updated = await query<any>('SELECT * FROM requisitions WHERE id = $1', id);
        return NextResponse.json(updated[0]);
    }

    // General update
    const fields: string[] = [];
    const vals: any[] = [];
    const allowed = ['requisition_date','title','type','item_quantity','requested_for','supplier_name','supplier_contact','total_amount','notes'];
    for (const key of allowed) {
        if (key in updates) { fields.push(`${key} = $${vals.length + 1}`); vals.push(updates[key]); }
    }
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);
    await execute(`UPDATE requisitions SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);
    const updated = await query<any>('SELECT * FROM requisitions WHERE id = $1', id);
    return NextResponse.json(updated[0]);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await execute('DELETE FROM requisitions WHERE id = $1', id);
    return NextResponse.json({ ok: true });
}
