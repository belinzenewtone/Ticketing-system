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
        notes: m.notes ?? null,
        created_by: m.created_by ?? null,
        created_at: m.created_at,
        updated_at: m.updated_at,
    };
}

export async function getMachineRequests(filters?: { status?: MachineStatus; reason?: MachineReason; search?: string; item_type?: string }): Promise<MachineRequest[]> {
    let sql = 'SELECT * FROM machine_requests WHERE 1=1';
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
        sql += ' AND (requester_name LIKE ? OR user_name LIKE ? OR work_email LIKE ? OR supply_name LIKE ?)';
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
            id, date, requester_name, user_name, work_email, reason, importance, status, notes, created_by, created_at, updated_at, item_type, supply_name, item_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.date ?? null,
        input.requester_name,
        input.user_name ?? null,
        input.work_email,
        input.reason ? toEnum(input.reason) : null,
        input.importance,
        toEnum('pending'),
        input.notes ?? null,
        session?.user?.id ?? null,
        now,
        now,
        input.item_type,
        input.supply_name ?? null,
        input.item_count
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
    let sql = 'SELECT status FROM machine_requests';
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
    };
}

export const getMachines = getMachineRequests;
export const addMachine = addMachineRequest;
export const deleteMachine = deleteMachineRequest;

export async function updateMachine(id: string, data: Partial<{ status: MachineStatus; notes: string }>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.status !== undefined) { fields.push('status = ?'); params.push(toEnum(data.status)); }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }
    if (fields.length > 0) {
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        await execute(`UPDATE machine_requests SET ${fields.join(', ')} WHERE id = ?`, ...params);
    }
}
