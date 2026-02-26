import { createClient } from '@/lib/supabase/client';
import type { Ticket, CreateTicketInput, TicketCategory, TicketPriority, TicketStatus, CannedResponse } from '@/types/database';

const supabase = createClient();

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

export async function getTickets(filters?: {
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    search?: string;
    dateRange?: 'today' | 'week' | 'month' | 'year';
    created_by?: string;
    assigned_to?: string;
}): Promise<Ticket[]> {
    let query = supabase
        .from('tickets')
        .select('*')
        .order('number', { ascending: false });

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }
    if (filters?.priority) {
        query = query.eq('priority', filters.priority);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
    }
    if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters?.search) {
        query = query.or(
            `employee_name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%,department.ilike.%${filters.search}%`
        );
    }
    if (filters?.dateRange) {
        const now = new Date();
        let start: string;
        switch (filters.dateRange) {
            case 'today':
                start = now.toISOString().split('T')[0];
                break;
            case 'week':
                now.setDate(now.getDate() - 7);
                start = now.toISOString().split('T')[0];
                break;
            case 'month':
                now.setMonth(now.getMonth() - 1);
                start = now.toISOString().split('T')[0];
                break;
            case 'year':
                now.setFullYear(now.getFullYear() - 1);
                start = now.toISOString().split('T')[0];
                break;
        }
        if (start!) {
            query = query.gte('ticket_date', start);
        }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Ticket[];
}

export async function addTicket(input: CreateTicketInput): Promise<Ticket> {
    const { data: { user } } = await supabase.auth.getUser();

    // Calculate initial SLA due date
    const due_date = calculateDueDate(input.priority);

    const { data, error } = await supabase
        .from('tickets')
        .insert({ ...input, created_by: user?.id, due_date })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    // Re-calculate SLA if priority changed manually during an update
    if (updates.priority) {
        updates.due_date = calculateDueDate(updates.priority);
    }

    const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteTicket(id: string): Promise<void> {
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) throw error;
}

export async function getTicketStats(filters?: { created_by?: string; assigned_to?: string }) {
    let query = supabase.from('tickets').select('category, priority, status');

    if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
    }
    if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
    }

    const { data, error } = await query;
    if (error) throw error;
    const tickets = data || [];
    return {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in-progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
    };
}

// ── Canned Responses ──────────────────────────────────────────

export async function getCannedResponses(): Promise<CannedResponse[]> {
    const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function addCannedResponse(title: string, content: string): Promise<CannedResponse> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('canned_responses')
        .insert({ title, content, created_by: user?.id })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCannedResponse(id: string): Promise<void> {
    const { error } = await supabase.from('canned_responses').delete().eq('id', id);
    if (error) throw error;
}
