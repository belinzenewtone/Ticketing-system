// ============================================================
// Database Types — matches original system
// ============================================================

export type UserRole = 'ADMIN' | 'IT_STAFF' | 'USER';
export type ResolutionType = 'sorted' | 'alt-email' | 'alt-phone' | 'alt-both' | 'never-used' | 'licensing';
export type ImportanceLevel = 'urgent' | 'important' | 'neutral';
export type MachineReason = 'old-hardware' | 'faulty' | 'new-user';
export type MachineStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';

export interface Profile {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

// Email entries
export interface Entry {
    id: string;
    number: number;
    entry_date: string;
    employee_name: string;
    work_email: string;
    employee_phone: string;
    alt_email_status: string;
    alt_email: string;
    resolution: ResolutionType;
    completed: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateEntryInput {
    entry_date: string;
    employee_name: string;
    work_email: string;
    employee_phone: string;
    alt_email_status: string;
    alt_email?: string;
    resolution: ResolutionType;
}

// Tasks
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

// Machine requests
export interface MachineRequest {
    id: string;
    number: number;
    date: string;
    requester_name: string;
    user_name: string;
    work_email: string;
    reason: MachineReason;
    importance: ImportanceLevel;
    status: MachineStatus;
    notes: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateMachineInput {
    date: string;
    requester_name: string;
    user_name: string;
    work_email: string;
    reason: MachineReason;
    importance: ImportanceLevel;
    notes?: string;
}

// Tickets
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
}

export interface CreateTicketInput {
    ticket_date: string;
    employee_name: string;
    department?: string;
    category: TicketCategory;
    priority: TicketPriority;
    status?: TicketStatus; // Added this as it's missing from the original CreateTicketInput and usually needed for initial status
    sentiment?: TicketSentiment;
    subject: string;
    description?: string;
    created_by?: string;
    attachment_url?: string | null;
    internal_notes?: string | null;
    due_date?: string | null;
}

// Canned Responses
export interface CannedResponse {
    id: string;
    title: string;
    content: string;
    created_by: string | null;
    created_at: string;
}

// Ticket Activity Log
export interface TicketActivity {
    id: string;
    ticket_id: string;
    user_id: string | null;
    action: string;
    metadata: Record<string, string> | null;
    created_at: string;
}

// Knowledge Base
export interface KbArticle {
    id: string;
    title: string;
    content: string;
    category: TicketCategory | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateKbArticleInput {
    title: string;
    content: string;
    category?: TicketCategory | null;
}

// Ticket Comments
export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    author_name: string;
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface CreateCommentInput {
    ticket_id: string;
    content: string;
    is_internal?: boolean;
}
