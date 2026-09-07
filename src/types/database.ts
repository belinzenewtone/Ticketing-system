// ============================================================
// Database Types — matches original system
// ============================================================

export type UserRole = 'ADMIN' | 'IT_STAFF' | 'USER';
export type ResolutionType = 'sorted' | 'alt-email' | 'alt-phone' | 'alt-both' | 'never-used' | 'licensing';
export type ImportanceLevel = 'urgent' | 'important' | 'neutral';
export type MachineReason = 'old-hardware' | 'faulty' | 'new-user';
export type MachineStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';

// User Profile
export interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified?: Date | null;
    image?: string | null;
    password?: string | null;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
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
    reason: MachineReason | null;
    importance: ImportanceLevel;
    item_type: 'supplies' | 'desktop' | 'laptop';
    supply_name?: string | null;
    item_count: number;
    status: MachineStatus;
    requested_from: 'portal' | 'admin';
    notes: string;
    resolution_notes: string | null;
    internal_notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    comment_count: number;
    public_comment_count: number;
}

export interface CreateMachineInput {
    date: string;
    requester_name: string;
    user_name?: string;
    work_email: string;
    reason?: MachineReason;
    importance: ImportanceLevel;
    item_type: 'supplies' | 'desktop' | 'laptop';
    supply_name?: string;
    item_count: number;
    requested_from: 'portal' | 'admin';
    notes?: string;
    resolution_notes?: string;
    internal_notes?: string;
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
    comment_count: number;
    public_comment_count: number;
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

// ── Procurement Requisitions ─────────────────────────────────
export type RequisitionType = 'it-equipment' | 'office-supplies' | 'services' | 'other';
export type RequisitionStage =
    | 'draft'
    | 'requestor'
    | 'head_department'
    | 'cio'
    | 'head_hr'
    | 'general_manager'
    | 'director_strategy'
    | 'head_finance'
    | 'chairman'
    | 'procurement'
    | 'awaiting_delivery'
    | 'delivered'
    | 'rejected';

export interface Requisition {
    id: string;
    number: number;
    requisition_date: string;
    title: string;
    type: RequisitionType;
    item_quantity: number;              // total number of items being procured
    requested_for: string | null;       // employee/department the items are procured for
    supplier_name: string;
    supplier_contact: string | null;
    total_amount: number;
    current_stage: RequisitionStage;
    notes: string | null;
    created_by: string | null;
    requestor_name: string | null;      // auto-filled: admin who logged it
    requestor_email: string | null;     // auto-filled: admin's email
    created_at: string;
    updated_at: string;
}

export interface RequisitionItem {
    id: string;
    requisition_id: string;
    po_reference: string;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at: string;
}

export interface RequisitionStageRecord {
    id: string;
    requisition_id: string;
    stage: RequisitionStage;
    status: 'approved' | 'rejected' | 'pending';
    signed_date: string | null;
    notes: string | null;
    recorded_by: string | null;
    created_at: string;
}

export interface CreateRequisitionInput {
    requisition_date: string;  // auto-defaults to today
    title: string;
    type: RequisitionType;
    item_quantity: number;     // how many units are being procured
    requested_for: string;     // employee/department the items are for
    supplier_name: string;
    supplier_contact?: string;
    total_amount: number;
    notes?: string;
}

export interface CreateRequisitionItemInput {
    requisition_id: string;
    po_reference: string;
    description: string;
    quantity: number;
    unit_price: number;
}

// Ticket Comments
export interface TicketComment {
    id: string;
    ticket_id?: string | null;
    machine_id?: string | null;
    user_id: string | null;
    author_name: string;
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface CreateCommentInput {
    ticket_id?: string;
    machine_id?: string;
    content: string;
    is_internal?: boolean;
}
