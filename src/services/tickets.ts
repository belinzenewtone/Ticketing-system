'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { Ticket, CreateTicketInput, TicketCategory, TicketPriority, TicketStatus, CannedResponse } from '@/types/database';
import { logActivity } from './activity';

// Prisma enum values use underscores; our TypeScript interfaces use hyphens
function fromEnum(val: string): string { return val.replace(/_/g, '-'); }
function toEnum(val: string): string { return val.replace(/-/g, '_'); }

// SLA Timeframes in hours
const SLA_HOURS: Record<TicketPriority, number> = {
    critical: 2,
    high: 8,
    medium: 24,
    low: 48,
};

export function calculateDueDate(priority: TicketPriority): string {
    const hours = SLA_HOURS[priority];
    const due = new Date();
    due.setHours(due.getHours() + hours);
    return due.toISOString();
}

function serializeTicket(t: {
    id: string; number: number; ticketDate: Date | null; employeeName: string;
    department: string | null; category: string; priority: string; status: string;
    sentiment: string; subject: string; description: string | null;
    resolutionNotes: string | null; internalNotes: string | null; dueDate: Date | null;
    createdById: string | null; assignedToId: string | null; attachmentUrl: string | null;
    mergedIntoId: string | null; createdAt: Date; updatedAt: Date;
    comments?: Array<{ id: string; isInternal: boolean }>;
}): Ticket {
    const comments = t.comments ?? [];
    return {
        id: t.id,
        number: t.number,
        ticket_date: t.ticketDate?.toISOString().split('T')[0] ?? '',
        employee_name: t.employeeName,
        department: t.department ?? '',
        category: fromEnum(t.category) as TicketCategory,
        priority: t.priority as TicketPriority,
        status: fromEnum(t.status) as TicketStatus,
        sentiment: t.sentiment as Ticket['sentiment'],
        subject: t.subject,
        description: t.description ?? '',
        resolution_notes: t.resolutionNotes ?? '',
        internal_notes: t.internalNotes ?? null,
        due_date: t.dueDate?.toISOString() ?? null,
        created_by: t.createdById ?? null,
        assigned_to: t.assignedToId ?? null,
        attachment_url: t.attachmentUrl ?? null,
        merged_into: t.mergedIntoId ?? null,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
        // Computed comment counts (extra fields used by the UI)
        ...({ comment_count: comments.length, public_comment_count: comments.filter(c => !c.isInternal).length } as object),
    } as Ticket;
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
    const where: Record<string, unknown> = {};

    if (filters?.category) where.category = toEnum(filters.category);
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.status) where.status = toEnum(filters.status);
    if (filters?.created_by) where.createdById = filters.created_by;
    if (filters?.assigned_to) where.assignedToId = filters.assigned_to;
    if (filters?.search) {
        where.OR = [
            { employeeName: { contains: filters.search, mode: 'insensitive' } },
            { subject: { contains: filters.search, mode: 'insensitive' } },
            { department: { contains: filters.search, mode: 'insensitive' } },
        ];
    }
    if (filters?.dateRange) {
        const now = new Date();
        let start: Date;
        switch (filters.dateRange) {
            case 'today': start = new Date(now.toISOString().split('T')[0]); break;
            case 'week': start = new Date(now); start.setDate(start.getDate() - 7); break;
            case 'month': start = new Date(now); start.setMonth(start.getMonth() - 1); break;
            case 'year': start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
        }
        where.ticketDate = { gte: start };
    }

    const tickets = await prisma.ticket.findMany({
        where: where as Parameters<typeof prisma.ticket.findMany>[0]['where'],
        include: { comments: { select: { id: true, isInternal: true } } },
        orderBy: { number: 'desc' },
    });
    return tickets.map(serializeTicket);
}

export async function addTicket(input: CreateTicketInput): Promise<Ticket> {
    const session = await auth();
    const due_date = calculateDueDate(input.priority);

    const ticket = await prisma.ticket.create({
        data: {
            ticketDate: input.ticket_date ? new Date(input.ticket_date) : null,
            employeeName: input.employee_name,
            department: input.department,
            category: toEnum(input.category) as never,
            priority: input.priority as never,
            status: input.status ? toEnum(input.status) as never : 'open',
            sentiment: input.sentiment as never,
            subject: input.subject,
            description: input.description,
            internalNotes: input.internal_notes,
            dueDate: new Date(due_date),
            attachmentUrl: input.attachment_url,
            createdById: session?.user?.id ?? null,
        },
        include: { comments: { select: { id: true, isInternal: true } } },
    });

    await logActivity(ticket.id, 'created', { by: input.employee_name });
    return serializeTicket(ticket);
}

export async function updateTicket(id: string, updates: Partial<Ticket>, previousTicket?: Partial<Ticket>): Promise<Ticket> {
    const data: Record<string, unknown> = {};

    if (updates.ticket_date !== undefined) data.ticketDate = updates.ticket_date ? new Date(updates.ticket_date) : null;
    if (updates.employee_name !== undefined) data.employeeName = updates.employee_name;
    if (updates.department !== undefined) data.department = updates.department;
    if (updates.category !== undefined) data.category = toEnum(updates.category);
    if (updates.priority !== undefined) {
        data.priority = updates.priority;
        data.dueDate = new Date(calculateDueDate(updates.priority));
    }
    if (updates.status !== undefined) data.status = toEnum(updates.status);
    if (updates.sentiment !== undefined) data.sentiment = updates.sentiment;
    if (updates.subject !== undefined) data.subject = updates.subject;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.resolution_notes !== undefined) data.resolutionNotes = updates.resolution_notes;
    if (updates.internal_notes !== undefined) data.internalNotes = updates.internal_notes;
    if (updates.assigned_to !== undefined) data.assignedToId = updates.assigned_to;
    if (updates.attachment_url !== undefined) data.attachmentUrl = updates.attachment_url;

    const ticket = await prisma.ticket.update({
        where: { id },
        data: data as Parameters<typeof prisma.ticket.update>[0]['data'],
        include: { comments: { select: { id: true, isInternal: true } } },
    });

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

    return serializeTicket(ticket);
}

export async function deleteTicket(id: string): Promise<void> {
    await prisma.ticket.delete({ where: { id } });
}

export async function mergeTickets(sourceId: string, targetId: string): Promise<void> {
    await prisma.ticket.update({
        where: { id: sourceId },
        data: { mergedIntoId: targetId, status: 'closed' },
    });
    await logActivity(sourceId, 'merged', { into: targetId });
    await logActivity(targetId, 'merged', { from: sourceId });
}

export async function getTicketStats(filters?: { created_by?: string; assigned_to?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.created_by) where.createdById = filters.created_by;
    if (filters?.assigned_to) where.assignedToId = filters.assigned_to;

    const tickets: Array<{ status: string }> = await prisma.ticket.findMany({
        where: where as Parameters<typeof prisma.ticket.findMany>[0]['where'],
        select: { status: true },
    });
    return {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
    };
}

// ── Canned Responses ──────────────────────────────────────────

function serializeCannedResponse(cr: {
    id: string; title: string; content: string; createdById: string | null; createdAt: Date;
}): CannedResponse {
    return {
        id: cr.id,
        title: cr.title,
        content: cr.content,
        created_by: cr.createdById,
        created_at: cr.createdAt.toISOString(),
    };
}

export async function getCannedResponses(): Promise<CannedResponse[]> {
    const responses = await prisma.cannedResponse.findMany({
        orderBy: { createdAt: 'desc' },
    });
    return responses.map(serializeCannedResponse);
}

export async function addCannedResponse(title: string, content: string): Promise<CannedResponse> {
    const session = await auth();
    const response = await prisma.cannedResponse.create({
        data: { title, content, createdById: session?.user?.id ?? null },
    });
    return serializeCannedResponse(response);
}

export async function deleteCannedResponse(id: string): Promise<void> {
    await prisma.cannedResponse.delete({ where: { id } });
}
