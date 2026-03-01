'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { Ticket, CreateTicketInput, TicketCategory, TicketPriority, TicketStatus, CannedResponse } from '@/types/database';
import { logActivity } from './activity';

// PostgreSQL CHECK constraints use underscores; app layer uses hyphens.
function fromEnum(val: string): string { return val?.replace(/_/g, '-') ?? ''; }
function toEnum(val: string): string { return val?.replace(/-/g, '_') ?? ''; }

const SLA_MINUTES: Record<TicketPriority, number> = {
    low: 20,
    medium: 15,
    high: 10,
    critical: 5,
};

function calculateDueDate(priority: TicketPriority): string {
    const due = new Date();
    due.setMinutes(due.getMinutes() + SLA_MINUTES[priority]);
    return due.toISOString();
}

function serializeTicket(t: any): Ticket {
    return {
        id: t.id,
        number: t.number,
        ticket_date: t.ticket_date,
        employee_name: t.employee_name,
        department: t.department ?? '',
        category: fromEnum(t.category) as TicketCategory,
        priority: t.priority as TicketPriority,
        status: fromEnum(t.status) as TicketStatus,
        sentiment: t.sentiment as Ticket['sentiment'],
        subject: t.subject,
        description: t.description ?? '',
        resolution_notes: t.resolution_notes ?? '',
        internal_notes: t.internal_notes ?? null,
        due_date: t.due_date,
        created_by: t.created_by ?? null,
        assigned_to: t.assigned_to ?? null,
        attachment_url: t.attachment_url ?? null,
        merged_into: t.merged_into ?? null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        comment_count: Number(t.comment_count ?? 0),
        public_comment_count: Number(t.public_comment_count ?? 0),
    };
}

export async function getTickets(filters?: {
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    search?: string;
    dateRange?: 'today' | 'week' | 'month' | 'year';
    created_by?: string;
    assigned_to?: string;
}): Promise<Ticket[]> {
    let sql = `
        SELECT t.*, 
        (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id AND c.is_internal = 0) as public_comment_count
        FROM tickets t
        WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.category) {
        sql += " AND t.category = ?";
        params.push(toEnum(filters.category));
    }
    if (filters?.priority) {
        sql += " AND t.priority = ?";
        params.push(filters.priority);
    }
    if (filters?.status) {
        sql += " AND t.status = ?";
        params.push(toEnum(filters.status));
    }
    if (filters?.created_by) {
        sql += " AND t.created_by = ?";
        params.push(filters.created_by);
    }
    if (filters?.assigned_to) {
        sql += " AND t.assigned_to = ?";
        params.push(filters.assigned_to);
    }
    if (filters?.search) {
        sql += " AND (t.employee_name LIKE ? OR t.subject LIKE ? OR t.department LIKE ?)";
        const searchVal = `%${filters.search}%`;
        params.push(searchVal, searchVal, searchVal);
    }
    if (filters?.dateRange) {
        // Simple string comparison for dates in SQLite
        const now = new Date();
        let start: string;
        switch (filters.dateRange) {
            case 'today': start = now.toISOString().split('T')[0]; break;
            case 'week':
                const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
                start = weekAgo.toISOString().split('T')[0]; break;
            case 'month':
                const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
                start = monthAgo.toISOString().split('T')[0]; break;
            case 'year':
                const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1);
                start = yearAgo.toISOString().split('T')[0]; break;
            default: start = '0000-00-00';
        }
        sql += " AND t.ticket_date >= ?";
        params.push(start);
    }

    sql += " ORDER BY t.number DESC";

    const tickets = await query<any>(sql, ...params);
    return tickets.map(serializeTicket);
}

export async function addTicket(input: CreateTicketInput): Promise<Ticket> {
    const session = await auth();
    const id = crypto.randomUUID();
    const due_date = calculateDueDate(input.priority);
    const now = new Date().toISOString();

    await execute(
        `INSERT INTO tickets (
            id, ticket_date, employee_name, department, category, priority, 
            status, sentiment, subject, description, internal_notes, 
            due_date, attachment_url, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.ticket_date ?? null,
        input.employee_name,
        input.department ?? null,
        toEnum(input.category),
        input.priority,
        input.status ? toEnum(input.status) : 'open',
        input.sentiment ?? 'neutral',
        input.subject,
        input.description ?? null,
        input.internal_notes ?? null,
        due_date,
        input.attachment_url ?? null,
        session?.user?.id ?? null,
        now,
        now
    );

    await logActivity(id, 'created', { by: input.employee_name });

    // Fetch the inserted ticket to get the auto-incremented 'number'
    const ticket = await queryOne<any>('SELECT * FROM tickets WHERE id = ?', id);
    return serializeTicket(ticket);
}

export async function updateTicket(id: string, updates: Partial<Ticket>, previousTicket?: Partial<Ticket>): Promise<Ticket> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.ticket_date !== undefined) { fields.push("ticket_date = ?"); params.push(updates.ticket_date); }
    if (updates.employee_name !== undefined) { fields.push("employee_name = ?"); params.push(updates.employee_name); }
    if (updates.department !== undefined) { fields.push("department = ?"); params.push(updates.department); }
    if (updates.category !== undefined) { fields.push("category = ?"); params.push(toEnum(updates.category)); }
    if (updates.priority !== undefined) {
        fields.push("priority = ?"); params.push(updates.priority);
        fields.push("due_date = ?"); params.push(calculateDueDate(updates.priority));
    }
    if (updates.status !== undefined) { fields.push("status = ?"); params.push(toEnum(updates.status)); }
    if (updates.sentiment !== undefined) { fields.push("sentiment = ?"); params.push(updates.sentiment); }
    if (updates.subject !== undefined) { fields.push("subject = ?"); params.push(updates.subject); }
    if (updates.description !== undefined) { fields.push("description = ?"); params.push(updates.description); }
    if (updates.resolution_notes !== undefined) { fields.push("resolution_notes = ?"); params.push(updates.resolution_notes); }
    if (updates.internal_notes !== undefined) { fields.push("internal_notes = ?"); params.push(updates.internal_notes); }
    if (updates.assigned_to !== undefined) { fields.push("assigned_to = ?"); params.push(updates.assigned_to); }
    if (updates.attachment_url !== undefined) { fields.push("attachment_url = ?"); params.push(updates.attachment_url); }

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());

    if (fields.length > 1) {
        const sql = `UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`;
        params.push(id);
        await execute(sql, ...params);
    }

    if (previousTicket) {
        if (updates.status && updates.status !== previousTicket.status) {
            await logActivity(id, 'status_changed', { from: previousTicket.status ?? '', to: updates.status });
        }
        if (updates.assigned_to !== undefined && updates.assigned_to !== previousTicket.assigned_to) {
            await logActivity(id, 'assigned', { agent: updates.assigned_to ?? 'unassigned' });
        }
        if (updates.priority && updates.priority !== previousTicket.priority) {
            await logActivity(id, 'priority_changed', { from: previousTicket.priority ?? '', to: updates.priority });
        }
        if (updates.resolution_notes && updates.resolution_notes !== previousTicket.resolution_notes) {
            await logActivity(id, 'note_added', {});
        }
    }

    const ticket = await queryOne<any>('SELECT * FROM tickets WHERE id = ?', id);
    return serializeTicket(ticket);
}

export async function deleteTicket(id: string): Promise<void> {
    await execute('DELETE FROM tickets WHERE id = ?', id);
}

export async function mergeTickets(sourceId: string, targetId: string): Promise<void> {
    await execute("UPDATE tickets SET merged_into = ?, status = 'closed' WHERE id = ?", targetId, sourceId);
    await logActivity(sourceId, 'merged', { into: targetId });
    await logActivity(targetId, 'merged', { from: sourceId });
}

export async function getTicketStats(filters?: { created_by?: string; assigned_to?: string }) {
    let sql = 'SELECT status FROM tickets WHERE 1=1';
    const params: any[] = [];
    if (filters?.created_by) { sql += ' AND created_by = ?'; params.push(filters.created_by); }
    if (filters?.assigned_to) { sql += ' AND assigned_to = ?'; params.push(filters.assigned_to); }

    const rows = await query<any>(sql, ...params);
    return {
        total: rows.length,
        open: rows.filter(t => t.status === 'open').length,
        inProgress: rows.filter(t => t.status === 'in_progress').length,
        resolved: rows.filter(t => t.status === 'resolved').length,
        closed: rows.filter(t => t.status === 'closed').length,
    };
}

// ── Canned Responses ──────────────────────────────────────────

export async function getCannedResponses(): Promise<CannedResponse[]> {
    const rows = await query<any>('SELECT * FROM canned_responses ORDER BY created_at DESC');
    return rows.map(cr => ({
        id: cr.id,
        title: cr.title,
        content: cr.content,
        created_by: cr.created_by,
        created_at: cr.created_at,
    }));
}

export async function addCannedResponse(title: string, content: string): Promise<CannedResponse> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
        'INSERT INTO canned_responses (id, title, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
        id, title, content, session?.user?.id ?? null, now
    );

    return { id, title, content, created_by: session?.user?.id ?? null, created_at: now };
}

export async function deleteCannedResponse(id: string): Promise<void> {
    await execute('DELETE FROM canned_responses WHERE id = ?', id);
}
