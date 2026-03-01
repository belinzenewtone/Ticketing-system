import { NextResponse } from 'next/server';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';

function fromEnum(val: string) { return val?.replace(/_/g, '-') ?? ''; }
function toEnum(val: string) { return val?.replace(/-/g, '_') ?? ''; }

function serialize(t: any) {
    return {
        ...t,
        category: fromEnum(t.category),
        status: fromEnum(t.status),
        comment_count: Number(t.comment_count ?? 0),
        public_comment_count: Number(t.public_comment_count ?? 0),
    };
}

// GET — user's own submitted tickets
export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await query<any>(
        `SELECT t.*,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id AND c.is_internal = false) as public_comment_count,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) as comment_count
         FROM tickets t
         WHERE t.created_by = $1
         ORDER BY t.number DESC`,
        session.id
    );

    return NextResponse.json(rows.map(serialize));
}

// POST — user submits a new ticket
export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const input = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await execute(
            `INSERT INTO tickets (id, ticket_date, employee_name, department, category, priority, status, subject, description, due_date, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            id,
            now.split('T')[0],
            session.name,
            input.department ?? null,
            toEnum(input.category ?? 'other'),
            input.priority ?? 'medium',
            'open',
            input.subject,
            input.description ?? null,
            new Date(Date.now() + 15 * 60000).toISOString(), // 15 min SLA default
            session.id, now, now
        );

        const rows = await query<any>('SELECT * FROM tickets WHERE id = $1', id);
        return NextResponse.json(serialize(rows[0]), { status: 201 });
    } catch (e) {
        console.error('[mobile/portal/tickets POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
