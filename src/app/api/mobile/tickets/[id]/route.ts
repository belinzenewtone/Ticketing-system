import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';
import { logActivity } from '@/services/activity';
import type { TicketPriority } from '@/types/database';

function fromEnum(val: string) { return val?.replace(/_/g, '-') ?? ''; }
function toEnum(val: string) { return val?.replace(/-/g, '_') ?? ''; }

const SLA: Record<TicketPriority, number> = { low: 20, medium: 15, high: 10, critical: 5 };
function dueDate(p: TicketPriority) {
    const d = new Date(); d.setMinutes(d.getMinutes() + SLA[p]); return d.toISOString();
}

function serialize(t: any) {
    return { ...t, category: fromEnum(t.category), status: fromEnum(t.status) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const rows = await query<any>(
        `SELECT t.*,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) as comment_count,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id AND c.is_internal = false) as public_comment_count
         FROM tickets t WHERE t.id = $1`, id
    );
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(serialize(rows[0]));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const updates = await request.json();

    const fields: string[] = [];
    const vals: any[] = [];

    const map: Record<string, (v: any) => any> = {
        ticket_date: v => v,
        employee_name: v => v,
        department: v => v,
        category: v => toEnum(v),
        priority: v => v,
        status: v => toEnum(v),
        sentiment: v => v,
        subject: v => v,
        description: v => v,
        resolution_notes: v => v,
        internal_notes: v => v,
        assigned_to: v => v,
        attachment_url: v => v,
    };

    // Fetch previous for activity log
    const prev = (await query<any>('SELECT * FROM tickets WHERE id = $1', id))[0];
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    for (const [key, transform] of Object.entries(map)) {
        if (updates[key] !== undefined) {
            fields.push(`${key} = $${vals.length + 1}`);
            vals.push(transform(updates[key]));
        }
    }
    if (updates.priority) {
        fields.push(`due_date = $${vals.length + 1}`);
        vals.push(dueDate(updates.priority as TicketPriority));
    }

    fields.push(`updated_at = $${vals.length + 1}`);
    vals.push(new Date().toISOString());
    vals.push(id);

    if (fields.length > 1) {
        await execute(`UPDATE tickets SET ${fields.join(', ')} WHERE id = $${vals.length}`, ...vals);
    }

    if (updates.status && updates.status !== fromEnum(prev.status)) {
        await logActivity(id, 'status_changed', { from: fromEnum(prev.status), to: updates.status });
    }
    if (updates.priority && updates.priority !== prev.priority) {
        await logActivity(id, 'priority_changed', { from: prev.priority, to: updates.priority });
    }
    if (updates.assigned_to !== undefined && updates.assigned_to !== prev.assigned_to) {
        await logActivity(id, 'assigned', { agent: updates.assigned_to ?? 'unassigned' });
    }

    const rows = await query<any>('SELECT * FROM tickets WHERE id = $1', id);
    return NextResponse.json(serialize(rows[0]));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await execute('DELETE FROM tickets WHERE id = $1', id);
    return new NextResponse(null, { status: 204 });
}
