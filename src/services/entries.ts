'use server';

import { query, queryOne, execute } from '@/lib/db';
import { auth } from '@/auth';
import type { Entry, CreateEntryInput, ResolutionType } from '@/types/database';

function serializeEntry(e: any): Entry {
    return {
        id: e.id,
        number: e.number,
        entry_date: e.entry_date,
        employee_name: e.employee_name,
        work_email: e.work_email,
        employee_phone: e.employee_phone ?? null,
        alt_email_status: e.alt_email_status ?? null,
        alt_email: e.alt_email ?? null,
        resolution: e.resolution as ResolutionType,
        completed: Boolean(e.completed),
        created_by: e.created_by ?? null,
        created_at: e.created_at,
        updated_at: e.updated_at,
    };
}

export async function getEntries(filters?: {
    search?: string;
    created_by?: string;
    completed?: boolean;
    dateRange?: 'today' | 'week' | 'month' | 'year';
}): Promise<Entry[]> {
    let sql = 'SELECT * FROM entries WHERE 1=1';
    const params: any[] = [];

    if (filters?.created_by) {
        sql += ' AND created_by = ?';
        params.push(filters.created_by);
    }

    if (filters?.completed !== undefined) {
        sql += ' AND completed = ?';
        params.push(filters.completed ? 1 : 0);
    }

    if (filters?.search) {
        sql += ' AND (employee_name LIKE ? OR work_email LIKE ? OR alt_email LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s);
    }

    if (filters?.dateRange) {
        const now = new Date();
        let from: string;
        if (filters.dateRange === 'today') {
            from = now.toISOString().split('T')[0];
        } else if (filters.dateRange === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            from = d.toISOString().split('T')[0];
        } else if (filters.dateRange === 'month') {
            const d = new Date(now); d.setMonth(d.getMonth() - 1);
            from = d.toISOString().split('T')[0];
        } else {
            const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
            from = d.toISOString().split('T')[0];
        }
        sql += ' AND entry_date >= ?';
        params.push(from);
    }

    sql += ' ORDER BY number DESC';
    const rows = await query<any>(sql, ...params);
    return rows.map(serializeEntry);
}

export async function addEntry(input: CreateEntryInput): Promise<Entry> {
    const session = await auth();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
        `INSERT INTO entries (
            id, entry_date, employee_name, work_email, employee_phone, 
            alt_email_status, alt_email, resolution, completed, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.entry_date ?? null,
        input.employee_name,
        input.work_email,
        input.employee_phone ?? null,
        input.alt_email_status ?? null,
        input.alt_email ?? null,
        input.resolution,
        0, // Default completed to false (0)
        session?.user?.id ?? null,
        now,
        now
    );

    const row = await queryOne<any>('SELECT * FROM entries WHERE id = ?', id);
    return serializeEntry(row);
}

export async function updateEntry(id: string, updates: Partial<Entry>): Promise<Entry> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.entry_date !== undefined) { fields.push("entry_date = ?"); params.push(updates.entry_date); }
    if (updates.employee_name !== undefined) { fields.push("employee_name = ?"); params.push(updates.employee_name); }
    if (updates.work_email !== undefined) { fields.push("work_email = ?"); params.push(updates.work_email); }
    if (updates.employee_phone !== undefined) { fields.push("employee_phone = ?"); params.push(updates.employee_phone); }
    if (updates.alt_email_status !== undefined) { fields.push("alt_email_status = ?"); params.push(updates.alt_email_status); }
    if (updates.alt_email !== undefined) { fields.push("alt_email = ?"); params.push(updates.alt_email); }
    if (updates.resolution !== undefined) { fields.push("resolution = ?"); params.push(updates.resolution); }
    if (updates.completed !== undefined) { fields.push("completed = ?"); params.push(updates.completed ? 1 : 0); }

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());

    if (fields.length > 1) {
        const sql = `UPDATE entries SET ${fields.join(', ')} WHERE id = ?`;
        params.push(id);
        await execute(sql, ...params);
    }

    const row = await queryOne<any>('SELECT * FROM entries WHERE id = ?', id);
    return serializeEntry(row);
}

export async function deleteEntry(id: string): Promise<void> {
    await execute('DELETE FROM entries WHERE id = ?', id);
}

export async function getEntryStats(filters?: { created_by?: string }) {
    let sql = 'SELECT completed FROM entries WHERE 1=1';
    const params: any[] = [];
    if (filters?.created_by) { sql += ' AND created_by = ?'; params.push(filters.created_by); }

    const rows = await query<any>(sql, ...params);
    return {
        total: rows.length,
        sorted: rows.filter(r => r.completed === 1).length,
        pending: rows.filter(r => r.completed === 0).length,
    };
}
