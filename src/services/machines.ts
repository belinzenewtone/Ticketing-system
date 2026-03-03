'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { MachineRequest, CreateMachineInput, MachineReason, ImportanceLevel, MachineStatus } from '@/types/database';

function toEnum(val: string): string { return val.replace(/-/g, '_'); }
function fromEnum(val: string): string { return val.replace(/_/g, '-'); }

function serializeMachine(m: any): MachineRequest {
    return {
        id: m.id,
        number: m.number,
        date: m.date,
        requester_name: m.requester_name,
        user_name: m.user_name ?? null,
        work_email: m.work_email,
        reason: m.reason ? fromEnum(m.reason) as MachineReason : null,
        importance: m.importance as ImportanceLevel,
        status: fromEnum(m.status) as MachineStatus,
        item_type: m.item_type || 'desktop',
        supply_name: m.supply_name ?? null,
        item_count: m.item_count || 1,
        requested_from: m.requested_from || 'portal',
        notes: m.notes ?? '',
        internal_notes: m.internal_notes ?? null,
        created_by: m.created_by ?? null,
        created_at: m.created_at,
        updated_at: m.updated_at,
        comment_count: Number(m.comment_count ?? 0),
        public_comment_count: Number(m.public_comment_count ?? 0),
    };
}

export async function getMachineRequests(filters?: { status?: MachineStatus; reason?: MachineReason; search?: string; item_type?: string }): Promise<MachineRequest[]> {
    let sql = `
        SELECT m.*,
        (SELECT COUNT(*) FROM ticket_comments c WHERE c.machine_id = m.id) as comment_count,
        (SELECT COUNT(*) FROM ticket_comments c WHERE c.machine_id = m.id AND c.is_internal = 0) as public_comment_count
        FROM machine_requests m
        WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status) {
        sql += ' AND status = ?';
        params.push(toEnum(filters.status));
    }

    if (filters?.reason) {
        sql += ' AND reason = ?';
        params.push(toEnum(filters.reason));
    }

    if (filters?.item_type) {
        if (filters.item_type === 'hardware') {
            sql += ' AND item_type IN (?, ?)';
            params.push('desktop', 'laptop');
        } else {
            sql += ' AND item_type = ?';
            params.push(filters.item_type);
        }
    }

    if (filters?.search) {
        sql += ' AND (m.requester_name LIKE ? OR m.user_name LIKE ? OR m.work_email LIKE ? OR m.supply_name LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s, s);
    }

    sql += ' ORDER BY number DESC';
    const rows = await query<any>(sql, ...params);
    return rows.map(serializeMachine);
}

export async function addMachineRequest(input: CreateMachineInput): Promise<MachineRequest> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
        `INSERT INTO machine_requests (
            id, date, requester_name, user_name, work_email, reason, importance, status, notes, internal_notes, created_by, created_at, updated_at, item_type, supply_name, item_count, requested_from
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.date ?? null,
        input.requester_name,
        input.user_name ?? null,
        input.work_email,
        input.reason ? toEnum(input.reason) : null,
        input.importance,
        toEnum('pending'),
        input.notes ?? null,
        input.internal_notes ?? null,
        session?.user?.id ?? null,
        now,
        now,
        input.item_type,
        input.supply_name ?? null,
        input.item_count,
        input.requested_from
    );

    const row = await queryOne<any>('SELECT * FROM machine_requests WHERE id = ?', id);
    return serializeMachine(row);
}

export async function updateMachineStatus(id: string, status: MachineStatus): Promise<void> {
    await execute('UPDATE machine_requests SET status = ?, updated_at = ? WHERE id = ?',
        toEnum(status), new Date().toISOString(), id);
}

export async function deleteMachineRequest(id: string): Promise<void> {
    await execute('DELETE FROM machine_requests WHERE id = ?', id);
}

export async function getMachineStats(item_type?: string) {
    let sql = 'SELECT status, item_type FROM machine_requests';
    const params: any[] = [];
    if (item_type === 'hardware') {
        sql += ' WHERE item_type IN (?, ?)';
        params.push('desktop', 'laptop');
    } else if (item_type) {
        sql += ' WHERE item_type = ?';
        params.push(item_type);
    }
    const rows = await query<any>(sql, ...params);
    return {
        total: rows.length,
        pending: rows.filter(r => r.status === 'pending').length,
        approved: rows.filter(r => r.status === 'approved').length,
        fulfilled: rows.filter(r => r.status === 'fulfilled').length,
        rejected: rows.filter(r => r.status === 'rejected').length,
        supplies: rows.filter(r => r.item_type === 'supplies').length,
        desktop: rows.filter(r => r.item_type === 'desktop').length,
        laptop: rows.filter(r => r.item_type === 'laptop').length,
    };
}

export const getMachines = getMachineRequests;
export const addMachine = addMachineRequest;
export const deleteMachine = deleteMachineRequest;

export async function updateMachine(id: string, data: Partial<CreateMachineInput & { status: MachineStatus }>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.date !== undefined) { fields.push('date = ?'); params.push(data.date); }
    if (data.requester_name !== undefined) { fields.push('requester_name = ?'); params.push(data.requester_name); }
    if (data.work_email !== undefined) { fields.push('work_email = ?'); params.push(data.work_email); }
    if (data.reason !== undefined) { fields.push('reason = ?'); params.push(data.reason ? toEnum(data.reason) : null); }
    if (data.importance !== undefined) { fields.push('importance = ?'); params.push(data.importance); }
    if (data.item_type !== undefined) { fields.push('item_type = ?'); params.push(data.item_type); }
    if (data.supply_name !== undefined) { fields.push('supply_name = ?'); params.push(data.supply_name); }
    if (data.item_count !== undefined) { fields.push('item_count = ?'); params.push(data.item_count); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(toEnum(data.status)); }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }
    if (data.internal_notes !== undefined) { fields.push('internal_notes = ?'); params.push(data.internal_notes); }
    if (data.user_name !== undefined) { fields.push('user_name = ?'); params.push(data.user_name); }

    if (fields.length > 0) {
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        await execute(`UPDATE machine_requests SET ${fields.join(', ')} WHERE id = ?`, ...params);
    }
}
