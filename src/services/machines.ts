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
        user_name: m.user_name,
        work_email: m.work_email,
        reason: fromEnum(m.reason) as MachineReason,
        importance: m.importance as ImportanceLevel,
        status: fromEnum(m.status) as MachineStatus,
        notes: m.notes ?? null,
        created_by: m.created_by ?? null,
        created_at: m.created_at,
        updated_at: m.updated_at,
    };
}

export async function getMachineRequests(filters?: { status?: MachineStatus; search?: string }): Promise<MachineRequest[]> {
    let sql = 'SELECT * FROM machine_requests WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
        sql += ' AND status = ?';
        params.push(toEnum(filters.status));
    }

    if (filters?.search) {
        sql += ' AND (requester_name LIKE ? OR user_name LIKE ? OR work_email LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s);
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
            id, date, requester_name, user_name, work_email, reason, importance, status, notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.date ?? null,
        input.requester_name,
        input.user_name,
        input.work_email,
        toEnum(input.reason),
        input.importance,
        toEnum(input.status || 'pending'),
        input.notes ?? null,
        session?.user?.id ?? null,
        now,
        now
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
