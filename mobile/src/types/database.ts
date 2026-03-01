// Copied from Next.js src/types/database.ts — keep in sync

export type UserRole = 'ADMIN' | 'IT_STAFF' | 'USER';
export type ImportanceLevel = 'urgent' | 'important' | 'neutral';
export type MachineReason = 'old-hardware' | 'faulty' | 'new-user';
export type MachineStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';

export interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    date: string;
    text: string;
    importance: ImportanceLevel;
    completed: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateTaskInput {
    date: string;
    text: string;
    importance: ImportanceLevel;
}

export type TicketCategory = 'email' | 'account-login' | 'password-reset' | 'hardware' | 'software' | 'network-vpn' | 'other';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type TicketSentiment = 'positive' | 'neutral' | 'frustrated' | 'angry';

export interface Ticket {
    id: string;
    number: number;
    ticket_date: string;
    employee_name: string;
    department: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    sentiment?: TicketSentiment;
    subject: string;
    description: string;
    resolution_notes: string;
    internal_notes: string | null;
    due_date: string | null;
    created_by: string | null;
    assigned_to: string | null;
    attachment_url: string | null;
    merged_into: string | null;
    created_at: string;
    updated_at: string;
    comment_count: number;
    public_comment_count: number;
}

export interface CreateTicketInput {
    ticket_date?: string;
    employee_name: string;
    department?: string;
    category: TicketCategory;
    priority: TicketPriority;
    status?: TicketStatus;
    sentiment?: TicketSentiment;
    subject: string;
    description?: string;
    attachment_url?: string | null;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    author_name: string;
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface KbArticle {
    id: string;
    title: string;
    content: string;
    category: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface MachineRequest {
    id: string;
    number: number;
    requester_name: string;
    user_name: string;
    work_email: string;
    reason: MachineReason;
    importance: ImportanceLevel;
    status: MachineStatus;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}
