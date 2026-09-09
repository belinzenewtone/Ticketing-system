import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/mobile-auth';
import { query, execute } from '@/lib/db';
import { logActivity } from '@/services/activity';
import type { TicketCategory, TicketPriority, TicketStatus } from '@/types/database';

const createTicketSchema = z.object({
    employee_name:  z.string().min(1).max(200),
    subject:        z.string().min(1).max(500),
    category:       z.enum(['email', 'account-login', 'account_login', 'password-reset', 'password_reset', 'hardware', 'software', 'network-vpn', 'network_vpn', 'other']),
    priority:       z.enum(['critical', 'high', 'medium', 'low']),
    department:     z.string().max(100).optional().nullable(),
    description:    z.string().max(5000).optional().nullable(),
    internal_notes: z.string().max(5000).optional().nullable(),
    attachment_url: z.string().url().optional().nullable(),
    ticket_date:    z.string().optional().nullable(),
    status:         z.enum(['open', 'in_progress', 'in-progress', 'resolved', 'closed']).optional(),
    sentiment:      z.enum(['positive', 'neutral', 'frustrated', 'angry']).optional(),
});

function fromEnum(val: string): string { return val?.replace(/_/g, '-') ?? ''; }
function toEnum(val: string): string { return val?.replace(/-/g, '_') ?? ''; }

const SLA: Record<TicketPriority, number> = { low: 20, medium: 15, high: 10, critical: 5 };
function dueDate(p: TicketPriority) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + SLA[p]);
    return d.toISOString();
}

function serialize(t: any) {
    return {
        ...t,
        category: fromEnum(t.category),
        status: fromEnum(t.status),
        comment_count: Number(t.comment_count ?? 0),
        public_comment_count: Number(t.public_comment_count ?? 0),
    };
}

export async function GET(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const params: any[] = [];
    let sql = `
        SELECT t.*,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) as comment_count,
            (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id AND c.is_internal = false) as public_comment_count
        FROM tickets t WHERE 1=1
    `;

    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const dateRange = searchParams.get('dateRange');

    if (category && category !== 'all') { sql += ` AND t.category = $${params.length + 1}`; params.push(toEnum(category)); }
    if (priority && priority !== 'all') { sql += ` AND t.priority = $${params.length + 1}`; params.push(priority); }
    if (status && status !== 'all') { sql += ` AND t.status = $${params.length + 1}`; params.push(toEnum(status)); }
    if (search) {
        const s = `%${search}%`;
        sql += ` AND (t.employee_name ILIKE $${params.length + 1} OR t.subject ILIKE $${params.length + 2} OR t.department ILIKE $${params.length + 3})`;
        params.push(s, s, s);
    }
    if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let start: string;
        if (dateRange === 'today') start = now.toISOString().split('T')[0];
        else if (dateRange === 'week') { now.setDate(now.getDate() - 7); start = now.toISOString().split('T')[0]; }
        else if (dateRange === 'month') { now.setMonth(now.getMonth() - 1); start = now.toISOString().split('T')[0]; }
        else { now.setFullYear(now.getFullYear() - 1); start = now.toISOString().split('T')[0]; }
        sql += ` AND t.ticket_date >= $${params.length + 1}`;
        params.push(start);
    }

    sql += ' ORDER BY t.number DESC';

    const tickets = await query<any>(sql, ...params);
    return NextResponse.json(tickets.map(serialize));
}

export async function POST(request: Request) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json().catch(() => null);
        const parsed = createTicketSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
                { status: 400 }
            );
        }
        const input = parsed.data;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await execute(
            `INSERT INTO tickets (id, ticket_date, employee_name, department, category, priority, status, sentiment, subject, description, internal_notes, due_date, attachment_url, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            id, input.ticket_date ?? now.split('T')[0], input.employee_name,
            input.department ?? null, toEnum(input.category), input.priority,
            input.status ? toEnum(input.status) : 'open',
            input.sentiment ?? 'neutral', input.subject,
            input.description ?? null, input.internal_notes ?? null,
            dueDate(input.priority as TicketPriority),
            input.attachment_url ?? null, session.id, now, now
        );

        await logActivity(id, 'created', { by: input.employee_name });

        const ticket = await query<any>(
            `SELECT t.*, 0 as comment_count, 0 as public_comment_count FROM tickets t WHERE t.id = $1`, id
        );
        return NextResponse.json(serialize(ticket[0]), { status: 201 });
    } catch (e) {
        console.error('[mobile/tickets POST]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
