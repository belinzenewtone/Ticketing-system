'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type {
    Requisition, CreateRequisitionInput,
    RequisitionItem, CreateRequisitionItemInput,
    RequisitionStageRecord, RequisitionStage,
} from '@/types/database';
import { nextStage } from '@/lib/procurement-utils';

// Re-export so callers can still import STAGE_ORDER from here if needed,
// but wrapped in an async getter to satisfy 'use server' rules.
export async function getStageOrder() {
    const { STAGE_ORDER } = await import('@/lib/procurement-utils');
    return STAGE_ORDER;
}

// ─── Requisitions CRUD ───────────────────────────────────────────────────────
export async function getRequisitions(): Promise<Requisition[]> {
    try {
        return await query<Requisition>(
            'SELECT * FROM requisitions ORDER BY created_at DESC'
        );
    } catch {
        return [];
    }
}

export async function getRequisition(id: string): Promise<Requisition | null> {
    try {
        return await queryOne<Requisition>('SELECT * FROM requisitions WHERE id = $1', id);
    } catch {
        return null;
    }
}

export async function createRequisition(input: CreateRequisitionInput): Promise<Requisition> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const id = crypto.randomUUID();
    // Store requestor name & email from the session so the form never needs manual input
    const requestorName  = session.user.name  ?? null;
    const requestorEmail = session.user.email ?? null;

    await execute(
        `INSERT INTO requisitions (id, requisition_date, title, type, item_quantity, requested_for, supplier_name, supplier_contact, total_amount, current_stage, notes, created_by, requestor_name, requestor_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12, $13)`,
        id,
        input.requisition_date,
        input.title,
        input.type,
        input.item_quantity,
        input.requested_for,
        input.supplier_name,
        input.supplier_contact ?? null,
        input.total_amount,
        input.notes ?? null,
        session.user.id,
        requestorName,
        requestorEmail
    );

    const req = await queryOne<Requisition>('SELECT * FROM requisitions WHERE id = $1', id);
    return req!;
}

export async function updateRequisition(id: string, input: Partial<CreateRequisitionInput>): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.requisition_date !== undefined) { fields.push(`requisition_date = $${fields.length + 1}`); params.push(input.requisition_date); }
    if (input.title !== undefined)            { fields.push(`title = $${fields.length + 1}`);            params.push(input.title); }
    if (input.type !== undefined)             { fields.push(`type = $${fields.length + 1}`);             params.push(input.type); }
    if (input.item_quantity !== undefined)    { fields.push(`item_quantity = $${fields.length + 1}`);    params.push(input.item_quantity); }
    if (input.requested_for !== undefined)    { fields.push(`requested_for = $${fields.length + 1}`);    params.push(input.requested_for); }
    if (input.supplier_name !== undefined)    { fields.push(`supplier_name = $${fields.length + 1}`);    params.push(input.supplier_name); }
    if (input.supplier_contact !== undefined) { fields.push(`supplier_contact = $${fields.length + 1}`); params.push(input.supplier_contact ?? null); }
    if (input.total_amount !== undefined)     { fields.push(`total_amount = $${fields.length + 1}`);     params.push(input.total_amount); }
    if (input.notes !== undefined)            { fields.push(`notes = $${fields.length + 1}`);            params.push(input.notes ?? null); }

    if (fields.length > 0) {
        fields.push(`updated_at = $${fields.length + 1}`);
        params.push(new Date().toISOString());
        params.push(id);
        await execute(`UPDATE requisitions SET ${fields.join(', ')} WHERE id = $${params.length}`, ...params);
    }
}

export async function deleteRequisition(id: string): Promise<void> {
    await execute('DELETE FROM requisitions WHERE id = $1', id);
}

// ─── PO Line Items ────────────────────────────────────────────────────────────
export async function getRequisitionItems(requisitionId: string): Promise<RequisitionItem[]> {
    try {
        return await query<RequisitionItem>(
            'SELECT * FROM requisition_items WHERE requisition_id = $1 ORDER BY created_at ASC',
            requisitionId
        );
    } catch {
        return [];
    }
}

export async function addRequisitionItem(input: CreateRequisitionItemInput): Promise<void> {
    const id = crypto.randomUUID();
    await execute(
        `INSERT INTO requisition_items (id, requisition_id, po_reference, description, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        id,
        input.requisition_id,
        input.po_reference,
        input.description,
        input.quantity,
        input.unit_price
    );
}

export async function deleteRequisitionItem(id: string): Promise<void> {
    await execute('DELETE FROM requisition_items WHERE id = $1', id);
}

// ─── Approval Stages ──────────────────────────────────────────────────────────
export async function getRequisitionStages(requisitionId: string): Promise<RequisitionStageRecord[]> {
    try {
        return await query<RequisitionStageRecord>(
            'SELECT * FROM requisition_stages WHERE requisition_id = $1 ORDER BY created_at ASC',
            requisitionId
        );
    } catch {
        return [];
    }
}

export async function recordApproval(
    requisitionId: string,
    stage: RequisitionStage,
    signedDate: string,
    notes?: string
): Promise<void> {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    // Record the approval
    const id = crypto.randomUUID();
    await execute(
        `INSERT INTO requisition_stages (id, requisition_id, stage, status, signed_date, notes, recorded_by)
         VALUES ($1, $2, $3, 'approved', $4, $5, $6)`,
        id, requisitionId, stage, signedDate, notes ?? null, userId
    );

    // Advance to the next stage
    const next = nextStage(stage);
    await execute(
        `UPDATE requisitions SET current_stage = $1, updated_at = NOW() WHERE id = $2`,
        next, requisitionId
    );
}

export async function recordRejection(
    requisitionId: string,
    stage: RequisitionStage,
    reason: string
): Promise<void> {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const id = crypto.randomUUID();
    await execute(
        `INSERT INTO requisition_stages (id, requisition_id, stage, status, notes, recorded_by)
         VALUES ($1, $2, $3, 'rejected', $4, $5)`,
        id, requisitionId, stage, reason, userId
    );

    // Rejected — send back to draft so admin can re-submit
    await execute(
        `UPDATE requisitions SET current_stage = 'draft', updated_at = NOW() WHERE id = $1`,
        requisitionId
    );
}
